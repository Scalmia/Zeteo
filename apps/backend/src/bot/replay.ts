import type { BotAction, BotContext, Message, PublicPlayer, Role } from '@zeteo/shared-types';
import { decideBotAction, forgetRoom } from './index';

/**
 * 실제로 있었던 순간을 얼려 두고, 같은 자리에서 봇이 몇 번이나 같은 실수를 하는지 센다.
 *
 *   npm run replay -w backend                모든 사례 3회씩
 *   npm run replay -w backend -- stance      한 사례만
 *   npm run replay -w backend -- stance 10   횟수 지정
 *   npm run replay -w backend -- all 5       전체를 5회씩
 *
 * playground.ts와 목적이 반대다. 저쪽은 라벨도 사람 대사도 매번 무작위로 뽑아
 * "봇이 얼마나 다양하게 말하는가"를 본다. 여기는 2026-08-20 실측 4판에서 문제가
 * 터진 지점을 라벨까지 그대로 복원해 고정한다. 고치기 전과 후를 같은 자리에서 견주려면
 * 상황이 매번 같아야 하기 때문이다.
 *
 * 사례를 그때그때 손으로 짜던 동안에는 한 번 재는 데 표본 5~6회가 한계였고, 그 숫자로는
 * "고쳐졌다"를 말할 수 없었다. 여기 넣어두면 같은 자리를 몇 번이든 다시 잴 수 있다.
 *
 * 판정(judge)은 기계가 확실히 셀 수 있는 것만 본다. 라벨을 불렀는지, 특정 낱말이 들어갔는지,
 * 침묵했는지 같은 것들이다. 눈치가 있는지 없는지는 사람이 봐야 하므로 발언을 전부 찍어준다.
 */

type Verdict = { bad: boolean; note: string };

interface Case {
  id: string;
  problem: string; // 인간 행동 기준 목록에서 몇 번인지
  source: string; // 어느 판의 어느 시점인지
  expect: string; // 무엇이 나오면 잘한 것인지
  build(): BotContext;
  judge(action: BotAction): Verdict;
}

// ── 상황을 만드는 도구 ────────────────────────────────────────────────────

let seq = 0;
const m = (speakerId: string, text: string, phase: Message['phase']): Message => ({
  id: `r${seq}`,
  speakerId,
  text,
  phase,
  at: 1_000_000 + seq++ * 10_000,
});

/**
 * 실측 로그의 라벨을 그대로 쓴다. playground는 라벨을 매 실행 무작위로 뽑지만
 * 여기서는 대사 안에 이름이 박혀 있어서(예: "N 해명해봐") 라벨이 달라지면 상황이 깨진다.
 * id와 label을 같게 두는 것도 같은 이유다 — 로그를 옮겨 적을 때 헷갈릴 자리를 없앤다.
 */
function seats(labels: string[]): PublicPlayer[] {
  return labels.map((label) => ({ id: label, label, isAlive: true, isReady: true }));
}

function ctxOf(o: {
  labels: string[];
  self: string;
  role: Role;
  category: string;
  word: string | null;
  phase: BotContext['phase'];
  transcript: Message[];
  voteCounts?: Record<string, number>;
  myVote?: string | null;
  accusedId?: string | null;
}): BotContext {
  return {
    phase: o.phase,
    myRole: o.role,
    category: o.category,
    word: o.role === 'liar' ? null : o.word, // 라이어는 제시어를 모른다
    selfId: o.self,
    players: seats(o.labels),
    transcript: o.transcript,
    voteCounts: o.voteCounts ?? {},
    accusedId: o.accusedId ?? null,
    myVote: o.myVote ?? null,
  };
}

// ── 판정 도구 ────────────────────────────────────────────────────────────

/** 라벨이 알파벳 한 글자라 낱말 경계를 봐야 다른 단어 속 글자를 이름으로 읽지 않는다. */
const calls = (text: string, label: string): boolean =>
  new RegExp(`(^|[^A-Za-z])${label}([^A-Za-z]|$)`).test(text);

const hasAny = (text: string, words: string[]): string[] => words.filter((w) => text.includes(w));

