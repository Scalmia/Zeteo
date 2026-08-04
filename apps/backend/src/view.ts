import { GameState, PublicPlayer } from '@zeteo/shared-types'
import { RoomInternalState } from './room'

// TODO(Day 4): vote.ts가 생기면 이 두 함수는 지우고 거기서 import
function countVotes(votes: Record<string, string | null>): Record<string, number> {
  const counts: Record<string, number> = {}
  for (const targetId of Object.values(votes)) {
    if (!targetId) continue
    counts[targetId] = (counts[targetId] ?? 0) + 1
  }
  return counts
}

function countLifeVotes(lifeVotes: Record<string, boolean>): { kill: number; spare: number } {
  const counts = { kill: 0, spare: 0 }
  for (const kill of Object.values(lifeVotes)) {
    if (kill) counts.kill++
    else counts.spare++
  }
  return counts
}

export function buildGameStateFor(room: RoomInternalState, playerId: string): GameState {
  const me = room.players.find(p => p.id === playerId)
  if (!me) throw new Error(`player ${playerId} not in room`)

  const publicPlayers: PublicPlayer[] = room.players.map(p => ({
    id: p.id, label: p.label, isAlive: p.isAlive,
  }))

  return {
    roomId: room.roomId,
    phase: room.phase,
    players: publicPlayers,
    category: room.category,
    word: me.role === 'liar' ? null : room.word,
    myRole: me.role,
    turnOrder: room.turnOrder,
    currentTurn: room.turnOrder[room.currentTurnIndex] ?? null,
    deadlineAt: room.deadlineAt,
    messages: room.messages,
    voteCounts: countVotes(room.votes),
    myVote: room.votes[playerId] ?? null,
    accused: room.accusedId,

    myId: playerId,
    round: room.round,
    myLifeVote: room.lifeVotes[playerId] ?? null,
    lifeVoteCounts: countLifeVotes(room.lifeVotes),
    revealedRole: room.revealedRole,
    // ★ 변경: result phase 전엔 무조건 null로 감춤 (내부적으론 이미 계산돼 있어도 노출 안 함)
    liarGameResult: room.phase === 'result' ? room.liarGameResult : null,

    // result phase에서만 실제 값
    revealedBotId: room.phase === 'result'
      ? (room.players.find(p => p.isBot)?.id ?? null)
      : null,
  }
}