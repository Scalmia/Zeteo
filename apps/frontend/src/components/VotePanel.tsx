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
  /** 8/12: 파트 D가 묘사 페이즈용 "참가자 칩 목록"을 별도로 만들려 했던 걸 검토한 뒤,
   *  대신 이 목록을 묘사 순서 표시로 재사용하기로 했다(칩 목록 컴포넌트를 새로 안 만듦) —
   *  'vote'(기본) = 토론 페이즈 투표용, 'turn' = 묘사 페이즈 순서 표시용(클릭 불가,
   *  득표수·기권·투표 그래프 다 감춤, 현재 발언자만 강조). */
  mode?: 'vote' | 'turn';
  /** mode==='turn'일 때만 쓴다 — 현재 발언 차례인 참가자 id (GameState.currentTurn). */
  currentTurn?: string | null;
  /** 8/13: 투표 패널을 토론(debate) 페이즈가 아닌 다른 페이즈에서도 계속 띄워두기로
   *  하면서(요청: "페이즈가 바뀌어도 항상 보이게") 생긴 구분 — mode='vote'라도 지금이
   *  실제 투표 시점이 아니면 클릭이 먹으면 안 된다(엉뚱한 시점에 vote 이벤트가 나가면
   *  안 됨). 그래프·내 선택 표시 등 보여주는 내용은 그대로 두고 클릭만 막는다. */
  readOnly?: boolean;
}

export function VotePanel({
  players,
  voteCounts,
  myVote,
  myId,
  onVote,
  mode = 'vote',
  currentTurn = null,
  readOnly = false,
}: Props) {
  const isTurnMode = mode === 'turn';
  const isDisabled = isTurnMode || readOnly;
  // 정렬하지 않는다 — 표(또는 발언 순서)가 바뀔 때마다 목록이 튀면 클릭·시선 대상이 흔들린다.
  // 자기 자신도 후보에서 빼지 않는다 (룰북: 자기 자신에게 투표 가능, 제한 없음).

  // 투표 현황 그래프(8/10 시안 1 확정) — 위 후보 목록과 달리 클릭 대상이 아니라
  // 순수 요약이므로 여기서만 득표순 정렬한다. 표를 받은 사람만 막대로 그린다
  // (0표는 신호가 없다는 뜻 — 시안 1 원칙 그대로). 묘사 페이즈엔 투표 자체가 없으니
  // isTurnMode일 땐 그래프를 아예 안 그린다(8/12).
  const tally = players
    .map((p) => ({ id: p.id, label: p.label, count: voteCounts[p.id] ?? 0 }))
    .filter((row) => row.count > 0)
    .sort((a, b) => b.count - a.count);
  const maxCount = tally.length > 0 ? tally[0].count : 0;

  return (
    <div className="zt-vote">
      <h3 className="zt-vote-title">{isTurnMode ? '묘사 순서' : '투표 현황 (표 수만)'}</h3>
      <ul className="zt-vote-list">
        {players.map((p) => {
          const isCurrentTurn = isTurnMode && p.id === currentTurn;
          return (
            <li key={p.id}>
              <button
                type="button"
                className={
                  isCurrentTurn
                    ? 'zt-vote-row is-turn'
                    : p.id === myVote && !isTurnMode
                      ? 'zt-vote-row is-mine'
                      : 'zt-vote-row'
                }
                onClick={isDisabled ? undefined : () => onVote(p.id)}
                disabled={isDisabled}
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
                {/* 득표수 자리 — 묘사 모드에선 표 대신 "제시어 묘사중"으로 바뀐다(현재
                    발언자만), 나머지는 이 자리를 비운다. 폰 폭에서는 zt-vote-turn-tag를
                    CSS로 숨긴다 — 원형 버튼이 51px라 "제시어 묘사중" 문구가 안 들어간다,
                    is-turn 링 강조만으로 신호를 준다(8/12, zt-vote-label과 같은 처리). */}
                {isTurnMode ? (
                  isCurrentTurn && <span className="zt-vote-turn-tag">제시어 묘사중</span>
                ) : (
                  <span className="zt-vote-count">{voteCounts[p.id] ?? 0}표</span>
                )}
              </button>
            </li>
          );
        })}
        {/* 기권 — 시안 1 스케치와 같이 별도 버튼이 아니라 투표 선택지 중 하나로
            둔다(8/11). 총 표 수가 인원보다 적을 수 있다는 규칙(기권 허용)은 그대로다 —
            이미 기권(또는 아직 미투표) 상태면 다시 눌러도 의미가 없어 비활성화한다.
            묘사 페이즈엔 투표 자체가 없으니 isTurnMode일 땐 안 그린다(8/12). */}
        {!isTurnMode && (
          <li>
            <button
              className={
                myVote === null ? 'zt-vote-row zt-vote-row-abstain is-mine' : 'zt-vote-row zt-vote-row-abstain'
              }
              onClick={readOnly ? undefined : () => onVote(null)}
              disabled={myVote === null || readOnly}
            >
              <span className="zt-vote-name">기권</span>
            </button>
          </li>
        )}
      </ul>

      {!isTurnMode && tally.length > 0 && (
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
