import { RoomInternalState } from './room';

export function tallyDebateVotes(room: RoomInternalState): {
  accusedId: string | null;
  tie: boolean;
} {
  const counts: Record<string, number> = {};

  for (const [voterId, targetId] of Object.entries(room.votes)) {
    if (!targetId) continue; // 기권 제외
    const voter = room.players.find((p) => p.id === voterId);
    // isAlive는 stateMachine.ts의 lifeVote→reveal 전이에서 처형된 사람에게 딱 한 번만
    // false가 되고, 그 뒤로는 debate로 다시 안 돌아온다. 즉 지금 게임 흐름상 이 시점엔
    // 항상 전원 살아있어서 이 필터가 실제로 뭔가를 거르는 경우는 없다 — 그래도 죽은
    // 사람의 표를 세지 않는다는 불변조건 자체는 이 함수의 계약이라 그대로 둔다.
    if (!voter?.isAlive) continue;

    counts[targetId] = (counts[targetId] ?? 0) + 1;
  }

  const entries = Object.entries(counts);
  if (entries.length === 0) {
    return { accusedId: null, tie: false }; // 아무도 지목 안 됨
  }

  const maxVotes = Math.max(...entries.map(([, c]) => c));
  const topCandidates = entries.filter(([, c]) => c === maxVotes).map(([id]) => id);

  if (topCandidates.length > 1) {
    return { accusedId: null, tie: true };
  }

  return { accusedId: topCandidates[0]!, tie: false };
}

export function tallyLifeVote(room: RoomInternalState): boolean {
  // true = 사살, false = 살린다. 동률이면 살린다(false).
  let kill = 0;
  let spare = 0;

  for (const [voterId, voteKill] of Object.entries(room.lifeVotes)) {
    const voter = room.players.find((p) => p.id === voterId);
    // 이 시점(lifeVote 단계)엔 아직 아무도 처형되지 않았다 — isAlive=false는 이 함수의
    // 결과로 처형이 확정된 뒤에야 붙는다(stateMachine.ts). tallyDebateVotes와 같은 이유로
    // 지금은 항상 통과하지만, 죽은 사람 표는 안 센다는 계약을 명시해둔다.
    if (!voter?.isAlive) continue;

    if (voteKill) kill++;
    else spare++;
  }

  return kill > spare;
}

export function tallyBotVoteResults(room: RoomInternalState): Record<string, boolean> {
  // 각 플레이어가 지목한 대상이 실제 봇이었는지 여부
  const results: Record<string, boolean> = {};

  // index.ts의 case 'botVote'는 targetId가 실제 존재하는 플레이어인지 검증 없이 그대로
  // room.botVotes에 저장한다. 여기서 target을 optional chaining으로 다루는 건 그 때문 —
  // 존재하지 않는 targetId가 들어와도 크래시 대신 "봇 아님(false)"으로 조용히 처리된다.
  for (const [voterId, targetId] of Object.entries(room.botVotes)) {
    const target = room.players.find((p) => p.id === targetId);
    results[voterId] = !!target?.isBot;
  }

  return results;
}
