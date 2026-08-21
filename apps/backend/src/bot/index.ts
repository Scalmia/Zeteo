import type { BotAction, BotContext, DecideBotAction } from '@zeteo/shared-types';
import {
  debatePrompt,
  describePrompt,
  finalDefensePrompt,
  guessWordPrompt,
  systemPrompt,
} from './prompts';
import { generate, type GenerateOptions } from './llm';

/**
 * 아직 투표하지 않았을 때 입을 열 확률. 나머지는 그 자리에서 투표한다.
 * 발언 횟수를 세지 않고 확률로 정하는 이유는 두 가지다.
 *   1. transcript는 게임 전체 누적이라 "이번 라운드 발언 수"를 셀 수단이 계약에 없다.
 *   2. 매 라운드 발언 수가 똑같으면 그 균일함 자체가 봇 티가 된다(기획서 §6).
 * 라운드 판정은 ctx.myVote로 한다. 서버가 라운드마다 votes를 비우므로 자연히 라운드 스코프다.
 */
const CHAT_BEFORE_VOTE_CHANCE = 0.7;
/** 투표를 마친 뒤 다시 호출됐을 때 입을 열 확률. 나머지는 침묵. */
const CHAT_AFTER_VOTE_CHANCE = 0.4;
/** 남의 최후 변론을 지켜볼 때 입을 열 확률. 여긴 투표가 없어 이 값이 유일한 제동이다. */
const CHAT_IN_FINAL_DEFENSE_CHANCE = 0.35;
/**
 * 내가 지목당해 변론하는 중일 때 입을 열 확률.
 * 남을 심문할 때와 같은 값을 쓰면 자기 목숨이 걸린 자리에서 8번 중 1번만 말한다(실측).
 * 몰아붙이는데 대꾸를 안 하는 쪽이 훨씬 이상하므로 훨씬 높게 잡는다.
 */
const CHAT_AS_ACCUSED_CHANCE = 0.7;
/**
 * 남을 기다리는 동안에도 표를 던질 확률.
 * 지목한 상대를 기다리느라 침묵만 하다 투표를 통째로 거르는 일이 있었다(실측 10회 중 0표).
 * 투표는 집계만 공개되고 채팅에는 드러나지 않아, 침묵을 유지한 채로도 할 수 있다.
 */
const VOTE_WHILE_WAITING_CHANCE = 0.25;
/** 내가 마지막으로 말한 뒤 아무도 입을 안 열 때, 이만큼 지나면 먼저 말을 꺼내도 된다. */
const IDLE_BREAK_MS = 20000;
/**
 * 한 문장을 두 번에 나눠 보낼 확률.
 *
 * 실전 로그에서 사람들은 한 문장을 문법 중간에서 끊어 연달아 보냈다.
 *   "그건 당신이" → "무지하기 때문이다"
 *   "B의 동물원에서 인기많음" → "이란 발언은" → "범위가 넓다 생각한다"
 * 봇은 연속으로 두 번 말할 때조차 각각을 완결된 문장으로 냈다.
 *
 * 뒷말을 LLM에게 다시 만들게 하지 않는다. 생성에 5~6초가 걸려 앞 조각이 그만큼
 * 매달려 있게 되고, 이어지는 내용이 어긋날 수도 있다. 완성 문장을 한 번에 받아
 * 코드가 자르면 이어짐이 보장되고 조각 사이 간격도 우리가 정한다.
 */
const SPLIT_CHANCE = 0.4;
/** 이보다 짧으면 자르지 않는다. 짧은 반응을 쪼개면 말이 안 된다. */
const MIN_SPLIT_LENGTH = 14;
/**
 * 맨 앞에 덜렁 붙은 라벨을 떼어낼 확률.
 *
 * 실전 피드백이 "대문자 알파벳 + 띄어쓰기 + 의견 같이 딱딱하고 형식적"이었고,
 * 1대1 테스트에서 봇 발언 7개가 전부 상대 라벨로 시작했다.
 * 사람은 섞어 쓴다 — 방금 말한 사람에겐 그냥 받아치고, 한참 전 얘기를 꺼낼 때만 이름을 붙인다.
 *
 * 항상 떼면 그것대로 규칙적이라 확률로 둔다. 모델이 이름을 붙일 자유는 남겨둔다.
 */
const DROP_LEADING_LABEL_CHANCE = 0.7;

