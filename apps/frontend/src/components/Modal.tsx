import { useState } from 'react';
import type { ReactNode } from 'react';
import { Timer } from './Timer';

/** 페이즈 팝업의 공통 껍데기 — MainScreen 의 채팅 로그 영역 위에 얹힌다(Chat 이
 *  zt-chat-log 안에 그대로 꽂는다. 8/11부터 전체 화면이 아니라 이 영역으로 좁혔다 —
 *  투표 패널·입력창은 팝업 중에도 계속 보여야 하기 때문).
 *
 *  스크림이 채팅 로그만 덮는다. 채팅 입력 잠금은 여전히 MainScreen 이 blocked prop
 *  으로 따로 처리한다 — 서버 index.ts 의 chat 핸들러에는 phase 검사가 없어서
 *  (describe·vote·lifeVote·guessWord 와 달리) 화면이 막지 않으면 그대로 전송된다.
 *  그래서 두 겹으로 막는다.
 *
 *  ✕ 로 접으면(peek) 로그를 잠깐 들여다볼 수 있도록 자리를 비켜준다 — 대신 같은
 *  자리에 작은 칩만 남아 다시 펼칠 수 있다. 잠깐 들여다본다고 채팅 입력까지 다시
 *  풀리면 안 되므로 blocked 는 peek 여부와 무관하게 MainScreen 이 계속 유지한다.
 *
 *  ⚠️ 이 컴포넌트에 phase 로 key 를 주지 말 것. reveal → guessWord 는 한 흐름이라
 *  (설계 결정 5 "쪼개면 전환이 끊겨 보인다") 껍데기는 마운트된 채로 안쪽 내용만
 *  바뀌어야 한다. 대신 title 이 바뀌는 시점(= 새 페이즈로 실제 전환)에 peek 상태를
 *  초기화한다 — 안 그러면 이전 페이즈에서 접어둔 채로 다음 페이즈까지 이어진다.
 *  useEffect로 하면 리렌더가 한 번 더 끼어들어서(react-hooks/set-state-in-effect
 *  경고 대상) 대신 렌더 중 이전 title과 비교해 바로 갱신하는 방식을 쓴다
 *  (React 문서가 권하는 "이전 렌더 값 저장" 패턴). */
export function Modal({
  title,
  deadlineAt,
  children,
}: {
  title: string;
  /** 타이머 없는 페이즈는 null — Timer 가 알아서 영역을 숨긴다 */
  deadlineAt: number | null;
  children: ReactNode;
}) {
  const [peeked, setPeeked] = useState(false);
  const [prevTitle, setPrevTitle] = useState(title);
  if (title !== prevTitle) {
    setPrevTitle(title);
    setPeeked(false);
  }

  if (peeked) {
    return (
      <button type="button" className="zt-modal-chip" onClick={() => setPeeked(false)}>
        {title} 다시 보기
      </button>
    );
  }

  return (
    <div className="zt-modal-scrim">
      <div className="zt-modal" role="dialog" aria-modal="true" aria-label={title}>
        <div className="zt-modal-head">
          <span className="zt-sub">{title}</span>
          <span className="zt-modal-head-right">
            <Timer deadlineAt={deadlineAt} />
            <button
              type="button"
              className="zt-modal-close"
              aria-label="채팅 잠깐 보기"
              onClick={() => setPeeked(true)}
            >
              ✕
            </button>
          </span>
        </div>
        {children}
      </div>
    </div>
  );
}
