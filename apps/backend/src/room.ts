import { InternalPlayer, Phase, Message, Role } from '@zeteo/shared-types'

export interface RoomInternalState {
  roomId: string
  phase: Phase
  round: number                                     // 동점 재투표 등으로 같은 phase 반복 시 구분
  players: InternalPlayer[]
  category: string
  word: string
  turnOrder: string[]
  currentTurnIndex: number
  deadlineAt: number | null
  messages: Message[]
  votes: Record<string, string | null>              // S2 토론 투표 (voterId → targetId)
  lifeVotes: Record<string, boolean>                 // S4 생사 투표 (true=kill, false=spare)
  botVotes: Record<string, string>                   // S6 봇 지목 투표
  accusedId: string | null
  revealedRole: Role | null                          // S5 처형자 역할 공개
  liarGameResult: 'liarWin' | 'citizenWin' | null    // S5 라이어게임 승패
  createdAt: number
}

const rooms = new Map<string, RoomInternalState>()

export function createRoom(roomId: string): RoomInternalState {
  const room: RoomInternalState = {
    roomId, phase: 'lobby', round: 1, players: [], category: '', word: '',
    turnOrder: [], currentTurnIndex: 0, deadlineAt: null, messages: [],
    votes: {}, lifeVotes: {}, botVotes: {}, accusedId: null,
    revealedRole: null, liarGameResult: null, createdAt: Date.now(),
  }
  rooms.set(roomId, room)
  return room
}

export function getRoom(roomId: string): RoomInternalState | undefined {
  return rooms.get(roomId)
}

let idCounter = 0
export function joinRoom(roomId: string, name: string, isBot = false): InternalPlayer {
  const room = getRoom(roomId)
  if (!room) throw new Error(`room ${roomId} not found`)
  const player: InternalPlayer = { id: `p${++idCounter}`, name, isAlive: true, isBot, role: 'citizen' }
  room.players.push(player)
  return player
}

export function assignRoles(room: RoomInternalState) {
  const shuffled = [...room.players].sort(() => Math.random() - 0.5)
  const liar = shuffled[0]
  if (!liar) return   // 참가자가 없으면 아무것도 안 함
  room.players.forEach(p => (p.role = 'citizen'))
  liar.role = 'liar'
}