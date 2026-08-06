import type { BotContext, Message, Phase, PublicPlayer, Role } from '@zeteo/shared-types';
import { decideBotAction } from './index';

/**
 * 서버도 화면도 없이 봇 발화만 확인하는 콘솔 스크립트.
 *
 *   인자: [역할] [페이즈] [횟수] [시나리오]
 *
 *   npm run bot -w backend                                  시민으로 묘사 5개
 *   npm run bot -w backend -- liar                          라이어로 묘사 5개
 *   npm run bot -w backend -- citizen debate 6              토론 (chat → vote → chat/silent)
 *   npm run bot -w backend -- liar finalDefense 2           최후 변론
 *   npm run bot -w backend -- citizen lifeVote 1            생사 투표
 *   npm run bot -w backend -- liar guessWord 1              제시어 추측
 *   npm run bot -w backend -- citizen describe 5 kimchi     시나리오 교체
 *
 * 기획서 "최우선 검증 1순위 — 봇 발화 품질"이 이 파일로 수행된다.
 * 여기서 나온 발화를 팀원이 직접 쓴 묘사와 섞어 블라인드 테스트한다.
 *
 * 실명은 서버 전용이 되었으므로 봇은 익명 라벨만 본다. 팀 규칙상 라벨은 A~Z 중
 * 매 판 무작위로 배정되는 알파벳 한 글자라, 여기서도 실행마다 무작위로 뽑는다.
 */

const PHASES: Phase[] = [
  'lobby',
  'roleReveal',
  'describe',
  'debate',
  'finalDefense',
  'lifeVote',
  'reveal',
  'guessWord',
  'botVote',
  'result',
  'survey',
];
const ROLES: Role[] = ['citizen', 'liar'];

const [roleArg = 'citizen', phaseArg = 'describe', countArg = '5', scenarioArg = 'tiger'] =
  process.argv.slice(2);

/** 팀 규칙: A~Z 중 무작위 알파벳 하나가 라벨이 된다. 실행마다 겹치지 않게 5개를 뽑는다. */
function randomLabels(count: number): string[] {
  const pool = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  const picked: string[] = [];
  for (let i = 0; i < count && pool.length > 0; i++) {
    picked.push(pool.splice(Math.floor(Math.random() * pool.length), 1)[0]!);
  }
  return picked;
}

const [labelP1, labelP2, labelP3, labelP4, labelP5] = randomLabels(5) as [
  string,
  string,
  string,
  string,
  string,
];

const players: PublicPlayer[] = [
  { id: 'p1', label: labelP1, isAlive: true, isReady: true },
  { id: 'p2', label: labelP2, isAlive: true, isReady: true },
  { id: 'p3', label: labelP3, isAlive: true, isReady: true },
  { id: 'p4', label: labelP4, isAlive: true, isReady: true },
  { id: 'p5', label: labelP5, isAlive: true, isReady: true }, // 봇이 맡은 자리
];

const SELF = 'p5';
/** 토론에서 최다 득표한 p2가 최후 변론에 섰다고 가정한다. 시나리오 대사의 "{ACCUSED}"는 이 사람의 라벨로 치환된다. */
const ACCUSED = 'p2';

/**
 * 제시어별 목업 상황. 새 상황을 넣으려면 여기에 항목만 추가하면 된다.
 *   describe : 봇 차례 직전, 앞사람 넷이 마친 묘사
 *   mine     : 묘사 단계에서 봇이 이미 했던 말 (토론 이후 단계에서만 쓰인다)
 *   debate   : 토론에서 오간 말. "{ACCUSED}"라고 쓰면 실제 배정된 라벨로 치환된다
 *              (라벨이 매 실행 무작위라 텍스트에 고정 이름을 박아둘 수 없다)
 */
const SCENARIOS = {
  tiger: {
    category: '동물',
    word: '호랑이',
    describe: [
      ['p1', '줄무늬가 있어'],
      ['p2', '음… 산에 살아'],
      ['p3', '어릴 때 동화책에서 자주 봤어'],
      ['p4', '고양잇과야'],
    ],
    mine: '한국 옛날 이야기에 많이 나오잖아',
    debate: [
      ['p1', '{ACCUSED} 묘사가 너무 두루뭉술한데'],
      ['p2', '아 진짜 아니라니까'],
      ['p4', '나도 {ACCUSED} 좀 이상했어'],
    ],
  },
  kimchi: {
    category: '음식',
    word: '김치',
    describe: [
      ['p1', '빨간 편이야'],
      ['p2', '음 밥이랑 같이 먹어'],
      ['p3', '집마다 맛이 다르대'],
      ['p4', '오래 둘수록 시어져'],
    ],
    mine: '냉장고에 항상 있는 그거',
    debate: [
      ['p1', '{ACCUSED} 말이 너무 두루뭉술하지 않아?'],
      ['p2', '아니 진짜 아니야'],
      ['p4', '나도 {ACCUSED} 좀 걸리던데'],
    ],
  },
  subway: {
    category: '교통수단',
    word: '지하철',
    describe: [
      ['p1', '출퇴근에 많이 타지'],
      ['p2', '음… 카드 찍고 타'],
      ['p3', '아침엔 진짜 사람 많아'],
      ['p4', '노선도 보고 갈아타야 해서 헷갈려'],
    ],
    mine: '땅 밑으로 다니잖아',
    debate: [
      ['p1', '{ACCUSED} 그건 아무거나 다 되는데'],
      ['p2', '아 그냥 생각나는 대로 말한 건데'],
      ['p4', '나도 {ACCUSED} 좀 이상했어'],
    ],
  },
} as const;