/**
 * 사람은 읽고 · 생각하고 · 타이핑하는 데 시간이 걸린다.
 * 봇이 즉시 응답하면 그 자체로 정체가 드러나므로 발언 길이에 비례한 시간을 목표로 잡는다.
 *
 * 이 값은 "발언이 화면에 뜨기까지의 총 시간" 목표다. 모델이 쓴 시간을 여기서 빼기 때문에,
 * 목표가 모델 응답 시간(5~6초)보다 작으면 지연이 늘 0이 되어 아무 효과가 없다.
 * 1판 실측에서 봇이 5~6초 간격으로 말해 "폭주한다"는 반응이 나왔으므로 10초 안팎을 노린다.
 *
 * 기준값이 3000이던 동안에는 이 목표가 지켜지지 않았다. 두세 글자짜리 발언은 3.9~5.9초를
 * 목표로 잡는데 모델이 그만큼을 이미 써버려, 빼고 나면 0이 됐다. 그런데 말투 규칙은
 * "절반은 두세 글자로 끝내라"고 지시한다 — 짧게 말하라고 시켜놓고 짧은 말에는 지연이
 * 안 걸리는 구조였다. 가장 짧은 발언도 목표가 모델 응답 시간을 넘도록 기준값을 올린다.
 */
function humanDelay(text: string): number {
  return Math.round(7000 + text.length * 300 + Math.random() * 2000);
}


/**
 * guessWord 한 번에 허용하는 토큰.
 *
 * Anthropic 프로토콜에서 max_tokens는 본문과 사고의 합이다. 여기는 effort를 가장 높게
 * 켜는 자리인데 200을 주고 있어서, 200을 사고에 전부 쓰고 본문이 0개로 돌아왔다.
 * 예외가 아니라 정상 응답이라 에러 로그도 안 남아, 매번 주제명을 답으로 내는 것이
 * 오래 보이지 않았다. 답은 단어 하나지만 그 앞에 사고가 들어가므로 넉넉히 잡는다.
 */
const GUESS_WORD_MAX_TOKENS = 4096;

/** 침묵을 고른 뒤 서버가 다시 물어보기까지의 간격. 이 값이 0이면 서버가 즉시 되물어 루프가 폭주한다. */
function silentDelay(): number {
  return Math.round(3000 + Math.random() * 4000);
}

/**
 * 끊어 보낸 뒷말까지의 간격.
 *
 * 실전 로그에서 같은 사람이 연달아 보낸 간격 30건을 세어보니 중앙값이 4초였고,
 * 1~2초는 7건(23%)뿐이었다. 머릿속에 있던 말이라도 치는 데는 시간이 걸린다.
 * 3~6초가 전체의 절반을 넘어 그 구간에 맞춘다.
 */
function tailDelay(): number {
  return Math.round(3000 + Math.random() * 3000);
}

/**
 * 사람이 실제로 끊었던 자리를 흉내낸다. 로그의 세 사례가 전부 조사 뒤였다.
 *   "그건 당신이"(이) · "이란 발언은"(은) · "이 제시어 정답은"(은)
 * 연결어미도 같은 자리로 쓴다.
 */
const CUT_SUFFIXES = [
  '은', '는', '이', '가', '을', '를', '도', '만', '의', '에', '로', '와', '과', '랑',
  '에서', '으로', '이란', '라는', '부터', '까지', '처럼', '보다',
  '고', '서', '면', '는데', '니까', '지만', '다가', '거든',
];

/**
 * 문장을 두 조각으로 자른다. 자를 만한 자리가 없으면 null — 그때는 통째로 내보낸다.
 * 양쪽이 다 어느 정도 길이가 되는 자리 중 문장 가운데에 가장 가까운 곳을 고른다.
 */
function splitPoint(text: string): [string, string] | null {
  const words = text.split(' ').filter((w) => w.length > 0);
  if (words.length < 3) return null;

  const mid = text.length / 2;
  let best: number | null = null;
  let bestDist = Infinity;

  for (let i = 0; i < words.length - 1; i++) {
    if (!CUT_SUFFIXES.some((s) => words[i]!.endsWith(s))) continue;
    const head = words.slice(0, i + 1).join(' ');
    const tail = words.slice(i + 1).join(' ');
    if (head.length < 4 || tail.length < 4) continue;

    const dist = Math.abs(head.length - mid);
    if (dist < bestDist) {
      best = i;
      bestDist = dist;
    }
  }

  if (best === null) return null;
  return [words.slice(0, best + 1).join(' '), words.slice(best + 1).join(' ')];
}

