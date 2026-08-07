import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const apiKey = process.env.BOT_API_KEY;
const baseURL = process.env.BOT_BASE_URL;
const model = process.env.BOT_MODEL;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name} 이(가) 없습니다.\n` +
        `  apps/backend/.env 에 BOT_API_KEY / BOT_BASE_URL / BOT_MODEL 을 채우세요.\n` +
        `  값은 Alibaba Token Plan 콘솔에서 발급합니다.`,
    );
  }
  return value;
}

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    client = new Anthropic({
      apiKey: required('BOT_API_KEY', apiKey),
      baseURL: required('BOT_BASE_URL', baseURL),
    });
  }
  return client;
}

type ThinkingConfig = { type: 'enabled'; budget_tokens: number } | { type: 'enabled'; reasoning_effort: 'high' | 'max' } | { type: 'disabled' };

/**
 * BOT_MODEL(qwen3.8-max 등)이 thinking 기본값을 xhigh · budget 131072로 잡는 모델이라
 * 채팅 한 줄 뽑는 데도 추론에 수십 초가 걸린다. Anthropic 프로토콜이 허용하는
 * budget_tokens 최솟값(1024)을 기본으로 써서 지연을 줄인다.
 * guessWord처럼 호출이 드물고 품질이 중요한 곳은 호출부에서 오버라이드한다.
 *
 * maxTokens 기본값이 큰 것은 API가 max_tokens > budget_tokens를 요구하기 때문이지
 * 답이 길어서가 아니다. budget_tokens 없이 reasoning_effort만 주는 호출은
 * 이 제약을 받지 않으므로 훨씬 작은 값을 써도 된다.
 */
const DEFAULT_THINKING: ThinkingConfig = { type: 'enabled', budget_tokens: 1024 };

/**
 * 같은 상황을 여러 번 물었을 때 글자까지 똑같은 답이 나올 만큼 결정적이어서 올려 잡는다.
 * 이 엔드포인트의 허용 범위는 [0, 2). 낮으면 판박이가 되고, 너무 높이면 말이 무너진다.
 *
 * 주의: 진짜 Anthropic API는 thinking이 켜져 있으면 temperature를 1로 고정하도록 막는다.
 * 이 브릿지도 같은 제약이면 400이 돌아오므로, 발화가 전부 대체 문구로 바뀌면 이 값을 의심할 것.
 */
const DEFAULT_TEMPERATURE = 1.2;

export async function generate(
  system: string,
  user: string,
  {
    maxTokens = 1536,
    thinking = DEFAULT_THINKING,
    temperature = DEFAULT_TEMPERATURE,
  }: { maxTokens?: number; thinking?: ThinkingConfig; temperature?: number } = {},
): Promise<string> {
  const res = await getClient().messages.create({
    model: required('BOT_MODEL', model),
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
    temperature,
    thinking: thinking as unknown as Anthropic.Messages.ThinkingConfigParam,
  });

  const text = res.content
    .filter((b): b is Anthropic.TextBlock => b.type === 'text')
    .map((b) => b.text)
    .join('')
    .trim();

  return stripQuotes(text);
}

/** 모델이 따옴표나 이름표를 붙여 돌려주는 경우가 있어 걷어낸다. */
function stripQuotes(s: string): string {
  return s
    .replace(/^["'「『]/, '')
    .replace(/["'」』]$/, '')
    .replace(/^[^:：]{1,12}[:：]\s*/, '')
    .trim();
}
