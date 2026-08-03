import type { BotContext, Message, Phase, PublicPlayer, Role } from '@zeteo/shared-types';
import { decideBotAction } from './index';

/**
 * 서버도 화면도 없이 봇 발화만 확인하는 콘솔 스크립트.
 *
 *   npm run bot -w backend                    시민으로 묘사 5개
 *   npm run bot -w backend -- liar            라이어로 묘사 5개
 *   npm run bot -w backend -- citizen debate  토론 발화
 *   npm run bot -w backend -- liar debate 3   개수 지정
 *
 * 기획서 "최우선 검증 1순위 — 봇 발화 품질"이 이 파일로 수행된다.
 * 여기서 나온 발화를 팀원이 직접 쓴 묘사와 섞어 블라인드 테스트한다.
 */

const [roleArg = 'citizen', phaseArg = 'describe', countArg = '5'] = process.argv.slice(2);

const myRole = roleArg as Role;
const phase = phaseArg as Phase;
const count = Number(countArg) || 5;

const players: PublicPlayer[] = [
  { id: 'p1', name: '김정현', isAlive: true },
  { id: 'p2', name: '박진', isAlive: true },
  { id: 'p3', name: '이현우', isAlive: true },
  { id: 'p4', name: '유민성', isAlive: true },
  { id: 'p5', name: '최서연', isAlive: true }, // 봇이 맡은 자리
];

const SELF = 'p5';
const CATEGORY = '동물';
const WORD = '호랑이';

let seq = 0;
const msg = (speakerId: string, text: string, p: Phase): Message => ({
  id: `m${++seq}`,
  speakerId,
  text,
  phase: p,
  at: Date.now(),
});

/** 봇 차례 직전까지의 상황. 앞사람 넷이 이미 묘사를 마친 상태. */
const describeLog: Message[] = [
  msg('p1', '줄무늬가 있어요', 'describe'),
  msg('p2', '음… 산에 살아요', 'describe'),
  msg('p3', '어릴 때 동화책에서 자주 봤어요', 'describe'),
  msg('p4', '고양잇과입니다', 'describe'),
];

const debateLog: Message[] = [
  ...describeLog,
  msg('p5', '한국 옛날 이야기에 많이 나오죠', 'describe'),
  msg('system', '묘사가 한 바퀴 끝났습니다. 토론을 시작합니다.', 'debate'),
  msg('p1', '박진님 묘사가 너무 두루뭉술한데요', 'debate'),
  msg('p2', '아 진짜 아니라니까', 'debate'),
  msg('p4', '저도 박진님 좀 이상했어요', 'debate'),
];

const ctx: BotContext = {
  phase,
  myRole,
  category: CATEGORY,
  word: myRole === 'liar' ? null : WORD, // 라이어는 제시어를 모른다
  selfId: SELF,
  players,
  transcript: phase === 'describe' ? describeLog : debateLog,
  voteCounts: phase === 'describe' ? {} : { p2: 2, p3: 1 },
};

const nameOf = (id: string): string => players.find((p) => p.id === id)?.name ?? '진행';

/** backend 는 CommonJS 라 최상위 await 를 쓸 수 없다. 함수로 감싼다. */
async function main(): Promise<void> {
  const line = '─'.repeat(62);

  console.log(line);
  console.log(
    `역할 ${myRole}   페이즈 ${phase}   주제 ${CATEGORY}   제시어 ${ctx.word ?? '(모름)'}`,
  );
  console.log(line);
  console.log(ctx.transcript.map((m) => `  ${nameOf(m.speakerId)}: ${m.text}`).join('\n'));
  console.log(line);
  console.log(`봇 발화 ${count}개 생성 중…\n`);

  for (let i = 1; i <= count; i++) {
    const started = Date.now();
    try {
      const action = await decideBotAction(ctx);
      const elapsed = Date.now() - started;

      if (action.t === 'speak') {
        console.log(`${String(i).padStart(2)}. ${action.text}`);
        console.log(`    응답 ${elapsed}ms · 지연 ${action.delayMs}ms · ${action.text.length}자\n`);
      } else {
        console.log(`${String(i).padStart(2)}. [${action.t}] ${JSON.stringify(action)}\n`);
      }
    } catch (err) {
      console.error(`\n${String(i).padStart(2)}. 실패`);
      console.error(err instanceof Error ? err.message : err);
      console.error(
        '\n확인할 것:\n' +
          '  1. apps/backend/.env 가 있는가 (cp apps/backend/.env.example apps/backend/.env)\n' +
          '  2. BOT_API_KEY / BOT_BASE_URL / BOT_MODEL 이 채워져 있는가\n' +
          '  3. BOT_MODEL 이 그 엔드포인트가 실제로 서빙하는 모델 이름인가\n',
      );
      process.exit(1);
    }
  }

  console.log(line);
  console.log('이 발화들을 팀원이 직접 쓴 묘사와 섞어 블라인드 테스트한다.');
}

void main();
