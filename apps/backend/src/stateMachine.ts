import { Phase } from '@zeteo/shared-types'
import { RoomInternalState } from './room'
import { tallyDebateVotes, tallyLifeVote } from './vote'

type Transition = (room: RoomInternalState) => Phase

const transitions: Record<Phase, Transition> = {
  lobby: () => 'roleReveal',

  roleReveal: () => 'describe',

  describe: () => 'debate',

  debate: (room) => {
    const { accusedId, tie } = tallyDebateVotes(room)

    if (tie) {
      room.round += 1
      room.votes = {}
      console.log(`[${room.roomId}] 동점 발생 → 전원 재투표 (round ${room.round})`)
      return 'debate'
    }

    room.accusedId = accusedId

    if (!accusedId) {
      room.liarGameResult = 'liarWin'   // ★ 아무도 지목 안 됨 → 라이어 승
      return 'botVote'
    }

    return 'finalDefense'
  },

  finalDefense: () => 'lifeVote',

  lifeVote: (room) => {
    const kill = tallyLifeVote(room)
    if (kill) return 'reveal'

    // 살린다 선택 → 횟수 제한 없이 매번 debate로 복귀
    room.accusedId = null
    room.votes = {}
    room.lifeVotes = {}
    room.round += 1
    room.turnOrder = []
    room.currentTurnIndex = 0
    console.log(`[${room.roomId}] 살린다 선택 → debate로 복귀 (round ${room.round})`)
    return 'debate'
  },

  reveal: (room) => {
    const accused = room.players.find(p => p.id === room.accusedId)
    if (accused) {
      accused.isAlive = false        // ★ 처형 확정
      room.revealedRole = accused.role  // ★ 역할 공개
    }

    if (accused?.role === 'liar') {
      return 'guessWord'
    }

    room.liarGameResult = 'liarWin'   // ★ 시민이 처형됨 → 라이어 승
    return 'botVote'
  },

  guessWord: () => 'botVote',
  // 실제 정답 판정은 index.ts의 case "guessWord"에서 처리 (제출된 단어를 알아야 판정 가능)

  botVote: () => 'result',

  result: () => 'result',
}

export function nextPhase(room: RoomInternalState) {
  const transition = transitions[room.phase]
  room.phase = transition(room)
  console.log(`[${room.roomId}] phase → ${room.phase}`)
}