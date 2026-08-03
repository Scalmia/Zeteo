import { BotContext, BotAction, DecideBotAction } from '@zeteo/shared-types'

// TODO(김정현/B): 실제 LLM 기반 로직으로 교체 예정 (llm.ts / prompts.ts / scheduler.ts 등 활용).
// 지금은 A(유민성)가 연결 지점(hook) 테스트용으로 임시 구현한 것.
export const decideBotAction: DecideBotAction = async (ctx: BotContext): Promise<BotAction> => {
  switch (ctx.phase) {
    case 'describe':
      return { t: 'speak', text: `${ctx.category}랑 관련 있는 것 같아요.`, delayMs: 1000 }

    case 'debate': {
      const others = ctx.players.filter((p) => p.id !== ctx.selfId && p.isAlive)
      if (others.length === 0) return { t: 'vote', targetId: null }
      const target = others[Math.floor(Math.random() * others.length)]!
      return { t: 'vote', targetId: target.id }
    }

    case 'lifeVote':
      return { t: 'lifeVote', kill: Math.random() < 0.5 }

    case 'guessWord':
      return { t: 'guessWord', word: ctx.category }

    default:
      return { t: 'silent' }
  }
}