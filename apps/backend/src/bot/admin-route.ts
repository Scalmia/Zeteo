import type { Request, Response } from 'express';
import { provider, setProvider, type Provider } from './llm';

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