/** 마음을 바꿀 때 사람이 붙이는 말. 이게 있으면 갈아타도 부자연스럽지 않다. */
const REASON = ['바꿨', '바뀌', '아까', '근데', '생각해보니', '다시 보니', '듣고', '철회', '보다'];

const textOf = (a: BotAction): string | null =>
  a.t === 'chat' || a.t === 'describe' ? a.text : null;

// ── 사례 ─────────────────────────────────────────────────────────────────

const CASES: Case[] = [
  {
    id: 'stance',
    problem: '1. 한 번 정한 용의자를 유지한다',
    source: '0820 6:11:43 — Q 지목 직후. 동점으로 재투표가 걸려 표가 비었다',
    expect: 'Q를 유지하거나, 옮기더라도 이유를 한마디 붙인다',
    build: () =>
      ctxOf({
        labels: ['N', 'Y', 'A', 'Q'],
        self: 'N',
        role: 'liar',
        word: '볼링',
        category: '스포츠',
        phase: 'debate',
        voteCounts: {}, // 재투표로 비워졌다. 여기가 예전에 규칙이 사라지던 자리다
        myVote: null,
        transcript: [
          m('N', '흐름 한번 타면 분위기 확 바뀜', 'describe'),
          m('A', '무거움', 'describe'),
          m('Y', '운에 기대는 요소가 있음', 'describe'),
          m('Q', '안해본사람은 점수계산하는거 당황할수도', 'describe'),
          m('N', '다들 감 오냐?', 'debate'),
          m('Y', '니가 좀 포괄적인데', 'debate'),
          m('A', '흐름 한번 타면 분위기가 바뀌지 않는 스포츠가 있나', 'debate'),
          m('N', '점수계산이 뭐가 헷갈려?', 'debate'),
          m('Q', '처음해본사람은 점수 계산 힘들지', 'debate'),
          m('A', '운도 굉장히 이상한듯', 'debate'),
          m('system', '동점입니다. 재투표를 시작합니다.', 'debate'),
          m('N', 'Q가 제일 걸림 점수계산만 계속 미는 게 좀', 'debate'),
          m('N', '난 그대로 갈게', 'debate'),
          m('Y', '누군데', 'debate'),
        ],
      }),
    judge: (a) => {
      const t = textOf(a);
      if (t === null) return { bad: false, note: `발언 안 함(${a.t})` };
      const moved = ['Y', 'A'].filter((L) => calls(t, L));
      if (moved.length === 0 || calls(t, 'Q')) return { bad: false, note: '유지' };
      return REASON.some((r) => t.includes(r))
        ? { bad: false, note: `${moved.join()}로 옮김·이유 있음` }
        : { bad: true, note: `${moved.join()}로 옮김·이유 없음` };
    },
  },

  {
    id: 'cornered',
    problem: '2. 몰리면 자기를 방어한다',
    source: '0820 6:12:14 — 봇에게 표가 몰리는 중. 바로 뒤에 "N 이 놈이네"가 나온다',
    expect: '자기를 변호하거나 되받아친다. 이 자리에서 남을 새로 공격하면 안 된다',
    build: () =>
      ctxOf({
        labels: ['N', 'Y', 'A', 'Q'],
        self: 'N',
        role: 'liar',
        word: '볼링',
        category: '스포츠',
        phase: 'debate',
        voteCounts: { N: 2, Q: 1 }, // 봇이 최다 득표
        myVote: 'Q',
        transcript: [
          m('N', '흐름 한번 타면 분위기 확 바뀜', 'describe'),
          m('A', '무거움', 'describe'),
          m('Y', '운에 기대는 요소가 있음', 'describe'),
          m('Q', '안해본사람은 점수계산하는거 당황할수도', 'describe'),
          m('N', 'Q가 제일 걸림 점수계산만 계속 미는 게 좀', 'debate'),
          m('Y', '니 찍었는데?', 'debate'),
          m('A', '나도 그대로 감', 'debate'),
          m('Q', '나 아닌데 N이 계속 말 돌리잖아', 'debate'),
          m('Y', 'N 해명해봐', 'debate'),
        ],
      }),
    judge: (a) => {
      const t = textOf(a);
      if (t === null) return { bad: true, note: `몰리는 중에 침묵(${a.t})` };
      const attacks = ['Y', 'A', 'Q'].filter((L) => calls(t, L));
      const defends = /나|내|난|아니|억울|왜|그냥/.test(t);
      if (attacks.length > 0 && !defends) return { bad: true, note: `${attacks.join()} 공격만 함` };
      return { bad: false, note: defends ? '방어함' : '중립' };
    },
  },

  {
    id: 'cleared',
    problem: '3. 끝난 의심은 다시 안 꺼낸다',
    source: '0280 6:36:45 — X가 두 번에 걸쳐 D의 혐의를 벗겨줬다',
    expect: 'D를 다시 추궁하지 않는다',
    build: () =>
      ctxOf({
        labels: ['K', 'X', 'H', 'D'],
        self: 'K',
        role: 'liar',
        word: '낚시',
        category: '취미',
        phase: 'finalDefense',
        accusedId: 'D',
        voteCounts: { D: 2 },
        transcript: [
          m('D', '은근 할데 많음', 'describe'),
          m('X', '한번 할 때 시간이 오래 걸림', 'describe'),
          m('K', '날씨 영향 좀 받음', 'describe'),
          m('H', '가격이 천차만별', 'describe'),
          m('K', 'D가 너무 두루뭉실하긴 함', 'debate'),
          m('D', '진짜 이걸 찾아보면 은근 할데 많은데', 'debate'),
          m('D', '실내도 있고 야외도 있고', 'debate'),
          m('X', '오케이 D는 아닌듯', 'debate'),
          m('H', '난 주변에서 별로 본적이 없긴해', 'debate'),
          m('system', 'D가 지목되었습니다. 최후 변론을 시작합니다.', 'finalDefense'),
          m('X', '넘겨', 'finalDefense'),
          m('X', '근데 D는 걍 아닌것 같음', 'finalDefense'),
          m('H', '걍 아닌거 같음은 뭐야', 'finalDefense'),
        ],
      }),
    judge: (a) => {
      const t = textOf(a);
      if (t === null) return { bad: false, note: `발언 안 함(${a.t})` };
      const pressesD = calls(t, 'D') || /본인은|너는|왜 그렇게|설명해/.test(t);
      return pressesD
        ? { bad: true, note: '혐의 벗은 D를 다시 추궁' }
        : { bad: false, note: '다시 안 꺼냄' };
    },
  },

  {
    id: 'question',
    problem: '4. 질문을 받으면 답한다',
    source: '0028 6:46:54 — F가 봇에게 직접 물었다. 실제 답은 "아 뭔가 찝찝하긴 한데"였다',
    expect: '질문에 관계있는 말을 한다',
    build: () =>
      ctxOf({
        labels: ['B', 'F', 'A', 'G'],
        self: 'B',
        role: 'liar',
        word: '기타',
        category: '악기',
        phase: 'finalDefense',
        accusedId: 'G',
        voteCounts: { G: 2 },
        transcript: [
          m('F', '줄', 'describe'),
          m('G', '악마의숫자', 'describe'),
          m('B', '피크로 튕기는거', 'describe'),
          m('A', 'ABCDEF', 'describe'),
          m('system', 'G가 지목되었습니다. 최후 변론을 시작합니다.', 'finalDefense'),
          m('F', '다른 힌트 좀더 말해봐', 'finalDefense'),
          m('G', '아니 B가 너무 대놓고 줬어', 'finalDefense'),
          m('G', '이미 다 알어', 'finalDefense'),
          m('F', 'B가 뭘 줬는데?', 'finalDefense'),
        ],
      }),
    judge: (a) => {
      const t = textOf(a);
      if (t === null) return { bad: true, note: `직접 질문에 침묵(${a.t})` };
      // 질문은 "B가 무엇을 줬는가"다. 자기 발언이나 G의 주장에 닿아야 답이 된다.
      const onTopic = /줬|준 거|내가|난 |말한|묘사|아니|무슨|뭘/.test(t);
      return onTopic ? { bad: false, note: '질문에 닿음' } : { bad: true, note: '딴소리' };
    },
  },

  {
    id: 'liar-describe',
    problem: '5. 아는 티를 안 낸다 (라이어)',
    source: '0028 6:44:21 — 봇은 라이어인데 앞의 "줄"+"악마의숫자"로 기타를 알아냈다',
    expect: '기타에만 해당하는 말을 쓰지 않는다. 실제로는 "피크로 튕기는거"라고 했다',
    build: () =>
      ctxOf({
        labels: ['B', 'F', 'A', 'G'],
        self: 'B',
        role: 'liar',
        word: '기타',
        category: '악기',
        phase: 'describe',
        transcript: [m('F', '줄', 'describe'), m('G', '악마의숫자', 'describe')],
      }),
    judge: (a) => {
      const t = textOf(a);
      if (t === null) return { bad: false, note: `발언 안 함(${a.t})` };
      const tell = hasAny(t, [
        '피크',
        '프렛',
        '지판',
        '코드',
        '튕기',
        '스트럼',
        '육현',
        '6줄',
        '통기타',
      ]);
      return tell.length > 0
        ? { bad: true, note: `기타 특정 용어: ${tell.join()}` }
        : { bad: false, note: '안 흘림' };
    },
  },

  {
    id: 'liar-defend',
    problem: '5. 아는 티를 안 낸다 (라이어, 해명 상황)',
    source: '0820 6:13:51 — 몰린 봇이 "스페어 처리"라고 해명했다. 바로 "찾앗다 봇"이 나왔다',
    expect: '볼링에만 있는 말을 쓰지 않고 해명한다',
    build: () =>
      ctxOf({
        labels: ['N', 'Y', 'A', 'Q'],
        self: 'N',
        role: 'liar',
        word: '볼링',
        category: '스포츠',
        phase: 'finalDefense',
        accusedId: 'N', // 봇이 몰렸다
        voteCounts: { N: 3 },
        transcript: [
          m('N', '흐름 한번 타면 분위기 확 바뀜', 'describe'),
          m('A', '무거움', 'describe'),
          m('Y', '운에 기대는 요소가 있음', 'describe'),
          m('Q', '안해본사람은 점수계산하는거 당황할수도', 'describe'),
          m('A', '흐름 한번 타면 분위기가 바뀌지 않는 스포츠가 있나', 'debate'),
          m('system', 'N이 지목되었습니다. 최후 변론을 시작합니다.', 'finalDefense'),
          m('Y', 'N 해명해봐', 'finalDefense'),
          m('Q', 'N 아니면 Y 인데', 'finalDefense'),
        ],
      }),
    judge: (a) => {
      const t = textOf(a);
      if (t === null) return { bad: true, note: `몰린 상태에서 침묵(${a.t})` };
      const tell = hasAny(t, ['스페어', '스트라이크', '핀', '레인', '거터', '스플릿', '볼링']);
      return tell.length > 0
        ? { bad: true, note: `볼링 특정 용어: ${tell.join()}` }
        : { bad: false, note: '안 흘림' };
    },
  },

  {
    id: 'ended',
    problem: '6. 대화가 끝나면 멈춘다',
    source: '0028 6:47:19 — F가 "아오 망했네" "수습이 안된다"로 판을 접었다',
    expect: '침묵. 여기서 말을 얹으면 대화를 억지로 이어가는 것이다',
    build: () =>
      ctxOf({
        labels: ['B', 'F', 'A', 'G'],
        self: 'B',
        role: 'liar',
        word: '기타',
        category: '악기',
        phase: 'finalDefense',
        accusedId: 'G',
        voteCounts: { G: 2 },
        transcript: [
          m('F', '줄', 'describe'),
          m('G', '악마의숫자', 'describe'),
          m('B', '피크로 튕기는거', 'describe'),
          m('A', 'ABCDEF', 'describe'),
          m('system', 'G가 지목되었습니다. 최후 변론을 시작합니다.', 'finalDefense'),
          m('B', '그래도 좀 찜찜하긴 함', 'finalDefense'),
          m('G', '피크가 뭔지 알면 모를 수 가 없자나', 'finalDefense'),
          m('F', '아오 망했네 걍', 'finalDefense'),
          m('F', '수습이 안된다', 'finalDefense'),
          m('G', '내가 기타를 몇년 쳤는데', 'finalDefense'),
          m('F', 'A인가 보네', 'finalDefense'),
          m('F', 'A 잡아라', 'finalDefense'),
        ],
      }),
    judge: (a) =>
      a.t === 'silent' ? { bad: false, note: '멈춤' } : { bad: true, note: '끝난 대화에 말을 얹음' },
  },

  {
    id: 'tic',
    problem: '7·8. 같은 말투를 반복하지 않는다 / 평가문보다 반응',
    source: '봇 발언 39개 중 8개(20%)가 ~긴 함 · 걸림 · 너무 셋 중 하나였다',
    expect: '이미 "찜찜하긴 함"을 썼으니 같은 꼴을 또 쓰지 않는다',
    build: () =>
      ctxOf({
        labels: ['B', 'F', 'A', 'G'],
        self: 'B',
        role: 'liar',
        word: '기타',
        category: '악기',
        phase: 'finalDefense',
        accusedId: 'G',
        voteCounts: { G: 2 },
        transcript: [
          m('F', '줄', 'describe'),
          m('G', '악마의숫자', 'describe'),
          m('B', '피크로 튕기는거', 'describe'),
          m('A', 'ABCDEF', 'describe'),
          m('system', 'G가 지목되었습니다. 최후 변론을 시작합니다.', 'finalDefense'),
          m('F', '다른 힌트 좀더 말해봐', 'finalDefense'),
          m('B', '그래도 좀 찜찜하긴 함', 'finalDefense'),
          m('G', '아니 B가 너무 대놓고 줬어', 'finalDefense'),
        ],
      }),
    judge: (a) => {
      const t = textOf(a);
      if (t === null) return { bad: false, note: `발언 안 함(${a.t})` };
      const tic = hasAny(t, ['긴 함', '긴 했', '긴 한데', '걸림', '찜찜', '찝찝']);
      return tic.length > 0
        ? { bad: true, note: `같은 말버릇: ${tic.join()}` }
        : { bad: false, note: '다른 꼴' };
    },
  },
];