/**
 * 자르고 남은 뒷말을 다음 호출까지 들고 있는다.
 *
 * decideBotAction은 상태가 없으므로 여기 담아둔다. 앞 조각을 함께 저장해서,
 * 다음 호출 때 "내 마지막 발언"이 그 조각과 정확히 같을 때만 이어 붙인다.
 * 엉뚱한 판이나 엉뚱한 시점에 붙는 것을 이 대조가 막는다.
 *
 * 뒷말이 끝내 안 나가면 앞 조각만 남는데, 쓰다 말고 안 보내는 것도 사람이 하는 짓이라
 * 실패해도 크게 이상하지 않다.
 */
const pendingTails = new Map<string, { head: string; tail: string }>();

/** 라벨은 매 판 새로 배정되므로, 여기에 selfId를 붙이면 판을 구분하는 열쇠가 된다. */
function roomKey(ctx: BotContext): string {
  return `${ctx.selfId}|${ctx.players.map((p) => p.label).join('')}`;
}

function takePendingTail(ctx: BotContext): string | null {
  const entry = pendingTails.get(roomKey(ctx));
  if (entry === undefined) return null;

  const mine = ctx.transcript.filter((m) => m.phase === ctx.phase && m.speakerId === ctx.selfId);
  const last = mine[mine.length - 1];
  if (last === undefined || last.text !== entry.head) return null;

  pendingTails.delete(roomKey(ctx));
  return entry.tail;
}

/**
 * 이번 발언이 누구를 겨냥했는지 적어둔다.
 *
 * 맨 앞 라벨을 떼어내면 텍스트만 봐서는 대상을 알 수 없다. 그런데 "지목한 상대가 답할 때까지
 * 기다린다"는 규칙이 그 대상을 필요로 한다. 그래서 떼어내기 전에 모델이 고른 대상을 붙잡아 둔다.
 *
 * 대상을 코드가 미리 정해 프롬프트에 넣는 방법도 있지만, 그러면 판단 로직이 하나 늘고
 * 프롬프트가 길어져 응답이 느려진다. 모델이 이미 내린 결정을 주워 담는 편이 싸다.
 */
const lastTargets = new Map<string, { text: string; targetId: string }>();

/** 겨냥한 상대를 떠올린다. 적어둔 게 없거나 어긋나면 예전처럼 텍스트를 뒤진다. */
function recallTarget(ctx: BotContext, myLastText: string): string | null {
  const entry = lastTargets.get(roomKey(ctx));
  if (entry !== undefined && entry.text === myLastText) return entry.targetId;
  return addressedPlayer(ctx, myLastText);
}

/**
 * 지금 화살이 나를 향해 있는지 본다. 표와 말, 두 갈래로 나눠 본다.
 *
 * 사람은 자기가 몰리는 걸 알면 하던 일을 멈추고 자기 얘기를 한다. 봇에게는 그 개념이 없어서
 * 표가 자기한테 쏠린 순간에도 남을 파고들었다(0820 6:12:24, "A가 제일 걸림"). 바로 다음 줄이
 * "니 찍었는데?" → "N 이 놈이네"였다. 설문에 "몰리고 있는데 변호는 안하고 남 공격만 함"으로 적혔다.
 *
 * 두 신호를 따로 두는 이유는 서로 다른 자리에서 켜지기 때문이다. 표는 토론에서 쌓이고,
 * 이름을 부르는 것은 최후 변론처럼 표가 없는 자리에서도 일어난다. 0028에서 "B가 뭘 줬는데?"라고
 * 직접 물었을 때 봇이 딴소리를 한 것은 두 번째 신호가 없어서였다.
 */
function underFire(ctx: BotContext): boolean {
  const mine = ctx.voteCounts[ctx.selfId] ?? 0;
  if (mine === 0) return false;
  // 동점도 몰린 것으로 센다. 동점이면 재투표라 위험이 사라진 게 아니다.
  return mine >= Math.max(...Object.values(ctx.voteCounts));
}

/** 내가 마지막으로 말한 뒤로 남이 내 이름을 불렀는가. */
function calledOnMe(ctx: BotContext): boolean {
  const myLabel = ctx.players.find((p) => p.id === ctx.selfId)?.label;
  if (myLabel === undefined) return false;

  const inPhase = ctx.transcript.filter((m) => m.phase === ctx.phase);
  const since = inPhase.slice(inPhase.map((m) => m.speakerId).lastIndexOf(ctx.selfId) + 1);
  const named = new RegExp(`(^|[^A-Za-z])${myLabel}([^A-Za-z]|$)`);
  return since.some((m) => m.speakerId !== ctx.selfId && m.speakerId !== 'system' && named.test(m.text));
}

