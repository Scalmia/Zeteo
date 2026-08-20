import { RoomInternalState } from './room';

const timers = new Map<string, NodeJS.Timeout>();

export function setPhaseTimer(room: RoomInternalState, durationMs: number, onExpire: () => void) {
  room.deadlineAt = Date.now() + durationMs;
  // 방 하나에 타이머는 항상 최대 1개만 떠 있어야 한다. 미리 안 지우면, 같은 phase/턴 안에서
  // 이 함수가 두 번 불렸을 때(예: describe 턴마다 재호출) 옛 타이머가 안 죽고 남아있다가
  // 나중에 엉뚱한 시점에 onExpire가 중복 발화한다.
  clearPhaseTimer(room.roomId);
  const t = setTimeout(() => {
    console.log(`[${room.roomId}] 타이머 종료`);
    try {
      onExpire();
    } catch (e) {
      console.error(`[${room.roomId}] 타이머 콜백 에러:`, e);
    }
  }, durationMs);
  timers.set(room.roomId, t);
}

export function clearPhaseTimer(roomId: string) {
  const t = timers.get(roomId);
  if (t) clearTimeout(t);
  timers.delete(roomId);
}
