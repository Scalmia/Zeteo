import type { Request, Response } from 'express';
import {
  currentModel,
  provider,
  providerSource,
  setProvider,
  type Provider,
  type ProviderSource,
} from './llm';

/**
 * 배포된 서버에서 봇 모델을 바꾸는 숨은 주소.
 *
 *   /x/provider?k=<열쇠>              지금 무엇을 쓰는지 확인
 *   /x/provider?k=<열쇠>&v=openai     GPT-5.6 Sol 로
 *   /x/provider?k=<열쇠>&v=anthropic  qwen3.8-max 로
 *
 * 로컬에서는 npm run provider 로 바꾸면 되지만 배포된 서버에는 터미널이 없다.
 * 그렇다고 화면에 버튼을 두면 같이 플레이하는 사람이 눌러보게 되고, 채팅 명령으로
 * 만들면 판이 진행되는 중에 남들 눈에 띈다. 게임에 들어가기 전에 주소창에서
 * 조용히 바꾸고 들어가는 것이 목적이다.
 *
 * 게임 로직과 완전히 분리돼 있다 — 방·소켓·페이즈 어디에도 끼어들지 않으므로
 * 이 길이 잘못돼도 진행 중인 판에 영향이 없다.
 *
 * 열쇠(ADMIN_KEY)가 환경변수에 없으면 이 길 자체를 없는 것으로 취급한다.
 * 열쇠가 틀렸을 때도 404를 주는 것은, 403을 주면 "여기 뭔가 있다"를 알려주는 셈이기 때문이다.
 */
const CHOICES: Provider[] = ['anthropic', 'openai'];
const LABELS: Record<Provider, string> = {
  anthropic: 'qwen3.8-max',
  openai: 'GPT-5.6 Sol',
};

export function providerAdminRoute(req: Request, res: Response): void {
  const key = process.env.ADMIN_KEY;
  if (!key || req.query.k !== key) {
    res.status(404).send('Not Found');
    return;
  }

  const next = req.query.v;
  if (next === undefined) {
    const now = provider();
    res.type('text/plain').send(`${now} — ${LABELS[now]}`);
    return;
  }

  if (typeof next !== 'string' || !CHOICES.includes(next as Provider)) {
    res.status(400).type('text/plain').send(`v 는 ${CHOICES.join(' 또는 ')} 여야 한다`);
    return;
  }

  const { persisted } = setProvider(next as Provider);
  res
    .type('text/plain')
    .send(
      `${next} — ${LABELS[next as Provider]}\n` +
        (persisted ? '다음 발화부터 적용된다.' : '다음 발화부터 적용된다. (파일에 못 남겨 서버 재시작 시 초기화)'),
    );
}

/**
 * 지금 무엇이 돌고 있는지만 보는 주소. 아무것도 바꾸지 않는다.
 *
 *   /x/status?k=<열쇠>
 *
 * /x/provider 도 v 없이 부르면 현재 값을 알려주지만, 그것만으로는 부족한 경우가 있다.
 * 배포 환경은 .bot-provider 파일을 못 쓸 때가 있어서 값이 메모리에만 남는데, 그 상태로
 * 서버가 한 번 재시작하면 화면에 뜨던 값과 상관없이 조용히 기본값으로 돌아간다.
 * 그래서 값이 어디서 왔는지와 재시작 뒤에 어떻게 되는지를 같이 찍는다.
 *
 * 모델 이름도 같이 보여준다. 같은 openai 라도 GPT_MODEL 이 무엇으로 박혀 있느냐에 따라
 * 실제로 부르는 모델이 다르기 때문이다.
 */
const SOURCE_NOTE: Record<ProviderSource, string> = {
  memory: '이 프로세스에만 있음 — 서버가 재시작하면 사라짐',
  file: '.bot-provider 파일에 남음 — 파일이 유지되면 살아남음',
  env: 'BOT_PROVIDER 환경변수 — 항상 이 값으로 시작함',
  default: '아무 설정도 없어 기본값으로 떨어진 것',
};

export function providerStatusRoute(req: Request, res: Response): void {
  const key = process.env.ADMIN_KEY;
  if (!key || req.query.k !== key) {
    res.status(404).send('Not Found');
    return;
  }

  const now = provider();
  const src = providerSource();
  const fallback = process.env.BOT_PROVIDER === 'openai' ? 'openai' : 'anthropic';

  res
    .type('text/plain')
    .send(
      [
        `프로바이더  ${now} — ${LABELS[now]}`,
        `모델        ${currentModel()}`,
        `출처        ${src} (${SOURCE_NOTE[src]})`,
        `재시작하면  ${src === 'memory' ? fallback : now} 으로 시작`,
      ].join('\n'),
    );
}
