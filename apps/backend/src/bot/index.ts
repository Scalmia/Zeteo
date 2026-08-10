import type { BotAction, BotContext, DecideBotAction } from '@zeteo/shared-types';
import {
  debatePrompt,
  describePrompt,
  finalDefensePrompt,
  guessWordPrompt,
  systemPrompt,
} from './prompts';
import { generate } from './llm';

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
 * 사람은 읽고 · 생각하고 · 타이핑하는 데 시간이 걸린다.
 * 봇이 즉시 응답하면 그 자체로 정체가 드러나므로 발언 길이에 비례한 시간을 목표로 잡는다.
 *
 * 이 값은 "발언이 화면에 뜨기까지의 총 시간" 목표다. 모델이 쓴 시간을 여기서 빼기 때문에,
 * 목표가 모델 응답 시간(5~6초)보다 작으면 지연이 늘 0이 되어 아무 효과가 없다.
 * 1판 실측에서 봇이 5~6초 간격으로 말해 "폭주한다"는 반응이 나왔으므로 10초 안팎을 노린다.
 */
function humanDelay(text: string): number {
  return Math.round(3000 + text.length * 300 + Math.random() * 2000);
}

/** 침묵을 고른 뒤 서버가 다시 물어보기까지의 간격. 이 값이 0이면 서버가 즉시 되물어 루프가 폭주한다. */
function silentDelay(): number {
  return Math.round(3000 + Math.random() * 4000);
}

/**
 * API가 죽었을 때 대신 내보낼 말. 제시어를 흘리지 않으면서 사람이 실제로 칠 법한 문장이라야 한다.
 * 침묵으로 대체하지 않는 이유는, 묘사 단계에서 silent가 자기 턴을 통째로 넘겨버려
 * 혼자 아무 말 없이 지나간 참가자가 되기 때문이다.
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
  const addressed = addressedPlayer(ctx, inPhase[lastMine]!.text);

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
 * 여기서 예외를 삼키지 않으면 서버가 void로 띄워둔 호출에서 unhandled rejection이 나
 * 프로세스가 내려갈 수 있다. 봇 하나 때문에 방 전체가 죽어선 안 된다.
 */
async function speak(ctx: BotContext, prompt: string): Promise<{ text: string; delayMs: number }> {
  const started = Date.now();

  let text = await generateOrEmpty(ctx, prompt);

  // 프롬프트로 금지해도 모델이 제시어를 그대로 말하거나, 답 대신 사고 과정을 뱉는 일이
  // 실제로 벌어졌다. 둘 다 그대로 내보내면 그 판이 끝나므로 규칙에만 맡기지 않고
  // 생성 결과를 직접 확인한다. 한 번 더 시켜보고 그래도 걸리면 버린다.
  const rejected = (t: string): string | null => {
    if (leaksWord(ctx, t)) return '제시어 유출';
    if (looksInvalid(t)) return '채팅 한 줄이 아님';
    return null;
  };

  let reason = rejected(text);
  if (reason !== null) {
    console.warn(`[bot] ${reason} 감지, 재생성:`, text);
    text = await generateOrEmpty(ctx, prompt);
    reason = rejected(text);
    if (reason !== null) {
      console.warn(`[bot] 재생성도 ${reason}, 대체 문구 사용:`, text);
      text = '';
    }
  }

  if (text.length === 0) text = fallbackLine();

  return { text, delayMs: Math.max(0, humanDelay(text) - (Date.now() - started)) };
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

async function generateOrEmpty(ctx: BotContext, prompt: string): Promise<string> {
  try {
    return await generate(systemPrompt(ctx), prompt);
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
  const { text, delayMs } = await speak(ctx, prompt);
  if (isEcho(ctx, text)) {
    console.warn('[bot] 같은 말 반복 감지, 침묵으로 대체:', text);
    return { t: 'silent', delayMs: silentDelay() };
  }
  return { t: 'chat', text, delayMs };
}

/**
 * 최다 득표자에게 투표(밴드왜건). 자기 자신과 사망자는 후보에서 제외하고,
 * 아무도 표가 없으면 무작위, 동점이면 그중 무작위.
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
      return { t: 'describe', text, delayMs };
    }

    /**
     * 최후 변론엔 투표가 없어 루프를 끊을 액션이 없다. 여기서 chat만 돌려주면
     * 제한시간 내내 혼자 말하게 되므로(1판 실측 10연속), 침묵이 유일한 제동이다.
     */
    case 'finalDefense': {
      const amAccused = ctx.accusedId === ctx.selfId;
      const chance = amAccused ? CHAT_AS_ACCUSED_CHANCE : CHAT_IN_FINAL_DEFENSE_CHANCE;
      if (shouldWaitForOthers(ctx) || Math.random() >= chance) {
        return { t: 'silent', delayMs: silentDelay() };
      }
      return chatOrSilent(ctx, finalDefensePrompt(ctx));
    }

    /** 서버는 토론 제한시간이 끝날 때까지 이 함수를 반복 호출한다. 매번 하나만 고른다. */
    case 'debate': {
      if (shouldWaitForOthers(ctx)) {
        // 입은 다물되 표는 던질 수 있다. 이게 없으면 기다리기만 하다 기권으로 끝난다.
        if (ctx.myVote === null && Math.random() < VOTE_WHILE_WAITING_CHANCE) {
          return { t: 'vote', targetId: bandwagonTarget(ctx) };
        }
        return { t: 'silent', delayMs: silentDelay() };
      }

      if (ctx.myVote === null) {
        if (Math.random() < CHAT_BEFORE_VOTE_CHANCE) {
          return chatOrSilent(ctx, debatePrompt(ctx));
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

      return chatOrSilent(ctx, debatePrompt(ctx));
    }

    case 'lifeVote':
      return { t: 'lifeVote', kill: ctx.accusedId !== ctx.selfId };

    case 'guessWord': {
      try {
        const word = await generate(systemPrompt(ctx), guessWordPrompt(ctx), {
          maxTokens: 200,
          thinking: { type: 'enabled', reasoning_effort: 'max' },
        });
        if (word.length > 0) return { t: 'guessWord', word };
      } catch (err) {
        console.error('[bot] 제시어 추측 실패:', err instanceof Error ? err.message : err);
      }
      // 빈손으로 두면 서버가 응답을 못 받아 페이즈가 타이머까지 멈춰 있는다.
      // 오답이라도 내면 시간 초과와 같은 결과(시민 승)로 게임이 진행된다.
      return { t: 'guessWord', word: ctx.category };
    }

    default:
      return { t: 'silent', delayMs: silentDelay() };
  }
};