type ScenarioName = keyof typeof SCENARIOS;
const SCENARIO_NAMES = Object.keys(SCENARIOS) as ScenarioName[];

let seq = 0;
const msg = (speakerId: string, text: string, p: Phase): Message => ({
  id: `m${++seq}`,
  speakerId,
  text,
  phase: p,
  at: Date.now(),
});

const labelOf = (id: string): string => players.find((p) => p.id === id)?.label ?? '진행';
const accusedLabel = labelOf(ACCUSED);
const fillAccused = (text: string): string => text.replaceAll('{ACCUSED}', accusedLabel);

function buildTranscript(name: ScenarioName, p: Phase): Message[] {
  const s = SCENARIOS[name];
  const describeLog = s.describe.map(([id, text]) => msg(id, text, 'describe'));
  if (p === 'describe') return describeLog;

  const debateLog = [
    ...describeLog,
    msg(SELF, s.mine, 'describe'),
    msg('system', '묘사가 한 바퀴 끝났습니다. 토론을 시작합니다.', 'debate'),
    ...s.debate.map(([id, text]) => msg(id, fillAccused(text), 'debate')),
  ];
  if (p === 'debate') return debateLog;

  return [
    ...debateLog,
    msg('system', `${accusedLabel}가 지목되었습니다. 최후 변론을 시작합니다.`, 'finalDefense'),
    msg(ACCUSED, '진짜 아니야 억울한데', 'finalDefense'),
  ];
}

/** 오타를 조용히 통과시키면 default 분기로 빠져 silent만 나오고, 원인을 찾기 어렵다. */
function parseArgs(): { myRole: Role; phase: Phase; count: number; scenario: ScenarioName } {
  if (!ROLES.includes(roleArg as Role)) {
    console.error(`알 수 없는 역할: "${roleArg}"\n  가능한 값: ${ROLES.join(', ')}`);
    process.exit(1);
  }
  if (!PHASES.includes(phaseArg as Phase)) {
    console.error(`알 수 없는 페이즈: "${phaseArg}"\n  가능한 값: ${PHASES.join(', ')}`);
    process.exit(1);
  }
  if (!SCENARIO_NAMES.includes(scenarioArg as ScenarioName)) {
    console.error(`알 수 없는 시나리오: "${scenarioArg}"\n  가능한 값: ${SCENARIO_NAMES.join(', ')}`);
    process.exit(1);
  }
  return {
    myRole: roleArg as Role,
    phase: phaseArg as Phase,
    count: Number(countArg) || 5,
    scenario: scenarioArg as ScenarioName,
  };
}

const { myRole, phase, count, scenario } = parseArgs();
const { category, word } = SCENARIOS[scenario];

/** 서버가 매 호출마다 새로 만들어 넘기는 스냅샷. 아래 루프가 서버 대신 갱신한다. */
const ctx: BotContext = {
  phase,
  myRole,
  category,
  word: myRole === 'liar' ? null : word, // 라이어는 제시어를 모른다
  selfId: SELF,
  players,
  transcript: buildTranscript(scenario, phase),
  voteCounts: phase === 'describe' ? {} : { p2: 2, p3: 1 },
  accusedId: phase === 'describe' || phase === 'debate' ? null : ACCUSED,
  myVote: null,
};

/**
 * 실제 서버는 봇의 발언을 기록하고 표를 반영한 뒤 다시 물어본다.
 * 그 갱신을 흉내내지 않으면 매 호출이 같은 상황이라 첫 분기만 반복해서 확인된다.
 *
 * 단 서버가 반복 호출하는 단계는 debate뿐이다. 묘사는 1인 1회라서 여기서도 갱신하지 않고
 * 같은 상황을 매번 새로 샘플링해야 발화가 얼마나 다양한지 볼 수 있다.
 */
function applyToContext(action: Awaited<ReturnType<typeof decideBotAction>>): void {
  if (ctx.phase !== 'debate') return;

  if (action.t === 'chat') {
    ctx.transcript.push(msg(SELF, action.text, 'debate'));
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

/** backend 는 CommonJS 라 최상위 await 를 쓸 수 없다. 함수로 감싼다. */
async function main(): Promise<void> {
  const line = '─'.repeat(62);

  console.log(line);
  console.log(
    `역할 ${myRole}   페이즈 ${phase}   주제 ${category}   제시어 ${ctx.word ?? '(모름)'}   시나리오 ${scenario}`,
  );
  console.log(line);
  console.log(ctx.transcript.map((m) => `  ${labelOf(m.speakerId)}: ${m.text}`).join('\n'));
  console.log(line);
  console.log(`봇 발화 ${count}개 생성 중…\n`);

  for (let i = 1; i <= count; i++) {
    const started = Date.now();
    try {
      const action = await decideBotAction(ctx);
      const elapsed = Date.now() - started;

      if (action.t === 'describe' || action.t === 'chat') {
        console.log(`${String(i).padStart(2)}. [${action.t}] ${action.text}`);
        console.log(`    응답 ${elapsed}ms · 지연 ${action.delayMs}ms · ${action.text.length}자`);
        console.log(`    출력까지 ${elapsed + action.delayMs}ms\n`);
      } else {
        console.log(`${String(i).padStart(2)}. [${action.t}] ${JSON.stringify(action)}`);
        console.log(`    응답 ${elapsed}ms\n`);
      }

      applyToContext(action);
    } catch (err) {
      console.error(`\n${String(i).padStart(2)}. 실패`);
      console.error(err instanceof Error ? err.message : err);
      console.error(
        '\n확인할 것:\n' +
          '  1. apps/backend/.env 가 있는가\n' +
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
