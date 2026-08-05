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
