import type { PublicPlayer } from '@zeteo/shared-types';

interface Props {
  players: PublicPlayer[];
  /** 표 수만. 누가 누구를 찍었는지는 서버가 주지 않는다 — 화면에서 만들어내지 말 것 */
  voteCounts: Record<string, number>;
  /** 내 선택만 보인다 */
  myVote: string | null;
  myId: string;
  onVote: (targetId: string | null) => void;
}

export function VotePanel({ players, voteCounts, myVote, myId, onVote }: Props) {
  // 정렬하지 않는다 — 표가 바뀔 때마다 목록이 튀면 클릭 대상이 흔들린다.
  // 자기 자신도 후보에서 빼지 않는다 (룰북: 자기 자신에게 투표 가능, 제한 없음).
  const maxVotes = Math.max(1, ...players.map((p) => voteCounts[p.id] ?? 0));
  // 진행률 바는 목록과 별개 표시라 여기서만 정렬한다 — 0표는 바가 없어 보여줄 게 없다.
  const tallied = players
    .filter((p) => (voteCounts[p.id] ?? 0) > 0)
    .sort((a, b) => (voteCounts[b.id] ?? 0) - (voteCounts[a.id] ?? 0));

  // Avatar.tsx와 같은 규칙(마지막 단어의 첫 글자) — "참가자 4" 는 전부 "참"으로 시작해
  // 첫 글자로는 구분이 안 된다. 실제 구분값은 뒤에 붙는 번호다.
  const initialOf = (label: string) => {
    const tokens = label.trim().split(/\s+/);
    return tokens[tokens.length - 1]?.charAt(0) ?? '?';
  };

  return (
    <div className="zt-vote">
      <h3 className="zt-vote-title">투표 현황 (표 수만)</h3>
      <ul className="zt-vote-list">
        {players.map((p) => (
          <li key={p.id}>
            <button
              className={p.id === myVote ? 'zt-vote-row is-mine' : 'zt-vote-row'}
              onClick={() => onVote(p.id)}
            >
              <span>
                {p.label}
                {p.id === myId && ' (나)'}
              </span>
              <span className="zt-vote-count">{voteCounts[p.id] ?? 0}표</span>
            </button>
          </li>
        ))}
      </ul>

      {tallied.length > 0 && (
        <div className="zt-tally">
          {tallied.map((p) => (
            <div key={p.id} className="zt-tally-row">
              <span className="zt-tally-label">{initialOf(p.label)}</span>
              <span className="zt-tally-track">
                <span
                  className="zt-tally-fill"
                  style={{ width: `${((voteCounts[p.id] ?? 0) / maxVotes) * 100}%` }}
                />
              </span>
              <span className="zt-tally-count">{voteCounts[p.id] ?? 0}표</span>
            </div>
          ))}
        </div>
      )}

      <div className="zt-vote-mine">
        <span>내 선택</span>
        <strong>{myVote ? (players.find((p) => p.id === myVote)?.label ?? myVote) : '—'}</strong>
        {/* 기권 허용: 총 표 수가 인원보다 적을 수 있다 */}
        <button onClick={() => onVote(null)} disabled={myVote === null}>
          기권
        </button>
      </div>
    </div>
  );
}
