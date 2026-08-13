import fs from 'fs';
import path from 'path';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
import 'dotenv/config';

/**
 * 봇이 쓸 모델을 두 갈래로 나눠 둔다.
 *
 *   anthropic  Alibaba Token Plan(qwen3.8-max)을 Anthropic 프로토콜 호환 엔드포인트로 호출
 *   openai     OpenRouter를 통해 GPT-5.6 Sol 호출
 *
 * 바깥(index.ts · prompts.ts)은 generate() 하나만 보고, 어느 쪽이 도는지 모른다.
 * 그래서 프로바이더를 갈아도 발언 제어·끊어 보내기·라벨 처리 같은 로직은 그대로다.
 */
export type Provider = 'anthropic' | 'openai';

/**
 * 판을 돌리는 중에도 바꿀 수 있어야 한다. 서버를 껐다 켜면 진행 중인 게임이 날아가고,
 * 코드를 고쳐 배포하는 방식은 한 번 바꾸는 데 몇 분이 걸린다.
 * 그래서 매 호출마다 파일을 다시 읽는다. 몇 바이트짜리 읽기는 1ms도 안 걸려
 * LLM 응답 시간(수 초)에 묻힌다.
 *
 * 파일이 없으면 환경변수, 그것도 없으면 anthropic. 배포 환경처럼 파일을 못 만드는 곳에서는
 * BOT_PROVIDER 환경변수만으로도 돌아간다.
 */
const PROVIDER_FILE = path.join(__dirname, '../../.bot-provider');

/**
 * 배포된 서버는 파일을 못 쓸 수도 있어서 메모리에도 들고 있는다.
 * 이 프로세스가 마지막으로 정한 값이 있으면 그것을 우선한다.
 */
let override: Provider | null = null;

export function provider(): Provider {
  if (override !== null) return override;
  try {
    const fromFile = fs.readFileSync(PROVIDER_FILE, 'utf8').trim();
    if (fromFile === 'anthropic' || fromFile === 'openai') return fromFile;
  } catch {
    // 파일이 없는 것은 정상이다. 아래로 넘어간다.
  }
  return process.env.BOT_PROVIDER === 'openai' ? 'openai' : 'anthropic';
}

/** 바꾸고, 파일에도 남길 수 있으면 남긴다. 파일에 못 남겨도 이 프로세스가 사는 동안은 유지된다. */
export function setProvider(next: Provider): { persisted: boolean } {
  override = next;
  try {
    fs.writeFileSync(PROVIDER_FILE, next, 'utf8');
    return { persisted: true };
  } catch {
    return { persisted: false };
  }
}

function required(name: string, value: string | undefined, where: string): string {
  if (!value) {
    throw new Error(`환경변수 ${name} 이(가) 없습니다.\n  apps/backend/.env 에 채우세요. 값은 ${where}에서 발급합니다.`);
  }
  return value;
}

/**
 * 추론에 얼마나 힘을 쓸지. 프로바이더마다 부르는 이름이 달라 중립적인 말로 받고 여기서 번역한다.
 * 이래야 호출부(index.ts)가 프로바이더를 몰라도 된다.
 *
 *   default  평소 발화용. 빠른 쪽
 *   max      guessWord처럼 호출이 드물고 품질이 중요한 곳
 */
export type Effort = 'default' | 'max';

export interface GenerateOptions {
  maxTokens?: number;
  effort?: Effort;
}

// ── Anthropic 경로 (qwen3.8-max) ──────────────────────────────────────────

let anthropicClient: Anthropic | null = null;

function getAnthropic(): Anthropic {
  if (!anthropicClient) {
    anthropicClient = new Anthropic({
      apiKey: required('BOT_API_KEY', process.env.BOT_API_KEY, 'Alibaba Token Plan 콘솔'),
      baseURL: required('BOT_BASE_URL', process.env.BOT_BASE_URL, 'Alibaba Token Plan 콘솔'),
    });
  }
  return anthropicClient;
}