/** 표든 말이든 나를 향해 있으면 참이다. 이때는 발화 확률을 건너뛴다. */
function pressured(ctx: BotContext): boolean {
  return underFire(ctx) || calledOnMe(ctx);
}

/**
 * 이 방에 대해 기억해 둔 것을 지운다.
 *
 * pendingTails·lastTargets는 판이 끝나도 안 지워져서 프로세스가 사는 동안 계속 쌓인다.
 * 방 하나에 항목 둘이라 실사용에서 문제될 크기는 아니지만, 같은 상황을 되풀이해 잴 때는
 * 앞 표본이 뒤 표본으로 새는 통로가 된다 — 끊어 보낸 뒷말이 다음 표본에서 튀어나오거나,
 * 앞 표본이 지목한 상대가 다음 표본의 입장으로 잡힌다.
 */
export function forgetRoom(ctx: BotContext): void {
  pendingTails.delete(roomKey(ctx));
  lastTargets.delete(roomKey(ctx));
}

/**
 * 입으로 지목해 둔 상대의 라벨. 표(ctx.myVote)와 다른 것을 본다.
 *
 * 서버는 동점이 나면 room.votes를 비우고 재투표를 돌린다. 표를 기준으로 삼으면 그 순간
 * 봇이 방금 누구를 지목했는지 잊어버린다. 입으로 한 말은 서버가 안 지우므로 이쪽이 남는다.
 *
 * isAlive 필터는 지금 흐름에서 아무것도 거르지 않는다. 처형이 확정되면 곧바로 reveal로
 * 넘어가 게임이 끝나고(stateMachine.ts), 토론으로 돌아오는 유일한 경로인 "살린다"에서는
 * 아무도 죽지 않기 때문이다. vote.ts가 같은 사실을 이미 적어두고 있다.
 * 그래도 두는 이유는 "죽은 사람 쪽으로 기울어 있지 않는다"가 이 함수의 계약이기 때문이지,
 * 지금 그런 상황이 생겨서가 아니다.
 */
function declaredSuspectLabel(ctx: BotContext): string | null {
  const entry = lastTargets.get(roomKey(ctx));
  if (entry === undefined) return null;
  const p = ctx.players.find((pl) => pl.id === entry.targetId);
  return p !== undefined && p.isAlive ? p.label : null;
}

/** 끊어 보낸 뒷말이 나가면 내 마지막 발언이 그 뒷말로 바뀐다. 겨냥 기록도 따라 옮긴다. */
function carryTarget(ctx: BotContext, tail: string): void {
  const entry = lastTargets.get(roomKey(ctx));
  if (entry !== undefined) lastTargets.set(roomKey(ctx), { text: tail, targetId: entry.targetId });
}

/**
 * 맨 앞에 라벨만 덜렁 붙은 형태를 확률적으로 떼어낸다.
 *
 * 조사가 붙은 것("W가 먼저", "W는 근데")은 문장 성분이라 떼면 말이 깨진다. 건드리지 않는다.
 * 그리고 직전에 말한 사람을 겨냥했을 때만 뗀다 — 한참 전에 말한 사람이면 이름이 빠지는 순간
 * 누구 얘긴지 정말 알 수 없어진다. 사람도 그 경우엔 이름을 붙인다.
 */
function maybeDropLeadingLabel(ctx: BotContext, text: string, target: string | null): string {
  if (target === null) return text;

  const label = ctx.players.find((p) => p.id === target)?.label;
  if (label === undefined || !text.startsWith(`${label} `)) return text;

  const spoken = ctx.transcript.filter((m) => m.phase === ctx.phase && m.speakerId !== 'system');
  const last = spoken[spoken.length - 1];
  if (last === undefined || last.speakerId !== target) return text;

  if (Math.random() >= DROP_LEADING_LABEL_CHANCE) return text;
  return text.slice(label.length + 1).trim();
}

