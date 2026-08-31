import { useState } from 'react';
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
 *  · 8/12: "클릭해도 반응이 없다" 버그 — 계약상 `myVote`는 "S2 내 지목 선택"
 *    전용 필드다(shared-types 주석 확인). botVote는 익명 투표라 서버가 "내가
 *    누굴 찍었는지"를 되돌려줄 필드 자체가 계약에 없다(botVoteCounts는 인원수
 *    집계뿐). 그런데도 이 컴포넌트는 강조 표시를 `state.myVote`로 판정하고
 *    있었다 — mock은 우연히 같은 필드를 재사용해 흉내 내서 마치 되는 것처럼
 *    보였을 뿐, 실 서버에서는 클릭해도 절대 강조되지 않는 게 정상 동작이었다.
 *    로컬 컴포넌트 상태로 직접 추적해 클릭 즉시 강조되게 고친다(서버 왕복과
 *    무관하게 항상 반응함).
 *  · 8/12: 익명 투표 안내 태그 제거 — "그런데, 이 중 한 명은 사람이 아니었습니다"
 *    문구만으로 이미 익명·색출 게임이라는 맥락이 충분히 전달된다는 판단.
 *  · 8/12: 이 팝업은 창 폭과 무관하게 항상 PC(세로 목록) 레이아웃으로 고정한다
 *    (zt-botvote 클래스 — game.css의 768px 미디어쿼리가 이 클래스 하위는 건드리지
 *    않게 스코프 처리했다). 투표 패널(VotePanel)의 모바일 원형 레이아웃과는 별개
 *    결정 — 그쪽은 계속 폰 폭에서 바뀐다.
 *
 *  GameScreen 이 Modal 로 감싸 메인화면 위에 띄운다 — 제목과 타이머는 Modal 이 그린다. */
export function BotVote({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  const [myBotVote, setMyBotVote] = useState<string | null>(null);

  const vote = (targetId: string) => {
    setMyBotVote(targetId);
    onEvent({ t: 'botVote', targetId });
  };

  return (
    <>
      <p className="zt-label">그런데, 이 중 한 명은 사람이 아니었습니다</p>

      <div className="zt-vote zt-botvote">
        <ul className="zt-vote-list">
          {state.players.map((p) => (
            <li key={p.id}>
              <button
                className={p.id === myBotVote ? 'zt-vote-row is-mine' : 'zt-vote-row'}
                onClick={() => vote(p.id)}
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
