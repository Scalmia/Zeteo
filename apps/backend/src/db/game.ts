import { supabase } from './supabase';
import { InternalPlayer } from '@zeteo/shared-types';
import { tallyBotVoteResults } from '../vote';
import { RoomInternalState } from '../room';
// 판마다 "실제로 무엇이 돌았는지"를 남기기 위해 쓴다 — 아래 startGame 주석 참고.
import { provider, currentModel } from '../bot/llm';

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
  const gameId = data as string;

  // 어떤 봇이 돌았는지를 판마다 남긴다. 이게 없으면 프롬프트를 바꾼 전후 판이 한 덩어리로
  // 섞여서 "개선됐다"를 증명할 근거가 사라진다.
  //
  // 커밋 SHA 만 남기지 않는 이유: /x/provider 가 재배포 없이 프로바이더를 바꾼다
  // (bot/admin-route.ts). 그래서 같은 SHA 인데 실제로는 다른 모델이 말한 판이 생긴다 —
  // SHA 로만 나누면 그 판들이 같은 봇으로 집계된다. 실제로 무엇이 돌았는지를 같이 남긴다.
  //
  // 별도 UPDATE 인 이유: games 행은 fn_start_game(Postgres 함수)이 만드는데 그 정의가
  // 저장소에 없다(DB 안에만 있음). 시그니처를 늘리면 레포에 흔적이 안 남아서, 함수는
  // 그대로 두고 여기서 한 번 더 쓴다.
  //
  // 실패해도 throw 하지 않는다 — 부가 기록이라 이것 때문에 판이 안 시작되면 안 된다.
  const { error: versionErr } = await supabase
    .from('games')
    .update({
      // Railway 가 배포마다 주입한다. 로컬 실행엔 없어서 null 로 떨어지는데, 그게 맞다 —
      // 없는 값을 'local' 같은 문자열로 채우면 판 집계에 섞인다.
      bot_commit_sha: process.env.RAILWAY_GIT_COMMIT_SHA ?? null,
      bot_provider: provider(),
      bot_model: currentModel(),
    })
    .eq('id', gameId);
  if (versionErr) console.error(`[${roomId}] 봇 버전 기록 실패:`, versionErr.message);

  return gameId;
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