import { Phase } from '@zeteo/shared-types'
import { RoomInternalState } from './room'

const PHASE_ORDER: Phase[] = [
  'lobby', 'roleReveal', 'describe', 'debate', 'finalDefense',
  'lifeVote', 'reveal', 'guessWord', 'botVote', 'result',
]

export function nextPhase(room: RoomInternalState) {
  const idx = PHASE_ORDER.indexOf(room.phase)
  room.phase = PHASE_ORDER[idx + 1] ?? 'result'
  console.log(`[${room.roomId}] phase → ${room.phase}`)
}