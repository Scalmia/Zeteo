import readline from 'readline';
import type { BotContext, Message, Phase, PublicPlayer, Role } from '@zeteo/shared-types';
import { decideBotAction } from './index';

/**
 * 봇과 1대1로 직접 대화해보는 콘솔 도구.
 *
 *   npm run talk -w backend                        시민 봇과 토론
 *   npm run talk -w backend -- liar                라이어 봇과 토론
 *   npm run talk -w backend -- citizen 김치         제시어 지정 (알려진 단어면 주제 자동 매칭)
 *   npm run talk -w backend -- citizen 김치 음식    제시어+주제 직접 지정
 *
 * playground.ts 는 정해둔 목업으로 한 번에 여러 개를 뽑아보는 도구이고,
 * 이쪽은 사람이 직접 말을 걸어 반응을 유도하는 도구다. 지연을 실제로 기다려서
 * 발화 속도와 끊어 보내는 간격을 몸으로 확인할 수 있게 했다.
 *
 * 빈 줄을 입력하면 아무 말도 하지 않고 봇에게만 다시 물어본다.
 * 침묵을 골랐을 때 그다음에 무엇을 하는지 보려면 이걸 쓴다.
 */

/**
 * 제시어만 주고 주제를 안 주면 기본값('동물')이 그대로 남아 "제시어는 김치인데 주제는 동물" 같은
 * 앞뒤가 안 맞는 조합이 만들어졌다. playground.ts의 시나리오와 같은 단어는 주제를 자동으로 맞춘다.
 *
 * 묘사도 같이 들고 있는다. 이게 없으면 토론이 아무 맥락 없이 시작돼서, "아까 그거 왜 그렇게
 * 말했어?" 같은 추궁을 할 대상이 없다. 실제 게임에서는 묘사가 한 바퀴 끝난 뒤에 토론이 열리므로
 * 그 상태를 만들어 준다. 문구는 playground.ts의 같은 시나리오에서 가져왔다.
 */
interface Known {
  category: string;
  /** 내가 묘사 단계에서 했던 말 */
  mine: string;
  /** 봇이 묘사 단계에서 했던 말. 추궁하면 이걸 해명해야 한다 */
  bot: string;
}

const KNOWN_WORDS: Record<string, Known> = {
  호랑이: { category: '동물', mine: '가까이 가면 위험하지', bot: '무리로 다니진 않잖아' },
  김치: { category: '음식', mine: '밥이랑 같이 먹지', bot: '식당 가면 그냥 나오잖아' },
  지하철: { category: '교통수단', mine: '출퇴근 시간엔 붐비지', bot: '오래 타면 좀 지루하긴 해' },
};

/** 라이어는 제시어를 몰라서 저렇게 구체적으로 말할 수 없다. 넓게 뭉갠 말로 바꿔 준다. */
const LIAR_DESCRIBE = '음 나도 비슷하게 생각했어';

const [roleArg = 'citizen', wordArg = '호랑이', categoryArg] = process.argv.slice(2);
const myRole = roleArg as Role;

if (myRole !== 'citizen' && myRole !== 'liar') {
  console.error(`알 수 없는 역할: "${roleArg}"\n  가능한 값: citizen, liar`);
  process.exit(1);
}

const known = KNOWN_WORDS[wordArg];
const category = categoryArg ?? known?.category;
if (category === undefined) {
  console.error(
    `"${wordArg}"의 주제를 모른다.\n` +
      `  아는 단어: ${Object.keys(KNOWN_WORDS).join(', ')}\n` +
      `  다른 단어를 쓰려면 주제를 직접 넘겨라: npm run talk -w backend -- ${roleArg} ${wordArg} <주제>`,
  );
  process.exit(1);
}

/** 라벨은 매 판 A~Z 중 무작위로 배정된다. 두 명뿐이니 두 글자만 뽑는다. */
const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
const pick = <T>(xs: T[]): T => xs[Math.floor(Math.random() * xs.length)]!;
const myLabel = pool.splice(pool.indexOf(pick(pool)), 1)[0]!;
const botLabel = pool.splice(pool.indexOf(pick(pool)), 1)[0]!;

const ME = 'h1';
const BOT = 'b1';

const players: PublicPlayer[] = [
  { id: ME, label: myLabel, isAlive: true, isReady: true },
  { id: BOT, label: botLabel, isAlive: true, isReady: true },
];

let seq = 0;
const msg = (speakerId: string, text: string, phase: Phase): Message => ({
  id: `t${++seq}`,
  speakerId,
  text,
  phase,
  at: Date.now(),
});