/**
 * 묘사 턴에서 쓸 만한 발언을 못 만들었을 때 대신 내보낼 말.
 * 제시어를 흘리지 않으면서 사람이 실제로 칠 법한 문장이라야 한다.
 *
 * 넷뿐이라 자주 쓰이면 같은 말이 되풀이되는 것이 눈에 띈다. 실제로 "가끔 똑같은 말을
 * 반복한다"는 반응이 나왔고, 원인은 생성 실패 세 갈래가 전부 여기로 모이던 것이었다.
 * 지금은 이리로 오는 경로가 묘사 턴 하나뿐이다 — 침묵할 수 있는 자리에서는 침묵을 고른다.
 * isEcho는 이 반복을 못 잡는다. 넷 중 다른 걸 뽑으면 다른 말로 보이기 때문이다.
 */
const FALLBACK_LINES = ['음 뭐라 해야 하지', '아 이거 설명하기 좀 그런데', '잠깐만', '음… 애매하네'];

function fallbackLine(): string {
  return FALLBACK_LINES[Math.floor(Math.random() * FALLBACK_LINES.length)]!;
}

/**
 * 발언에서 이름을 부른 상대를 찾는다. 라벨이 알파벳 한 글자라 낱말 경계를 따져야
 * "OK" 같은 단어 속 글자를 라벨로 잘못 읽지 않는다.
 */
function addressedPlayer(ctx: BotContext, text: string): string | null {
  for (const p of ctx.players) {
    if (p.id === ctx.selfId) continue;
    if (new RegExp(`(^|[^A-Za-z])${p.label}([^A-Za-z]|$)`).test(text)) return p.id;
  }
  return null;
}

/**
 * 지금 입을 열어도 되는 상황인지 본다.
 *
 * 서버는 봇이 말할 때마다 곧바로 다시 물어보기 때문에, 아무 제동이 없으면 봇 혼자
 * 대화를 도배한다(1판 실측: 봇 17회 대 사람 넷 합쳐 9회, "폭주하네" 소리를 들었다).
 * 사람은 남이 말을 얹어야 반응하므로, 내 마지막 발언 뒤에 남이 아무 말도 안 했으면 기다린다.
 *
 * 누군가를 지목했다면 조건이 더 좁아진다. 그 사람이 답하기도 전에 딴 사람을 파고들면
 * 공격 논리를 몇 초 만에 갈아치우는 셈이라 사람으로 보이지 않는다(2판 연속 지적됨).
 * 그래서 이름을 부른 상대가 있으면 아무나가 아니라 그 사람의 대답을 기다린다.
 *
 * 다만 정말 아무도 말이 없는 정적이 길어지면 사람도 먼저 운을 떼므로 그때는 풀어준다.
 */
function shouldWaitForOthers(ctx: BotContext): boolean {
  const inPhase = ctx.transcript.filter((m) => m.phase === ctx.phase);
  if (inPhase.length === 0) return false;

  const lastMine = inPhase.map((m) => m.speakerId).lastIndexOf(ctx.selfId);
  if (lastMine === -1) return false; // 이 단계에서 아직 한 마디도 안 했다

  const sinceMine = inPhase.slice(lastMine + 1);
  const addressed = recallTarget(ctx, inPhase[lastMine]!.text);

  const answered =
    addressed === null
      ? sinceMine.some((m) => m.speakerId !== ctx.selfId && m.speakerId !== 'system')
      : sinceMine.some((m) => m.speakerId === addressed);
  if (answered) return false;

  const last = inPhase[inPhase.length - 1]!;
  return Date.now() - last.at < IDLE_BREAK_MS;
}

/**
 * 발언 하나를 만들고, 서버가 출력 전에 기다릴 시간을 함께 돌려준다.
 *
 * 서버는 delayMs만큼 기다린 뒤 발언을 게임에 넣는다(대기 후 출력). 그래서 모델이
 * 이미 써버린 시간을 humanDelay 목표치에서 빼야 총 소요 시간이 일정해진다.
 * 빼지 않으면 모델 응답 시간에 지연이 그대로 더해져 사람보다 느려지고,
 * 반대로 추론을 끄면 즉답이 되어 티가 난다.
 *
 * 쓸 만한 말을 못 만들면 text가 null이다. 그때 무엇을 내보낼지는 부르는 쪽이 정한다.
 * 토론에선 침묵할 수 있지만 묘사에선 침묵이 턴을 통째로 넘겨버리므로 선택지가 다르다.
 * 예전에는 여기서 고정 문구로 대신했는데 그 문구가 넷뿐이라, 실제 게임 중에 같은 말이
 * 반복돼 나오는 것으로 드러났다.
 *
 * 옵션을 그대로 넘겨받는 이유는, 이걸 못 받던 동안 옵션이 필요한 guessWord가 이 함수를
 * 통째로 우회해 제시어 유출 검사조차 안 받고 있었기 때문이다.
 *
 * 여기서 예외를 삼키지 않으면 서버가 void로 띄워둔 호출에서 unhandled rejection이 나
 * 프로세스가 내려갈 수 있다. 봇 하나 때문에 방 전체가 죽어선 안 된다.
 */
