import { GameState, PublicPlayer, SurveyReason } from '@zeteo/shared-types';
import { RoomInternalState } from './room';
import { tallyBotVoteResults } from './vote';

// TODO(박진/기획): 실제 문구는 설문 기획 확정되면 교체 — 지금은 타입/개수만 맞춘 placeholder
const SURVEY_REASONS: SurveyReason[] = [
  { id: 1, label: '말이 어색했다' },
  { id: 2, label: '반응이 느렸다' },
  { id: 3, label: '다른 사람들과 다른 정보를 아는 것 같았다' },
  { id: 4, label: '그냥 감이었다' },
];

function countBotVoteProgress(room: RoomInternalState): { voted: number; total: number } {
  // isVotingComplete(index.ts)와 같은 기준: 봇 제외, 죽은 사람도 투표 대상에 포함
  const humans = room.players.filter((p) => !p.isBot);
  const voted = humans.filter((p) => room.botVotes[p.id] !== undefined).length;
  return { voted, total: humans.length };
}

// TODO(Day 4): vote.ts가 생기면 이 두 함수는 지우고 거기서 import
function countVotes(votes: Record<string, string | null>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const targetId of Object.values(votes)) {
    if (!targetId) continue;
    counts[targetId] = (counts[targetId] ?? 0) + 1;
  }
  return counts;
}

function countLifeVotes(lifeVotes: Record<string, boolean>): { kill: number; spare: number } {
  const counts = { kill: 0, spare: 0 };
  for (const kill of Object.values(lifeVotes)) {
    if (kill) counts.kill++;
    else counts.spare++;
  }
  return counts;
}

export function buildGameStateFor(room: RoomInternalState, playerId: string): GameState {
  const me = room.players.find((p) => p.id === playerId);
  if (!me) throw new Error(`player ${playerId} not in room`);

  // B-4: survey가 result에서 분리된 별도 phase가 되면서, "게임이 끝난 뒤"를 의미하던
  // room.phase === 'result' 체크들이 survey로 넘어가는 순간 전부 false가 되어버린다.
  // 그러면 방금 공개됐던 봇 정체/라이어/제시어/승패가 설문 화면에서 다시 숨겨지는
  // 회귀가 생기므로, "결과가 이미 공개된 상태"를 result·survey 둘 다로 정의한다.
  const isPostGame = room.phase === 'result' || room.phase === 'survey';

  const publicPlayers: PublicPlayer[] = room.players.map((p) => ({
    id: p.id,
    label: p.label,
    isAlive: p.isAlive,
    isReady: room.readyIds.has(p.id),
  }));

  return {
    roomId: room.roomId,
    phase: room.phase,
    players: publicPlayers,
    category: room.category,
    // ★ A-4 수정: 게임이 끝난 뒤(result·survey)엔 라이어에게도 제시어를 공개해야 한다
    // (기존엔 phase 조건이 없어서 게임이 끝나도 라이어는 제시어를 영영 못 봤다).
    word: me.role === 'liar' && !isPostGame ? null : room.word,
    myRole: me.role,
    turnOrder: room.turnOrder,
    currentTurn: room.turnOrder[room.currentTurnIndex] ?? null,
    deadlineAt: room.deadlineAt,
    messages: room.messages,
    voteCounts: countVotes(room.votes),
    myVote: room.votes[playerId] ?? null,
    accused: room.accusedId,

    myId: playerId,
    round: room.round,
    myLifeVote: room.lifeVotes[playerId] ?? null,
    lifeVoteCounts: countLifeVotes(room.lifeVotes),
    revealedRole: room.revealedRole,
    // ★ 변경: 게임이 끝나기 전(result·survey 이전)엔 무조건 null로 감춤
    // (내부적으론 이미 계산돼 있어도 노출 안 함)
    liarGameResult: isPostGame ? room.liarGameResult : null,

    // result·survey에서만 실제 값
    // botVote 진행도는 스포일러가 아니라 언제나 실제 값 (투표 안 한 phase에선 room.botVotes가
    // 비어있으니 자연스럽게 voted:0으로 나옴)
    botVoteCounts: countBotVoteProgress(room),

    // ★ 설계원칙 5 (봇 정보 유출 금지) — 아래 세 필드는 반드시 게임이 끝난 뒤(result·survey)에만
    // 채운다. 한 단계라도 먼저 노출되면 개발자도구로 결과를 미리 볼 수 있게 된다.
    botVoteCorrectCount:
      isPostGame ? Object.values(tallyBotVoteResults(room)).filter(Boolean).length : 0,
      botVoteResults: isPostGame ? room.botVotes : null, 
    revealedBotId:
      isPostGame ? (room.players.find((p) => p.isBot)?.id ?? null) : null,
    revealedLiarId:
      isPostGame ? (room.players.find((p) => p.role === 'liar')?.id ?? null) : null,

    revealedNames:                         // ★ 추가
      isPostGame
        ? Object.fromEntries(room.players.map((p) => [p.id, p.name]))
        : null,
    // 설문 선택지는 survey 화면에서만 필요하다 (result·survey 공통이 아니라 survey 단독).
    botVoteResults: isPostGame ? room.botVotes : null,
    reasons: room.phase === 'survey' ? SURVEY_REASONS : [],
  };
}
