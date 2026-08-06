import { RoomInternalState } from './room';

export function tallyDebateVotes(room: RoomInternalState): {
  accusedId: string | null;
  tie: boolean;
} {
  const counts: Record<string, number> = {};

  for (const [voterId, targetId] of Object.entries(room.votes)) {
    if (!targetId) continue; // 기권 제외
    const voter = room.players.find((p) => p.id === voterId);
    if (!voter?.isAlive) continue; // 살아있는 사람만 투표권

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
    if (!voter?.isAlive) continue;

    if (voteKill) kill++;
    else spare++;
  }

  return kill > spare;
}

export function tallyBotVoteResults(room: RoomInternalState): Record<string, boolean> {
  // 각 플레이어가 지목한 대상이 실제 봇이었는지 여부
  const results: Record<string, boolean> = {};

  for (const [voterId, targetId] of Object.entries(room.botVotes)) {
    const target = room.players.find((p) => p.id === targetId);
    results[voterId] = !!target?.isBot;
  }

  return results;
}
