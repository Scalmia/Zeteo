import { supabase } from './supabase';
import { RoomInternalState } from '../room';

export async function logMessage(
  room: RoomInternalState,
  // 런타임 Message.id (m{ts}_{rand} / sys{ts}_{n}). 이 값이 있어야 "화면에서 고른 그 발언"을
  // DB 행으로 되짚을 수 있다 — game_messages.id 는 insert 때 DB 가 새로 만든 uuid 라
  // 클라이언트가 들고 있는 id 와 아예 다른 값이었다.
  runtimeId: string,
  speakerLabel: string | null,
  speakerType: 'human' | 'bot' | 'system',
  role: 'liar' | 'citizen' | null,
  text: string,
) {
  // dbGameId가 없으면(game.ts의 startGame이 실패했으면) 기록할 game_id 자체가 없어 건너뛴다.
  if (!room.dbGameId) return;
  const { error } = await supabase.from('game_messages').insert({
    game_id: room.dbGameId,
    runtime_id: runtimeId,
    speaker_label: speakerLabel,
    speaker_type: speakerType,
    role,
    round: room.round,
    phase: room.phase,
    text,
  });
  // 호출부(index.ts)가 전부 `void logMessage(...)`로 던져놓고 응답을 안 기다린다 — 로그는
  // 부가 기록이지 게임 진행의 일부가 아니라서, 실패해도 throw 대신 로그만 남기고 넘어간다.
  if (error) console.error(`[${room.roomId}] 메시지 기록 실패:`, error.message);
}

export async function logVote(
  room: RoomInternalState,
  voteType: 'liar_vote' | 'life_vote',
  voterLabel: string,
  targetLabel: string,
) {
  if (!room.dbGameId) return; // 이유는 위 logMessage 참고 — dbGameId 없음/부가 기록이라 삼킴
  const { error } = await supabase.from('game_votes').insert({
    game_id: room.dbGameId,
    round: room.round,
    vote_type: voteType,
    phase: room.phase,
    voter_label: voterLabel,
    target_label: targetLabel,
  });
  if (error) console.error(`[${room.roomId}] 투표 기록 실패:`, error.message);
}