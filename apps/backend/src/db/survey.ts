import { supabase } from './supabase';
import { SurveyReason } from '@zeteo/shared-types';
import { RoomInternalState } from '../room';

const SURVEY_QUESTION_CODE = 'bot_reason'; 

export async function fetchSurveyReasons(): Promise<SurveyReason[]> {
  const { data: question } = await supabase
    .from('survey_questions')
    .select('id')
    .eq('code', SURVEY_QUESTION_CODE)
    .single();
  if (!question) return [];

  const { data: reasons } = await supabase
    .from('survey_reasons')
    .select('id, text, is_other')
    .eq('question_id', question.id)
    .order('sort_order');

  return (reasons ?? []).map((r) => ({ id: r.id, label: r.text }));
}

export async function submitSurveyResponse(
  room: RoomInternalState,
  voterId: string,
  reasonIds: number[],
  freeText: string,
) {
  if (!room.dbGameId) return;
  const voter = room.players.find((p) => p.id === voterId);
  if (!voter) return;

  const guessedTargetId = room.botVotes[voterId];
  const guessedTarget = room.players.find((p) => p.id === guessedTargetId);
  if (!guessedTarget) return;

  const { data: response, error: respErr } = await supabase
    .from('survey_responses')
    .insert({
      game_id: room.dbGameId,
      voter_label: voter.label,
      guessed_bot_label: guessedTarget.label,
      guessed_correctly: guessedTarget.isBot,
      free_text: freeText || null,
    })
    .select('id')
    .single();

  if (respErr || !response) {
    console.error(`[${room.roomId}] 설문 응답 기록 실패:`, respErr?.message);
    return;
  }

  if (reasonIds.length === 0) return;

  const { data: reasonRows } = await supabase
    .from('survey_reasons')
    .select('id, is_other')
    .in('id', reasonIds);

  const rows = reasonIds.map((reasonId) => ({
    survey_response_id: response.id,
    reason_id: reasonId,
    free_text: reasonRows?.find((r) => r.id === reasonId)?.is_other ? freeText : null,
  }));

  const { error: reasonErr } = await supabase.from('survey_response_reasons').insert(rows);
  if (reasonErr) console.error(`[${room.roomId}] 설문 사유 기록 실패:`, reasonErr.message);
}