async function speak(
  ctx: BotContext,
  prompt: string,
  opts?: GenerateOptions,
): Promise<{ text: string | null; delayMs: number }> {
  const started = Date.now();
  // 모델이 목표 시간을 이미 다 썼으면 더 안 기다린다. 그 경우 총 소요 시간은 이미 사람만큼
  // 길어서 더 붙일 이유가 없고, 묘사 턴은 20초에 끊기므로 남은 여유를 깎으면 턴을 통째로 잃는다.
  const wait = (t: string): number => Math.max(0, humanDelay(t) - (Date.now() - started));

  let text = await generateOrEmpty(ctx, prompt, opts);

  // 프롬프트로 금지해도 모델이 제시어를 그대로 말하거나, 답 대신 사고 과정을 뱉는 일이
  // 실제로 벌어졌다. 둘 다 그대로 내보내면 그 판이 끝나므로 규칙에만 맡기지 않고
  // 생성 결과를 직접 확인한다. 한 번 더 시켜보고 그래도 걸리면 버린다.
  //
  // 빈 응답도 여기서 걸러 로그를 남긴다. 토큰 한도가 모자라 사고에 전부 쓰고 본문이
  // 0개로 돌아오는 일이 실제로 있었는데, 예외가 아니라 정상 응답이라 아무 흔적도 안 남았다.
  const rejected = (t: string): string | null => {
    if (t.length === 0) return '빈 응답';
    if (leaksWord(ctx, t)) return '제시어 유출';
    if (looksInvalid(t)) return '채팅 한 줄이 아님';
    return null;
  };

  let reason = rejected(text);
  if (reason !== null) {
    console.warn(`[bot] ${reason} 감지, 재생성:`, text);
    text = await generateOrEmpty(ctx, prompt, opts);
    reason = rejected(text);
    if (reason !== null) {
      console.warn(`[bot] 재생성도 ${reason} — 발언을 버린다:`, text);
      return { text: null, delayMs: wait('') };
    }
  }

  return { text, delayMs: wait(text) };
}

function leaksWord(ctx: BotContext, text: string): boolean {
  return ctx.word !== null && ctx.word.length > 0 && text.includes(ctx.word);
}

/**
 * 모델이 답 대신 자기 사고 과정을 그대로 뱉는 일이 실제로 있었다(영어 여러 줄).
 * 그게 채팅창에 올라가면 그 순간 정체가 드러나므로, 채팅 한 줄로 보기 어려운 건 버린다.
 * 라벨이 알파벳 한 글자라 영문이 조금 섞이는 것 자체는 정상이다.
 */
function looksInvalid(text: string): boolean {
  if (text.length > 80) return true;
  if (/[\r\n]/.test(text)) return true;
  return (text.match(/[A-Za-z]/g) ?? []).length > 8;
}

async function generateOrEmpty(
  ctx: BotContext,
  prompt: string,
  opts?: GenerateOptions,
): Promise<string> {
  try {
    return await generate(systemPrompt(ctx), prompt, opts);
  } catch (err) {
    console.error('[bot] 발화 생성 실패:', err instanceof Error ? err.message : err);
    return '';
  }
}