/**
 * 이 모델은 thinking 기본값을 xhigh · budget 131072로 잡아서, 채팅 한 줄에도 수십 초가 걸린다.
 *
 * budget_tokens와 reasoning_effort는 같은 thinking 객체 안의 서로 다른 속성이라 같이 쓸 수 있다.
 * 둘을 동시에 넣어본 적이 없었는데, budget_tokens만 줬을 때는 effort를 안 정해준 셈이라
 * 모델이 그 예산을 낮은 강도로 썼을 수 있다. reasoning_effort: 'max'를 같이 주면
 * "그 예산 안에서 최대한 밀도 있게" 쓰게 할 수 있는지가 이번에 확인할 것.
 * budget_tokens 1024는 Anthropic 프로토콜이 허용하는 최솟값이라 여기서도 지연의 하한선 역할을 한다.
 *
 * guessWord는 호출이 드물고 속도가 안 중요해서 budget_tokens 없이 effort만 준다 — 예산에
 * 안 묶이고 필요한 만큼 쓰게 둔다. 최근 확인된 ultra는 reasoning_effort 중 가장 높은 단계다.
 *
 * temperature 1.2 — 같은 상황을 여러 번 물으면 글자까지 똑같은 답이 나올 만큼 결정적이어서 올려 잡았다.
 * OpenAI 경로에는 이 손잡이가 없다(지원 파라미터에 temperature가 없다).
 */
async function callAnthropic(system: string, user: string, opts: Required<GenerateOptions>): Promise<string> {
  const thinking =
    opts.effort === 'max'
      ? { type: 'enabled', reasoning_effort: 'ultra' }
      : { type: 'enabled', budget_tokens: 1024, reasoning_effort: 'max' };

  const res = await getAnthropic().messages.create({
    model: required('BOT_MODEL', process.env.BOT_MODEL, 'Alibaba Token Plan 콘솔'),
    max_tokens: opts.maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    temperature: 1.2,
    thinking: thinking as unknown as Anthropic.Messages.ThinkingConfigParam,
  });

  return res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('');
}

// ── OpenAI 경로 (GPT-5.6 Sol via OpenRouter) ──────────────────────────────

let openaiClient: OpenAI | null = null;

function getOpenAI(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({
      apiKey: required('GPT_API_KEY', process.env.GPT_API_KEY, 'OpenRouter'),
      baseURL: process.env.GPT_BASE_URL ?? 'https://openrouter.ai/api/v1',
    });
  }
  return openaiClient;
}

/**
 * 기본을 high, guessWord를 max로 잡았다. qwen에서 무거운 추론이 느렸던 경험이 있지만
 * 그건 다른 모델 얘기라 GPT-5.6에 그대로 옮겨진다는 보장이 없다. 깎는 건 실측하고 나서 할 일이지
 * 미리 짐작으로 깎을 일이 아니다.
 *
 * 추론 토큰은 출력으로 과금되고(입력 $5/M · 출력 $30/M) 화면에는 안 보인다.
 * 다만 본문(content)과는 다른 필드로 오기 때문에, qwen에서 겪었던 "사고 과정이 채팅에 튀어나오는" 일은
 * 구조적으로 덜 일어난다. 그래도 index.ts의 looksInvalid 검사는 그대로 둔다.
 */
async function callOpenAI(system: string, user: string, opts: Required<GenerateOptions>): Promise<string> {
  const res = await getOpenAI().chat.completions.create({
    model: required('GPT_MODEL', process.env.GPT_MODEL, 'OpenRouter (예: openai/gpt-5.6-sol)'),
    max_completion_tokens: opts.maxTokens,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    reasoning_effort: opts.effort === 'max' ? 'max' : 'high',
  });

  return res.choices[0]?.message?.content ?? '';
}

// ── 공통 ──────────────────────────────────────────────────────────────────

export async function generate(
  system: string,
  user: string,
  { maxTokens = 1536, effort = 'default' }: GenerateOptions = {},
): Promise<string> {
  const opts = { maxTokens, effort };
  const raw = provider() === 'openai' ? await callOpenAI(system, user, opts) : await callAnthropic(system, user, opts);
  return stripQuotes(raw.trim());
}

/** 모델이 따옴표나 이름표를 붙여 돌려주는 경우가 있어 걷어낸다. */
function stripQuotes(s: string): string {
  return s
    .replace(/^["'「『]/, '')
    .replace(/["'」』]$/, '')
    .replace(/^[^:：]{1,12}[:：]\s*/, '')
    .trim();
}
