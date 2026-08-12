import type { ClientEvent, GameState } from '@zeteo/shared-types';
import Avatar from '../components/Avatar';

/** S6 봇 지목 — 익명 투표. 기획서 v3.0로 담당이 파트 D → 파트 C로 이관되어
 *  기존 VoteScreen.tsx(독립 화면)를 대체한다.
 *
 *  · 익명이라 개별 득표수는 서버도 안 준다 — botVoteCounts는 "몇 명 투표했나"
 *    집계뿐이다(VotePanel의 voteCounts와 다른 점). 그래서 여기선 zt-vote-count를
 *    쓰지 않는다.
 *  · 선택은 클릭 즉시 반영된다(VotePanel·LifeVote와 동일 규칙) — VoteScreen 원본의
 *    "선택 후 확정 버튼" 2단계 대신, 이 화면 시스템의 즉시-반영 관례를 따른다.
 *    마감 전까지 다시 눌러 바꿀 수 있다.
 *
 *  GameScreen 이 Modal 로 감싸 메인화면 위에 띄운다 — 제목과 타이머는 Modal 이 그린다. */
export function BotVote({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  return (
    <>
      <p className="zt-label">그런데, 이 중 한 명은 사람이 아니었습니다</p>
      <span className="tag tag-outline">익명 투표</span>

      <div className="zt-vote">
        <ul className="zt-vote-list">
          {state.players.map((p) => (
            <li key={p.id}>
              <button
                className={p.id === state.myVote ? 'zt-vote-row is-mine' : 'zt-vote-row'}
                onClick={() => onEvent({ t: 'botVote', targetId: p.id })}
              >
                <span className="zt-vote-name">
                  <Avatar label={p.label} variant={p.id === state.myId ? 'mine' : 'default'} />
                  {p.label}
                  {p.id === state.myId && ' (나)'}
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>

      <p className="zt-muted">
        투표 현황 · {state.botVoteCounts.voted} / {state.botVoteCounts.total}명 완료
      </p>
    </>
  );
}
