import { createRoom, joinRoom, assignRoles } from './room'
import { nextPhase } from './stateMachine'
import { setPhaseTimer } from './timer'
import { buildGameStateFor } from './view'

// 1. 방 만들고 5명(사람4+봇1) 참가
const room = createRoom('test-room')
joinRoom('test-room', '유민성')
joinRoom('test-room', '이현우')
joinRoom('test-room', '박진')
joinRoom('test-room', '김정현')
joinRoom('test-room', '봇1', true)

// 2. 역할(라이어) 배정
assignRoles(room)

console.log('=== 참가자 목록 ===')
console.table(room.players)

// 3. phase 전환 확인
console.log('=== phase 전환 확인 ===')
console.log('시작 phase:', room.phase)
nextPhase(room)  // lobby → roleReveal
nextPhase(room)  // roleReveal → describe

// 4. 제시어 설정 (테스트용으로 직접 지정)
room.category = '동물'
room.word = '기린'

// 5. 각자에게 보이는 상태 확인 (word 필터링 체크)
console.log('=== 각자에게 보이는 상태 (word 필드 확인) ===')
for (const p of room.players) {
  const state = buildGameStateFor(room, p.id)
  console.log(`${p.name} (실제역할:${p.role}) → word 보임:`, state.word)
}

// 6. 타이머 확인
console.log('=== 타이머 확인 ===')
setPhaseTimer(room, 3000, () => console.log('3초 타이머 콜백 실행됨!'))
console.log('deadlineAt:', room.deadlineAt)

// 7. GameState 새 필드 확인
console.log('=== GameState 새 필드 확인 ===')
const state = buildGameStateFor(room, room.players[0].id)
console.log({
  myId: state.myId,
  round: state.round,
  myLifeVote: state.myLifeVote,
  lifeVoteCounts: state.lifeVoteCounts,
  revealedRole: state.revealedRole,
  liarGameResult: state.liarGameResult,
})