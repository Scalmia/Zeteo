import { supabase } from './supabase';
import { SurveyReason } from '@zeteo/shared-types';
import { RoomInternalState } from '../room';

// survey_reasons는 게임 도중 안 바뀌는 정적 데이터라, 브로드캐스트마다(=survey를 보는
// 인원수만큼) 매번 다시 쿼리할 필요가 없다. 최초 성공 시에만 캐싱한다 — 에러로 실패한
// 경우엔 캐시하지 않고 다음 호출에서 재시도되게 둔다.
//
// ⚠️ 이 캐시는 프로세스가 사는 동안 안 풀린다. 문항 세대를 바꿔도(아래 is_active 전환)
// 화면은 서버가 재시작할 때까지 옛 문구를 보여준다 — "DB만 살짝 고치기"는 안 통한다.
// 개선 루프가 PR → 머지 → Railway 리빌드라 어차피 재시작이 껴서 그대로 뒀다.
let cachedReasons: SurveyReason[] | null = null;

export async function fetchSurveyReasons(): Promise<SurveyReason[]> {
  if (cachedReasons) return cachedReasons;

  // 문항을 code 상수로 고르지 않고 is_active 로 고른다 — 5판마다 문항을 갈아끼우는데
  // 상수면 그때마다 코드 수정·배포가 필요해서, 새 세대를 INSERT 만으로 올린다는 목적이
  // 무너진다. 활성 행이 항상 최대 1개인 건 DB 쪽 부분 유니크 인덱스가 보장한다
  // (sql/2026-08-25_bot-loop-schema.sql) — 둘이 켜지면 single() 이 에러로 떨어진다.
  const { data: question, error: questionErr } = await supabase
    .from('survey_questions')
    .select('id')
    .eq('is_active', true)
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
  /** "가장 봇 같았던 발언"으로 고른 런타임 Message.id. 안 고를 수도 있어 optional 이다. */
  pickedMessageId?: string,
) {
  if (!room.dbGameId) return;
  const voter = room.players.find((p) => p.id === voterId);
  if (!voter) return;

  // botVote 단계엔 20초 타이머가 있다(index.ts PHASE_DURATIONS.botVote) — 그 안에 지목을
  // 못 했으면 room.botVotes에 이 사람 항목 자체가 없다.
  //
  // 예전엔 그 경우 여기서 return 해서 설문을 통째로 버렸다. 지목과 설문은 별개 정보인데
  // 하나가 다른 하나를 막고 있던 것이라, 성실히 쓴 사유·자유서술까지 같이 사라졌다
  // (실측 판의 44%가 설문 0건이었고 원인의 일부로 보고 있다). 이제 두 칸을 null 로 두고
  // 설문 본문은 남긴다 — "지목 안 함"과 "지목했는데 틀림"은 DB 에서 구분된다
  // (전자는 guessed_bot_label IS NULL, 후자는 guessed_correctly = false).
  //
  // (두 칸의 NOT NULL 은 2026-08-25 에 풀었다. 스키마 변경 절차는 루트 README 의
  //  "DB (Supabase)" 절 참고 — 이 저장소엔 마이그레이션 파일이 없다.)
  const guessedTargetId = room.botVotes[voterId];
  const guessedTarget = room.players.find((p) => p.id === guessedTargetId);

  const { data: response, error: respErr } = await supabase
    .from('survey_responses')
    .insert({
      game_id: room.dbGameId,
      voter_label: voter.label,
      guessed_bot_label: guessedTarget?.label ?? null,
      guessed_correctly: guessedTarget?.isBot ?? null,
      free_text: freeText || null,
    })
    .select('id')
    .single();

  if (respErr || !response) {
    console.error(`[${room.roomId}] 설문 응답 기록 실패:`, respErr?.message);
    return;
  }

  // 고른 발언은 위 insert 에 같이 넣지 않고 별도 UPDATE 로 쓴다.
  //
  // insert 에 끼우면 이 칸 하나가 잘못될 때 설문 응답 전체가 안 남는다 — 칼럼이 아직 없는
  // 상태로 배포되면(스키마는 Supabase 안에만 있어서 순서가 어긋날 수 있다) 모든 설문이
  // 조용히 사라진다. 그건 이번에 고친 44% 유실과 같은 종류의 사고다.
  // 고른 발언은 본문이 아니라 부가 정보이므로, 실패해도 응답 본문은 남게 분리한다.
  //
  // 검증은 DB 가 아니라 room.messages 로 한다 — 그게 이 판에 실제로 오간 발언의 원본이고,
  // logMessage 가 실패해 DB 행이 없더라도 "고른 값" 자체는 남길 수 있다.
  // 시스템 메시지("2라운드 시작" 등)는 누가 한 말이 아니라 고를 대상에서 뺀다.
  // 못 찾으면 throw 하지 않고 그냥 안 쓴다 — 클라이언트 버그 하나로 설문을 잃지 않기 위해서.
  const picked = pickedMessageId
    ? room.messages.find((m) => m.id === pickedMessageId && m.speakerId !== 'system')
    : undefined;
  if (pickedMessageId && !picked) {
    console.warn(`[${room.roomId}] 고른 발언을 찾을 수 없어 건너뜀:`, pickedMessageId);
  }
  if (picked) {
    const { error: pickErr } = await supabase
      .from('survey_responses')
      .update({ picked_message_runtime_id: picked.id })
      .eq('id', response.id);
    if (pickErr) console.error(`[${room.roomId}] 고른 발언 기록 실패:`, pickErr.message);
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