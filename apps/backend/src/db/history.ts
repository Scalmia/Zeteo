import { supabase } from './supabase';

/** 과거 판 설문에서, 정답을 맞힌 사람들이 봇을 의심했던 이유를 많이 나온 순으로 뽑는다. */
export async function fetchTopSuspicionReasons(limit = 5): Promise<{ reason: string; count: number }[]> {
  const { data: correctResponses, error: err1 } = await supabase
    .from('survey_responses')
    .select('id')
    .eq('guessed_correctly', true);
  if (err1 || !correctResponses?.length) return [];

  const responseIds = correctResponses.map((r) => r.id);
  const { data: reasonRows, error: err2 } = await supabase
    .from('survey_response_reasons')
    .select('reason_id, survey_reasons(text)')
    .in('survey_response_id', responseIds);
  if (err2 || !reasonRows) return [];

  const counts = new Map<string, number>();
  for (const row of reasonRows as any[]) {
    const text = row.survey_reasons?.text;
    if (!text) continue;
    counts.set(text, (counts.get(text) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([reason, count]) => ({ reason, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}

/** 과거 판들에서 봇이 실제로 했던 발언을 최근 순으로 가져온다. */
export async function fetchRecentBotLines(limit = 100): Promise<string[]> {
  const { data, error } = await supabase
    .from('game_messages')
    .select('text')
    .eq('speaker_type', 'bot')
    .order('at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('과거 봇 발언 조회 실패:', error.message);
    return [];
  }
  return (data ?? []).map((r) => r.text);
}