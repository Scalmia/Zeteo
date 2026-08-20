import { supabase } from './supabase';
import { SurveyReason } from '@zeteo/shared-types';
import { RoomInternalState } from '../room';

const SURVEY_QUESTION_CODE = 'bot_reason';

// survey_reasons는 게임 도중 안 바뀌는 정적 데이터라, 브로드캐스트마다(=survey를 보는
// 인원수만큼) 매번 다시 쿼리할 필요가 없다. 최초 성공 시에만 캐싱한다 — 에러로 실패한
// 경우엔 캐시하지 않고 다음 호출에서 재시도되게 둔다.
let cachedReasons: SurveyReason[] | null = null;

export async function fetchSurveyReasons(): Promise<SurveyReason[]> {
  if (cachedReasons) return cachedReasons;

  const { data: question, error: questionErr } = await supabase
    .from('survey_questions')
    .select('id')
    .eq('code', SURVEY_QUESTION_CODE)
    .single();
  if (questionErr || !question) {
    console.error('설문 질문 조회 실패:', questionErr?.message);
    return [];
  }

  const { data: reasons, error: reasonsErr } = await supabase
    .from('survey_reasons')
    .select('id, text, is_other')
    .eq('question_id', question.id)
    .order('sort_order');
  if (reasonsErr) {
    console.error('설문 선택지 조회 실패:', reasonsErr.message);
    return [];
  }

  cachedReasons = (reasons ?? []).map((r) => ({ id: r.id, label: r.text }));
  return cachedReasons;
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

  // botVote 단계엔 20초 타이머가 있다(index.ts PHASE_DURATIONS.botVote) — 그 안에 지목을
  // 못 했으면 room.botVotes에 이 사람 항목 자체가 없다. 그런 채로 survey까지 왔을 수
  // 있으므로, 지목 대상이 없으면(=guessedTarget이 없으면) 응답을 남기지 않고 건너뛴다.
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
export interface SurveyResponseRow {
  voterLabel: string;
  reasonIds: number[];
  freeText: string | null;
}

/** 게임이 끝난 뒤 최종 로그를 만들 때, 그 판의 설문 응답을 전부 모아온다. */
export async function fetchSurveyResponsesForGame(gameId: string): Promise<SurveyResponseRow[]> {
  const { data: responses, error } = await supabase
    .from('survey_responses')
    .select('id, voter_label, free_text')
    .eq('game_id', gameId);
  if (error || !responses?.length) return [];

  const responseIds = responses.map((r) => r.id);
  const { data: reasonRows } = await supabase
    .from('survey_response_reasons')
    .select('survey_response_id, reason_id')
    .in('survey_response_id', responseIds);

  return responses.map((r) => ({
    voterLabel: r.voter_label,
    freeText: r.free_text,
    reasonIds: (reasonRows ?? [])
      .filter((row) => row.survey_response_id === r.id)
      .map((row) => row.reason_id),
  }));
}