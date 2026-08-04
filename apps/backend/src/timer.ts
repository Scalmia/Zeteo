import { RoomInternalState } from './room';

const timers = new Map<string, NodeJS.Timeout>();

export function setPhaseTimer(room: RoomInternalState, durationMs: number, onExpire: () => void) {
  room.deadlineAt = Date.now() + durationMs;
  clearPhaseTimer(room.roomId);
  const t = setTimeout(() => {
    console.log(`[${room.roomId}] 타이머 종료`);
    onExpire();
  }, durationMs);
  timers.set(room.roomId, t);
}

export function clearPhaseTimer(roomId: string) {
  const t = timers.get(roomId);
  if (t) clearTimeout(t);
  timers.delete(roomId);
}
