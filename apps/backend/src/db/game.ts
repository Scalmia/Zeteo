import { supabase } from './supabase';
import { InternalPlayer } from '@zeteo/shared-types';
import { tallyBotVoteResults } from '../vote';
import { RoomInternalState } from '../room';

export async function startGame(
  roomId: string,
  category: string,
  word: string,
  players: InternalPlayer[],
): Promise<string> {
  const bot = players.find((p) => p.isBot);
  const liar = players.find((p) => p.role === 'liar');
  if (!bot || !liar) throw new Error('bot 또는 liar가 배정되지 않았습니다');

  const { data, error } = await supabase.rpc('fn_start_game', {
    p_room_id: roomId,
    p_category: category,
    p_word: word,
    p_bot_label: bot.label,
    p_liar_label: liar.label,
    p_players: players.map((p) => ({ label: p.label, is_bot: p.isBot, role: p.role })),
  });

  if (error) throw new Error(`게임 시작 기록 실패: ${error.message}`);
  return data as string;
}

export async function finalizeGame(room: RoomInternalState) {
  if (!room.dbGameId) return;
  const results = tallyBotVoteResults(room);
  const botDetectedCount = Object.values(results).filter(Boolean).length;
  const botVoterTotal = Object.keys(results).length;

  const { error } = await supabase
    .from('games')
    .update({
      liar_game_result: room.liarGameResult,
      bot_detected_count: botDetectedCount,
      bot_voter_total: botVoterTotal,
      final_round: room.round,
      ended_at: new Date().toISOString(),
    })
    .eq('id', room.dbGameId);

  if (error) console.error(`[${room.roomId}] 게임 종료 기록 실패:`, error.message);
}