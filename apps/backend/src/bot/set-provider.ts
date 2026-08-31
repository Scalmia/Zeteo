import { provider, setProvider, type Provider } from './llm';

/**
 * 봇이 쓸 모델을 바꾼다.
 *
 *   npm run provider              지금 무엇을 쓰는지 보기
 *   npm run provider anthropic    qwen3.8-max (Alibaba Token Plan)
 *   npm run provider openai       GPT-5.6 Sol (OpenRouter)
 *
 * 서버가 돌아가는 중에 다른 터미널에서 실행해도 된다. llm.ts가 발화할 때마다 이 파일을
 * 다시 읽으므로 재시작이 필요 없고, 진행 중인 게임도 끊기지 않는다.
 * 두 모델을 같은 판에서 번갈아 붙여보려면 이렇게 바꾸면 된다.
 */

const CHOICES: Provider[] = ['anthropic', 'openai'];
const LABELS: Record<Provider, string> = {
  anthropic: 'qwen3.8-max (Alibaba Token Plan)',
  openai: 'GPT-5.6 Sol (OpenRouter)',
};

const [arg] = process.argv.slice(2);

if (arg === undefined) {
  const now = provider();
  console.log(`현재: ${now} — ${LABELS[now]}`);
  console.log(`바꾸려면: npm run provider ${CHOICES.filter((c) => c !== now).join(' | ')}`);
  process.exit(0);
}

if (!CHOICES.includes(arg as Provider)) {
  console.error(`알 수 없는 값: "${arg}"\n  가능한 값: ${CHOICES.join(', ')}`);
  process.exit(1);
}

setProvider(arg as Provider);
console.log(`${arg} 로 바꿨다 — ${LABELS[arg as Provider]}`);
console.log('서버 재시작 없이 다음 발화부터 적용된다.');