/** 공백과 문장부호를 걷어내고 견준다. "죽여"와 "죽여!"를 같은 말로 보기 위한 것이다. */
function normalizeText(text: string): string {
  return text.replace(/[\s?!.,~…"']/g, '');
}

/**
 * 이 단계에서 이미 한 말과 같은 말인지 본다.
 *
 * 프롬프트로 두 번 막아봤지만 모델은 같은 결론을 계속 되풀이했다("죽여" 3연발).
 * 사람은 같은 말을 세 번 하지 않으므로, 규칙이 아니라 코드로 걸러낸다.
 */
function isEcho(ctx: BotContext, text: string): boolean {
  const now = normalizeText(text);
  if (now.length < 2) return false;

  return ctx.transcript
    .filter((m) => m.phase === ctx.phase && m.speakerId === ctx.selfId)
    .map((m) => normalizeText(m.text))
    .some((prev) => prev.length >= 2 && (prev.includes(now) || now.includes(prev)));
}

/**
 * 발언을 만들되, 이미 한 말이면 입을 다문다.
 * 다시 생성시키지 않는 이유는 같은 상황에서 같은 답이 또 나올 뿐이기 때문이다.
 */
async function chatOrSilent(ctx: BotContext, prompt: string): Promise<BotAction> {
  const { text: raw, delayMs } = await speak(ctx, prompt);

  // 쓸 만한 말을 못 만들었으면 침묵한다. 토론과 최후 변론에선 침묵이 정상 행동이라
  // 고정 문구로 때울 이유가 없다. 오히려 같은 문구가 되풀이되는 쪽이 봇 티가 난다.
  if (raw === null) return { t: 'silent', delayMs: silentDelay() };

  // 대상은 떼어내기 전에 잡아둔다. 떼고 나면 텍스트에서 알아낼 방법이 없다.
  const target = addressedPlayer(ctx, raw);
  const text = maybeDropLeadingLabel(ctx, raw, target);

  if (isEcho(ctx, text)) {
    console.warn('[bot] 같은 말 반복 감지, 침묵으로 대체:', text);
    return { t: 'silent', delayMs: silentDelay() };
  }

  let emitted = text;
  if (text.length >= MIN_SPLIT_LENGTH && Math.random() < SPLIT_CHANCE) {
    const parts = splitPoint(text);
    if (parts !== null) {
      pendingTails.set(roomKey(ctx), { head: parts[0], tail: parts[1] });
      emitted = parts[0];
    }
  }

  if (target !== null) lastTargets.set(roomKey(ctx), { text: emitted, targetId: target });
  return { t: 'chat', text: emitted, delayMs };
}

/**
 * 최다 득표자에게 투표(밴드왜건). 자기 자신과 사망자는 후보에서 제외하고,
 * 아무도 표가 없으면 무작위, 동점이면 그중 무작위.
 *
 * 사망자 제외는 계약이지 실제로 걸리는 경우가 아니다 — 토론 중에는 늘 전원이 살아있다.
 * 이 주석이 없던 동안 "토론에 죽은 사람이 있을 수 있다"고 읽고 그대로 따라 쓴 적이 있다.
 * 근거는 vote.ts의 같은 설명을 볼 것.
 */
function bandwagonTarget(ctx: BotContext): string | null {
  const others = ctx.players.filter((p) => p.id !== ctx.selfId && p.isAlive);
  if (others.length === 0) return null;

  const counted = others
    .map((p) => [p.id, ctx.voteCounts[p.id] ?? 0] as const)
    .filter(([, n]) => n > 0);
  if (counted.length === 0) {
    return others[Math.floor(Math.random() * others.length)]!.id;
  }

  const maxVotes = Math.max(...counted.map(([, n]) => n));
  const top = counted.filter(([, n]) => n === maxVotes).map(([id]) => id);
  return top[Math.floor(Math.random() * top.length)]!;
}

/**
 * 단독 1위가 있을 때만 그 id를 준다. 동점이면 null.
 * 재투표 판단에 쓰는데, 동점에서도 움직이면 표가 갈릴 때마다 지목을 번복하게 된다.
 */
function clearLeader(ctx: BotContext): string | null {
  const counted = ctx.players
    .filter((p) => p.id !== ctx.selfId && p.isAlive)
    .map((p) => [p.id, ctx.voteCounts[p.id] ?? 0] as const)
    .filter(([, n]) => n > 0);
  if (counted.length === 0) return null;

  const maxVotes = Math.max(...counted.map(([, n]) => n));
  const top = counted.filter(([, n]) => n === maxVotes);
  return top.length === 1 ? top[0]![0] : null;
}

/**
 * ★ 파트 A가 파트 B에게 요구하는 것의 전부.
 *   A는 이 함수 내부를 몰라도 되고, B는 서버 구조를 몰라도 된다.
 */
export const decideBotAction: DecideBotAction = async (ctx: BotContext): Promise<BotAction> => {
  switch (ctx.phase) {
    case 'describe': {
      const { text, delayMs } = await speak(ctx, describePrompt(ctx));
      // 대체 문구를 쓰는 자리는 여기 하나뿐이다. 묘사에서 침묵하면 자기 턴을 통째로 넘겨
      // 혼자 아무 말 없이 지나간 참가자가 되는데, 그게 고정 문구보다 더 눈에 띈다.
      return { t: 'describe', text: text ?? fallbackLine(), delayMs };
    }

    /**
     * 최후 변론엔 투표가 없어 루프를 끊을 액션이 없다. 여기서 chat만 돌려주면
     * 제한시간 내내 혼자 말하게 되므로(1판 실측 10연속), 침묵이 유일한 제동이다.
     */
    case 'finalDefense': {
      // 끊어 보낸 뒷말이 있으면 그것부터. 자기 말을 잇는 것이라 대기 규칙을 건너뛴다.
      const tail = takePendingTail(ctx);
      if (tail !== null) {
        carryTarget(ctx, tail);
        return { t: 'chat', text: tail, delayMs: tailDelay() };
      }

      const amAccused = ctx.accusedId === ctx.selfId;
      const chance = amAccused ? CHAT_AS_ACCUSED_CHANCE : CHAT_IN_FINAL_DEFENSE_CHANCE;
      // 내 이름을 부르며 물었으면 확률을 건너뛴다. 사람은 자기를 부르는 질문에 답한다.
      // 실측(0028 6:46:54) "B가 뭘 줬는데?"에 봇은 딴소리를 했고, 재현에서는 5번 중 4번 침묵했다.
      if (!calledOnMe(ctx) && (shouldWaitForOthers(ctx) || Math.random() >= chance)) {
        return { t: 'silent', delayMs: silentDelay() };
      }
      return chatOrSilent(ctx, finalDefensePrompt(ctx, calledOnMe(ctx)));
    }

    /** 서버는 토론 제한시간이 끝날 때까지 이 함수를 반복 호출한다. 매번 하나만 고른다. */
    case 'debate': {
      const tail = takePendingTail(ctx);
      if (tail !== null) {
        carryTarget(ctx, tail);
        return { t: 'chat', text: tail, delayMs: tailDelay() };
      }

      /**
       * 나를 향해 있으면 기다리지도, 확률을 굴리지도 않는다.
       *
       * 실측(0820)에서 봇은 표가 자기한테 몰린 채로 세 번 침묵했다. 투표를 마친 뒤 발화 확률이
       * 0.4로 떨어지는데, 그 확률이 몰렸는지 여부를 안 보기 때문이다. 몰린 사람이 입을 다무는 것은
       * 사람의 행동이 아니라서, 여기서는 확률 자체를 건너뛴다.
       */
      if (pressured(ctx)) {
        return chatOrSilent(ctx, debatePrompt(ctx, declaredSuspectLabel(ctx), true));
      }

      if (shouldWaitForOthers(ctx)) {
        // 입은 다물되 표는 던질 수 있다. 이게 없으면 기다리기만 하다 기권으로 끝난다.
        if (ctx.myVote === null && Math.random() < VOTE_WHILE_WAITING_CHANCE) {
          return { t: 'vote', targetId: bandwagonTarget(ctx) };
        }
        return { t: 'silent', delayMs: silentDelay() };
      }

      if (ctx.myVote === null) {
        if (Math.random() < CHAT_BEFORE_VOTE_CHANCE) {
          return chatOrSilent(ctx, debatePrompt(ctx, declaredSuspectLabel(ctx)));
        }
        return { t: 'vote', targetId: bandwagonTarget(ctx) };
      }

      // 서버가 표를 덮어쓰므로 갈아탈 수 있다. 판세가 한 명에게 확실히 쏠렸을 때만 움직인다.
      const leader = clearLeader(ctx);
      if (leader !== null && leader !== ctx.myVote) {
        return { t: 'vote', targetId: leader };
      }

      if (Math.random() >= CHAT_AFTER_VOTE_CHANCE) {
        return { t: 'silent', delayMs: silentDelay() };
      }

      return chatOrSilent(ctx, debatePrompt(ctx, declaredSuspectLabel(ctx)));
    }

    case 'lifeVote':
      return { t: 'lifeVote', kill: ctx.accusedId !== ctx.selfId };

    case 'guessWord': {
      const { text } = await speak(ctx, guessWordPrompt(ctx), {
        maxTokens: GUESS_WORD_MAX_TOKENS,
        effort: 'max',
      });
      if (text !== null) return { t: 'guessWord', word: text };
      // 빈손으로 두면 서버가 응답을 못 받아 페이즈가 타이머까지 멈춰 있는다.
      // 오답이라도 내면 시간 초과와 같은 결과(시민 승)로 게임이 진행된다.
      return { t: 'guessWord', word: ctx.category };
    }

    default:
      return { t: 'silent', delayMs: silentDelay() };
  }
};