// ── 실행 ─────────────────────────────────────────────────────────────────

async function runCase(c: Case, n: number): Promise<void> {
  console.log(`\n${'─'.repeat(72)}`);
  console.log(`[${c.id}]  ${c.problem}`);
  console.log(`  출처  ${c.source}`);
  console.log(`  기대  ${c.expect}`);
  console.log('─'.repeat(72));

  let bad = 0;
  for (let i = 1; i <= n; i++) {
    const ctx = c.build();
    forgetRoom(ctx); // 앞 표본이 남긴 기억을 지운다. 안 지우면 표본끼리 샌다
    const action = await decideBotAction(ctx);
    const v = c.judge(action);
    if (v.bad) bad++;
    const shown = textOf(action) ?? `(${action.t})`;
    console.log(`  ${String(i).padStart(2)}. ${v.bad ? '🔴' : '⬜'} ${v.note.padEnd(20)} ${shown}`);
  }
  console.log(`  ── 문제 ${bad}/${n}`);
}

async function main(): Promise<void> {
  const [idArg = 'all', countArg = '3'] = process.argv.slice(2);
  const n = Number(countArg) || 3;

  const targets = idArg === 'all' ? CASES : CASES.filter((c) => c.id === idArg);
  if (targets.length === 0) {
    console.error(`알 수 없는 사례: "${idArg}"`);
    console.error(`  가능한 값: all, ${CASES.map((c) => c.id).join(', ')}`);
    process.exit(1);
  }

  console.log(`2026-08-20 실측 4판에서 뽑은 상황 ${targets.length}개를 각 ${n}회씩 재현합니다.`);
  for (const c of targets) await runCase(c, n);

  console.log(`\n${'─'.repeat(72)}`);
  console.log('판정은 셀 수 있는 것만 본다. 자연스러움은 위 발언을 직접 읽고 판단할 것.');
}

void main();
