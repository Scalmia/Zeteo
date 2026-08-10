import { supabase } from './supabase';
import { RoomInternalState } from '../room';

export async function logMessage(
  room: RoomInternalState,
  speakerLabel: string | null,
  speakerType: 'human' | 'bot' | 'system',
  role: 'liar' | 'citizen' | null,
  text: string,
) {
  if (!room.dbGameId) return;
  const { error } = await supabase.from('game_messages').insert({
    game_id: room.dbGameId,
    speaker_label: speakerLabel,
    speaker_type: speakerType,
    role,
    round: room.round,
    phase: room.phase,
    text,
  });
  if (error) console.error(`[${room.roomId}] 메시지 기록 실패:`, error.message);
}

export async function logVote(
  room: RoomInternalState,
  voteType: 'liar_vote' | 'life_vote',
  voterLabel: string,
  targetLabel: string,
) {
  if (!room.dbGameId) return;
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