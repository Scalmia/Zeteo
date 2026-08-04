import type { BotAction, BotContext, DecideBotAction } from '@zeteo/shared-types';
import { generate } from './llm';
import { debatePrompt, describePrompt, guessWordPrompt, systemPrompt } from './prompts';

const DEBATE_SPEAK_COUNT = 2;

/**
 * 사람은 읽고 · 생각하고 · 타이핑하는 데 시간이 걸린다.
 * 봇이 즉시 응답하면 그 자체로 정체가 드러나므로 발언 길이에 비례한 지연을 돌려준다.
 * 서버는 이 값만큼 기다린 뒤 발언을 게임에 넣는다.
 *
 * 실제 값은 Day 5 실전 플레이에서 체감으로 조정한다.
 */
function humanDelay(text: string): number {
  return Math.round(600 + text.length * 140 + Math.random() * 800);
}

/**
 * debate 단계에서 서버(maybeTriggerBot)는 room.votes[bot.id]가 채워질 때까지
 * decideBotAction을 반복 호출한다. speak을 반환하면 영영 안 채워져서 호출이
 * 계속 반복되므로, 이 단계는 반드시 vote를 반환해야 한다.
 * 최다 득표자에게 투표(밴드왜건), 자기 자신은 후보에서 제외, 아무도 표가 없으면 무작위.
 */
function bandwagonTarget(ctx: BotContext): string | null {
  const others = ctx.players.filter((p) => p.id !== ctx.selfId && p.isAlive);
  if (others.length === 0) return null;

  const counted = others.map((p) => [p.id, ctx.voteCounts[p.id] ?? 0] as const).filter(([, n]) => n > 0);
  if (counted.length === 0) {
    return others[Math.floor(Math.random() * others.length)]!.id;
  }

  const maxVotes = Math.max(...counted.map(([, n]) => n));
  const top = counted.filter(([, n]) => n === maxVotes).map(([id]) => id);
  return top[Math.floor(Math.random() * top.length)]!;
}

/**
 * BotContext엔 피고인 id가 없어서, 최후 변론(finalDefense)의 마지막 발언자로 추론한다.
 * 피고인이 최후 변론에서 아무 말도 못 남기면(타임아웃 등) 추론이 실패해 null이 되고,
 * 그 경우 아래 lifeVote 로직은 kill 쪽으로 디폴트된다.
 */
function findAccusedId(ctx: BotContext): string | null {
  for (let i = ctx.transcript.length - 1; i >= 0; i--) {
    const m = ctx.transcript[i]!;
    if (m.phase === 'finalDefense') return m.speakerId;
  }
  return null;
}

/**
 * ★ 파트 A가 파트 B에게 요구하는 것의 전부.
 *   A는 이 함수 내부를 몰라도 되고, B는 서버 구조를 몰라도 된다.
 */
export const decideBotAction: DecideBotAction = async (ctx: BotContext): Promise<BotAction> => {
  switch (ctx.phase) {
    case 'describe': {
      const text = await generate(systemPrompt(ctx), describePrompt(ctx));
      return { t: 'speak', text, delayMs: humanDelay(text) };
    }

    case 'finalDefense': {
      const text = await generate(systemPrompt(ctx), debatePrompt(ctx));
      return { t: 'speak', text, delayMs: humanDelay(text) };
    }

    case 'debate': {
      // 서버(maybeTriggerBot)는 speak을 반환하면 바로 재호출하고, vote가 나올 때까지
      // 그걸 반복한다. 그래서 처음부터 vote만 던지면 토론 내내 한마디도 안 하는
      // 플레이어가 되어 그 자체로 티가 난다. 자기 발언을 DEBATE_SPEAK_COUNT번 채운 뒤에야
      // 투표로 마무리한다.
      const myDebateMessages = ctx.transcript.filter(
        (m) => m.phase === 'debate' && m.speakerId === ctx.selfId,
      ).length;

      if (myDebateMessages < DEBATE_SPEAK_COUNT) {
        const text = await generate(systemPrompt(ctx), debatePrompt(ctx));
        return { t: 'speak', text, delayMs: humanDelay(text) };
      }

      return { t: 'vote', targetId: bandwagonTarget(ctx) };
    }

    case 'lifeVote': {
      const accusedId = findAccusedId(ctx);
      return { t: 'lifeVote', kill: accusedId !== ctx.selfId };
    }

    case 'guessWord': {
      const word = await generate(systemPrompt(ctx), guessWordPrompt(ctx), {
        maxTokens: 200,
        thinking: { type: 'enabled', reasoning_effort: 'max' },
      });
      return { t: 'guessWord', word };
    }

    default:
      return { t: 'silent' };
  }
};
