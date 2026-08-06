import type { BotAction, BotContext, DecideBotAction } from '@zeteo/shared-types';
import { generate } from './llm';
import { debatePrompt, describePrompt, guessWordPrompt, systemPrompt } from './prompts';

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

/**
 * 사람은 읽고 · 생각하고 · 타이핑하는 데 시간이 걸린다.
 * 봇이 즉시 응답하면 그 자체로 정체가 드러나므로 발언 길이에 비례한 시간을 목표로 잡는다.
 *
 * 실제 값은 Day 5 실전 플레이에서 체감으로 조정한다.
 */
function humanDelay(text: string): number {
  return Math.round(600 + text.length * 140 + Math.random() * 800);
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

  let text: string;
  try {
    text = await generate(systemPrompt(ctx), prompt);
  } catch (err) {
    console.error('[bot] 발화 생성 실패:', err instanceof Error ? err.message : err);
    text = '';
  }
  if (text.length === 0) text = fallbackLine();

  return { text, delayMs: Math.max(0, humanDelay(text) - (Date.now() - started)) };
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

    case 'finalDefense': {
      const { text, delayMs } = await speak(ctx, debatePrompt(ctx));
      return { t: 'chat', text, delayMs };
    }

    /** 서버는 토론 제한시간이 끝날 때까지 이 함수를 반복 호출한다. 매번 하나만 고른다. */
    case 'debate': {
      if (ctx.myVote === null) {
        if (Math.random() < CHAT_BEFORE_VOTE_CHANCE) {
          const { text, delayMs } = await speak(ctx, debatePrompt(ctx));
          return { t: 'chat', text, delayMs };
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

      const { text, delayMs } = await speak(ctx, debatePrompt(ctx));
      return { t: 'chat', text, delayMs };
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
