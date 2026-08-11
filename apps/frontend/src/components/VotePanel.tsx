import type { PublicPlayer } from '@zeteo/shared-types';
import Avatar from './Avatar';
import { avatarInitial } from './avatarInitial';

interface Props {
  players: PublicPlayer[];
  /** 표 수만. 누가 누구를 찍었는지는 서버가 주지 않는다 — 화면에서 만들어내지 말 것 */
  voteCounts: Record<string, number>;
  /** 내 선택만 보인다. null = 기권(또는 아직 투표 전) */
  myVote: string | null;
  myId: string;
  onVote: (targetId: string | null) => void;
}

export function VotePanel({ players, voteCounts, myVote, myId, onVote }: Props) {
  // 정렬하지 않는다 — 표가 바뀔 때마다 목록이 튀면 클릭 대상이 흔들린다.
  // 자기 자신도 후보에서 빼지 않는다 (룰북: 자기 자신에게 투표 가능, 제한 없음).

  // 투표 현황 그래프(8/10 시안 1 확정) — 위 후보 목록과 달리 클릭 대상이 아니라
  // 순수 요약이므로 여기서만 득표순 정렬한다. 표를 받은 사람만 막대로 그린다
  // (0표는 신호가 없다는 뜻 — 시안 1 원칙 그대로).
  const tally = players
    .map((p) => ({ id: p.id, label: p.label, count: voteCounts[p.id] ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = tally.length > 0 ? tally[0].count : 0;

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
              <span className="zt-vote-name">
                {/* isAlive 기반 dead 표시는 넣지 않는다 — 이 게임엔 "토론 도중 탈락한
                    채 게임이 계속되는" 상태가 없다. 생사 투표에서 죽으면 그 판이 그대로
                    끝난다(reveal → guessWord → result), 토론으로 돌아오지 않는다. */}
                <Avatar label={p.label} variant={p.id === myId ? 'mine' : 'default'} />
                {/* zt-vote-label로 감싼 이유: 시안 1은 폰 폭에서 후보를 원형 아이콘
                    (아바타+득표수)만으로 가로 나열한다 — 이름 글자는 아바타로 이미
                    식별되니 폰에서만 CSS로 숨긴다(PC는 그대로 보임, 8/11). */}
                <span className="zt-vote-label">
                  {p.label}
                  {p.id === myId && ' (나)'}
                </span>
              </span>
              <span className="zt-vote-count">{voteCounts[p.id] ?? 0}표</span>
            </button>
          </li>
        ))}
        {/* 기권 — 시안 1 스케치와 같이 별도 버튼이 아니라 투표 선택지 중 하나로
            둔다(8/11). 총 표 수가 인원보다 적을 수 있다는 규칙(기권 허용)은 그대로다 —
            이미 기권(또는 아직 미투표) 상태면 다시 눌러도 의미가 없어 비활성화한다. */}
        <li>
          <button
            className={myVote === null ? 'zt-vote-row zt-vote-row-abstain is-mine' : 'zt-vote-row zt-vote-row-abstain'}
            onClick={() => onVote(null)}
            disabled={myVote === null}
          >
            <span className="zt-vote-name">기권</span>
          </button>
        </li>
      </ul>

      {tally.length > 0 && (
        <div className="zt-tally">
          {tally.map((row) => (
            <div key={row.id} className={row.id === myVote ? 'zt-tally-row is-mine' : 'zt-tally-row'}>
              <span className="zt-tally-label">{avatarInitial(row.label)}</span>
              <span className="zt-tally-bar">
                <span className="zt-tally-fill" style={{ width: `${(row.count / maxCount) * 100}%` }} />
              </span>
              <span className="zt-tally-count">
                {row.count}표{row.id === myVote && ' · 내 선택'}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
