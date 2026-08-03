import Anthropic from '@anthropic-ai/sdk';
import 'dotenv/config';

const apiKey = process.env.BOT_API_KEY;
const baseURL = process.env.BOT_BASE_URL;
const model = process.env.BOT_MODEL;

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `환경변수 ${name} 이(가) 없습니다.\n` +
        `  apps/backend/.env.example 을 .env 로 복사한 뒤 값을 채우세요.\n` +
        `  cp apps/backend/.env.example apps/backend/.env`,
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

/**
 * 봇 발화 한 번을 생성한다.
 *
 * Anthropic 프로토콜 호환 엔드포인트를 쓰므로, Anthropic 고유 파라미터
 * (thinking, effort 등)는 넣지 않는다. 어느 제공자에서도 통하는 최소 집합만 사용한다.
 */
export async function generate(system: string, user: string, maxTokens = 200): Promise<string> {
  const res = await getClient().messages.create({
    model: required('BOT_MODEL', model),
    max_tokens: maxTokens,
    system,
    messages: [{ role: 'user', content: user }],
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
