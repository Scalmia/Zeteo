import type { BotAction, BotContext, DecideBotAction } from '@zeteo/shared-types';
import { generate } from './llm';
import { debatePrompt, describePrompt, systemPrompt } from './prompts';

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
 * ★ 파트 A가 파트 B에게 요구하는 것의 전부.
 *   A는 이 함수 내부를 몰라도 되고, B는 서버 구조를 몰라도 된다.
 */
export const decideBotAction: DecideBotAction = async (ctx: BotContext): Promise<BotAction> => {
  switch (ctx.phase) {
    case 'describe': {
      const text = await generate(systemPrompt(ctx), describePrompt(ctx));
      return { t: 'speak', text, delayMs: humanDelay(text) };
    }

    case 'debate':
    case 'finalDefense': {
      const text = await generate(systemPrompt(ctx), debatePrompt(ctx));
      return { t: 'speak', text, delayMs: humanDelay(text) };
    }

    // TODO(파트 B) — 아래는 아직 미구현.
    // 서버가 봇을 기다리다 멈추지 않도록 일단 유효한 값을 돌려준다.
    case 'lifeVote':
      return { t: 'lifeVote', kill: Math.random() < 0.5 };

    case 'guessWord':
      return { t: 'guessWord', word: '모르겠어요' };

    default:
      return { t: 'silent' };
  }
};
