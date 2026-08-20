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
  // 이 함수는 index.ts의 case 'ready'에서 assignRoles 호출 직후에만 불린다. 그 시점엔
  // liar가 항상 배정돼 있고 bot도 방 생성 시 자동 참가라 항상 있어야 정상이다 — 그런데도
  // 방어적으로 막는 건, 없는 채로 계속 진행하면 p_bot_label/p_liar_label에 뭘 넣을지
  // 알 수 없어 DB insert 자체가 무의미해지기 때문이다.
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
  // index.ts는 startGame 실패를 try/catch로 삼키고 게임을 계속 진행시킨다(기록 실패로
  // 게임 자체를 막지 않기 위해서) — 그래서 room.dbGameId가 끝까지 null일 수 있다.
  // 그 경우 update할 games 행 자체가 없으므로 조용히 건너뛴다.
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