/**
 * 묘사가 한 바퀴 끝난 상태로 시작한다. 아는 단어가 아니면 묘사 없이 시작할 수밖에 없는데,
 * 그러면 서로 해명을 요구할 대상이 없어 대화가 겉돈다.
 */
const describeLog: Message[] =
  known === undefined
    ? []
    : [
        msg(ME, known.mine, 'describe'),
        msg(BOT, myRole === 'liar' ? LIAR_DESCRIBE : known.bot, 'describe'),
      ];

const ctx: BotContext = {
  phase: 'debate',
  myRole,
  category,
  word: myRole === 'liar' ? null : wordArg,
  selfId: BOT,
  players,
  transcript: [...describeLog, msg('system', '묘사가 끝났습니다. 토론을 시작합니다.', 'debate')],
  voteCounts: {},
  accusedId: null,
  myVote: null,
};

const labelOf = (id: string): string => players.find((p) => p.id === id)?.label ?? '진행';
const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** 서버가 하는 일을 대신한다. 발언은 기록하고, 표는 집계에 반영한다. */
function apply(action: Awaited<ReturnType<typeof decideBotAction>>): void {
  if (action.t === 'chat' || action.t === 'describe') {
    ctx.transcript.push(msg(BOT, action.text, ctx.phase));
    return;
  }
  if (action.t === 'vote') {
    if (ctx.myVote !== null) ctx.voteCounts[ctx.myVote] = (ctx.voteCounts[ctx.myVote] ?? 1) - 1;
    if (action.targetId !== null) {
      ctx.voteCounts[action.targetId] = (ctx.voteCounts[action.targetId] ?? 0) + 1;
    }
    ctx.myVote = action.targetId;
  }
}

/**
 * 서버는 봇이 말하면 곧바로 다시 물어본다. 그 연쇄를 그대로 돌려서
 * 끊어 보내기(앞 조각 → 뒷말)가 실제로 어떻게 보이는지 확인할 수 있게 한다.
 * 침묵이 나오면 멈추고 사람 차례로 돌아간다.
 */
async function runBot(): Promise<void> {
  for (let i = 0; i < 6; i++) {
    const started = Date.now();
    let action;
    try {
      action = await decideBotAction(ctx);
    } catch (err) {
      console.error('  [실패]', err instanceof Error ? err.message : err);
      return;
    }
    const elapsed = Date.now() - started;

    if (action.t === 'chat' || action.t === 'describe') {
      await sleep(action.delayMs);
      console.log(`  ${botLabel}: ${action.text}`);
      console.log(
        `     \x1b[90m생성 ${elapsed}ms · 지연 ${action.delayMs}ms · ` +
          `출력까지 ${elapsed + action.delayMs}ms · ${action.text.length}자\x1b[0m`,
      );
      apply(action);
      continue;
    }

    if (action.t === 'vote') {
      const target = action.targetId === null ? '기권' : labelOf(action.targetId);
      console.log(`  \x1b[90m[투표] ${target}\x1b[0m`);
      apply(action);
      continue;
    }

    if (action.t === 'silent') {
      console.log(`  \x1b[90m[침묵] ${action.delayMs}ms 뒤 재판단 — 빈 줄로 계속\x1b[0m`);
      return;
    }

    console.log(`  \x1b[90m[${action.t}] ${JSON.stringify(action)}\x1b[0m`);
    return;
  }
  console.log('  \x1b[90m(연속 6회에서 끊었다)\x1b[0m');
}

const line = '─'.repeat(62);
console.log(line);
console.log(
  `1대1 토론   나 ${myLabel}   봇 ${botLabel}(${myRole})   ` +
    `주제 ${category}   제시어 ${ctx.word ?? '(봇은 모름)'}`,
);
console.log(line);
if (describeLog.length > 0) {
  console.log('묘사 단계에서 오간 말:');
  for (const m of describeLog) console.log(`  ${labelOf(m.speakerId)}: ${m.text}`);
} else {
  console.log(`("${wordArg}"는 묘사가 준비돼 있지 않아 맥락 없이 시작한다)`);
}
console.log(line);
console.log('말을 걸면 봇이 답한다. 빈 줄은 "말 없이 한 번 더 물어보기".');
console.log('종료는 Ctrl+C.');
console.log(line);

const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

async function loop(): Promise<void> {
  for (;;) {
    const input = await new Promise<string>((resolve) => rl.question(`${myLabel}> `, resolve));
    const text = input.trim();
    if (text.length > 0) ctx.transcript.push(msg(ME, text, ctx.phase));
    await runBot();
  }
}

void loop();
