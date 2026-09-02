import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { ChatInputBar, ChatLog } from '../components/Chat';
import { Timer } from '../components/Timer';
import { VotePanel } from '../components/VotePanel';

/** 게임 페이즈 내내 항상 떠 있는 단일 화면 — 채팅 + 투표.
 *
 *  기존 Describe(S1)·Debate(S2)·FinalDefense(S3) 세 화면을 하나로 합친 것이다.
 *  세 화면이 실제로 달랐던 건 아래 네 가지뿐이라 조건 몇 개로 흡수된다.
 *    · 채팅 잠금 여부와 전송 이벤트 (describe 만 't: describe')
 *    · 투표 패널 노출 (debate 만)
 *    · 지목 배너 (finalDefense 만)
 *    · 헤더 문구
 *
 *  roleReveal·lifeVote·reveal·guessWord·botVote 는 이 화면 위에 팝업으로 뜨고,
 *  그동안 blocked=true 로 채팅이 잠긴다. 팝업(modal)은 8/11부터 전체 화면이 아니라
 *  Chat의 채팅 로그 영역 위에만 얹힌다 — 그대로 Chat에 넘겨줄 뿐 여기선 조립하지
 *  않는다(GameScreen이 조립해서 내려준다, 설계 결정: Modal은 phase로 key를 받지
 *  않아야 하므로 조립 지점을 하나로 유지).
 *
 *  ⚠️ 8/11 레이아웃 재정리: 시안 1(Zeteo_와이어프레임_시안.html)을 다시 맞춰보니
 *  투표 요약탭(zt-vote-bar)·입력창(zt-chat-input)이 채팅 기둥 폭이 아니라 화면
 *  전체 폭으로 늘어나야 했다 — 이전엔 둘 다 zt-chat 안에 있어서 zt-side-wide(우측
 *  투표 패널, 260px)만큼 폭이 줄어 있었다. 그래서 구조를 다음처럼 나눴다.
 *    zt-stage(채팅 로그 | 투표 패널, 나란히) → zt-vote-bar(전체 폭) → 입력창(전체 폭)
 *  이러면 우측 투표 패널의 아랫변이 zt-vote-bar 윗변과 맞붙는다(둘 다 같은 폭 그룹의
 *  경계라 gap이 없으면 자동으로 붙는다) — "우측 투표창이 하단바랑 떨어져 있다"는
 *  문제가 이 구조 변경만으로 해결된다. 모바일에서 로그↔투표 패널↔요약탭↔입력창을
 *  order로 재배치하던 이전의 display:contents 트릭도 이제 필요 없다 — 셋이 이미
 *  DOM 순서 그대로 원하는 시각적 순서다(시안 1도 같은 DOM 순서를 쓴다). */

function phaseLabel(phase: GameState['phase']): string {
  switch (phase) {
    case 'describe':
      return '묘사';
    case 'debate':
      return '토론 · 투표 진행 중';
    case 'finalDefense':
      return '최후 변론';
    case 'roleReveal':
      return '역할 배정';
    case 'lifeVote':
      return '생사 투표';
    case 'reveal':
      return '결과';
    case 'guessWord':
      return '제시어 추측';
    case 'botVote':
      return '봇 지목';
    default:
      return ''; // lobby·result·survey 는 파트 D 담당이라 여기 오지 않는다
  }
}

export function MainScreen({
  state,
  onEvent,
  blocked,
  modal,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
  /** 팝업이 떠 있는 동안 true. 잠금 규칙을 컴포넌트가 스스로 알지 않게 위에서 내려준다 */
  blocked: boolean;
  /** GameScreen이 조립한 <Modal> 엘리먼트(또는 null). ChatLog가 채팅 로그 위에 얹는다 */
  modal?: ReactNode;
}) {
  const isDescribe = state.phase === 'describe';
  const isDebate = state.phase === 'debate';
  const isFinalDefense = state.phase === 'finalDefense';

  // 폰 폭(≤768px)에서 투표 패널을 여닫는 하단 시트 상태. 데스크톱에선 game.css가
  // is-collapsed를 무시하고 항상 펼쳐 보이므로 이 값은 폰에서만 의미가 있다.
  //
  // ⚠️ 기획서 v3.0 D3: "세로로 이어붙이는 방식은 배제한다"(채팅→투표→입력창 순서로
  // 쭉 쌓는 것). 이 상태 없이 CSS만으로 세로 배치하면 정확히 그 배제 대상이 된다 —
  // 시안 1이 검증한 "하단 시트(접이식)"로 만들어야 스펙이 허용한 두 후보 중 하나가 된다.
  //
  // 8/13: 투표 패널·요약탭을 전 페이즈에서 항상 띄워두기로 하면서(요청: "페이즈가
  // 바뀌어도 항상 보이게"), 폰에서는 대신 "투표시(토론)에만 저절로 열리고, 다른
  // 페이즈에선 접힌 채로 시작하되 탭을 눌러 볼 수는 있게" 하기로 함 — isDebate가
  // 바뀔 때만 자동으로 열고/닫는다. isDebate가 그대로인 동안은(같은 토론이 계속되는
  // 중이든, 다른 비-토론 페이즈끼리 넘어가는 중이든) 사용자가 직접 누른 상태를
  // 존중해 이 effect가 되돌리지 않는다.
  //
  // 8/20: "묘사단계 시작할 때도 (묘사순서 보여주는) 투표 패널이 열린 채로 시작"
  // 요청으로 자동으로 열리는 페이즈에 describe를 추가함 — shouldAutoOpenVote가
  // false→true로 바뀌는 시점(비-토론·비-묘사 페이즈에서 describe 또는 debate로
  // 들어오는 순간)에만 열리고, describe↔debate 사이를 오갈 때처럼 그 값이 그대로면
  // 위와 같은 이유로 사용자가 직접 닫은 상태를 되돌리지 않는다.
  const shouldAutoOpenVote = isDebate || isDescribe;
  const [voteOpen, setVoteOpen] = useState(shouldAutoOpenVote);
  useEffect(() => {
    setVoteOpen(shouldAutoOpenVote);
  }, [shouldAutoOpenVote]);

  // 8/14: 채팅 입력창에 포커스가 가 있는 동안엔 투표 패널(모바일 하단 시트)을 강제로
  // 접는다 — 요청: "투표창이 열려있으니까 채팅 화면을 많이 가린다". voteOpen 자체를
  // 건드리지 않고 렌더링에만 쓰는 별도 값(voteVisible)으로 분리한 이유: voteOpen은
  // "사용자가 마지막으로 원한 열림/닫힘 상태"(위 isDebate effect·zt-vote-bar 클릭이
  // 갱신하는 값)라 포커스 때문에 값을 직접 바꿔버리면 블러 후 원래 상태로 못 돌아온다.
  // 포커스가 풀리면(전송하거나 다른 곳을 탭하면) voteVisible이 voteOpen을 그대로
  // 따라가므로 자동으로 원래 열림/닫힘 상태가 복원된다. 데스크톱에선 is-collapsed에
  // 대응하는 CSS 규칙 자체가 768px 이하 미디어쿼리 안에만 있어(game.css) 이 값이
  // false가 돼도 시각적 변화가 없다 — 폭 분기 없이 그냥 적용해도 안전.
  // ⚠️ 제시어 추측(guessWord) 팝업의 입력창은 완전히 다른 컴포넌트(Reveal.tsx)이고,
  // 그 페이즈에선 애초에 채팅이 blocked라 이 ChatInputBar 자체가 안 보인다 — 여기 포커스
  // 로직과는 무관하다.
  const [chatFocused, setChatFocused] = useState(false);
  const voteVisible = chatFocused ? false : voteOpen;

  // 전체화면 버튼(8/14) — 모바일 주소창·하단 메뉴바가 위아래를 가리는 문제 대응.
  // document.fullscreenEnabled 로 지원 여부를 확인해, 지원 안 하는 브라우저(대표적으로
  // iOS Safari — video 제외 Fullscreen API 자체를 지원하지 않는다, game.css 8/14 주석
  // 참고)에서는 버튼을 아예 렌더링하지 않는다. fullscreenchange 이벤트로 아이콘 상태를
  // 실제 전체화면 여부와 항상 맞춘다(다른 방법으로 전체화면이 풀렸을 때도 동기화되도록).
  const fullscreenSupported = typeof document !== 'undefined' && document.fullscreenEnabled;
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== 'undefined' && !!document.fullscreenElement,
  );
  useEffect(() => {
    if (!fullscreenSupported) return;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener('fullscreenchange', onChange);
    return () => document.removeEventListener('fullscreenchange', onChange);
  }, [fullscreenSupported]);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  const isMyTurn = state.currentTurn === state.myId;
  const turnName = state.players.find((p) => p.id === state.currentTurn)?.label ?? '';
  // 진행도: turnOrder 안에서 현재 차례가 몇 번째인가. 계약에 currentTurnIndex 는 없지만
  // turnOrder + currentTurn 으로 구할 수 있어 필드를 새로 요구하지 않는다.
  const turnIndex = state.currentTurn ? state.turnOrder.indexOf(state.currentTurn) : -1;

  const accused = state.players.find((p) => p.id === state.accused);
  const accusedVotes = state.accused ? (state.voteCounts[state.accused] ?? 0) : 0;

  // 잠금 규칙은 여기 한 곳에서만 정한다. ChatInputBar 는 prop 으로 받기만 한다 (설계 결정 6).
  const locked = blocked || (isDescribe && !isMyTurn);
  const lockedLabel = blocked ? '지금은 발언할 수 없습니다' : `${turnName}님의 차례입니다`;

  return (
    <div className="zt-screen">
      <header className="zt-head">
        {/* 팀 로고 + 이름 — 8/10 시안 1 확정. Zeteo-logo3.png의 원형 'O' 부분만
            잘라 public/zeteo-o.png로 뒀다(파비콘과 같은 정적 파일 관례). */}
        <span className="zt-brand">
          <img className="zt-brand-icon" src="/zeteo-o.png" alt="" />
          <span className="zt-brand-name">ZETEO</span>
        </span>

        <span className="zt-sub">
          {/* round 는 "지금 몇 번째 루프인가"라는 상태. 왜 돌아왔는지(사건)는
              시스템 메시지가 맡는다 — 대체 관계가 아니다 (설계 결정 10) */}
          <span className="zt-round">{state.round}라운드</span>
          {phaseLabel(state.phase)}
        </span>

        {/* 좌측 참가자 목록을 없애면서 발언 순서·진행도가 갈 곳이 여기 하나뿐이다 */}
        {isDescribe && turnIndex >= 0 && (
          <span className="zt-turn">
            묘사 {turnIndex + 1}/{state.turnOrder.length}
            <span className="zt-turn-mark">▶</span>
            {turnName}
          </span>
        )}

        {/* 제시어 — 시안 1 D4 답: 묘사 때만이 아니라 전 페이즈에서 헤더에 상시
            고정. 라이어는 word가 null이라 "???"로 뜬다 — 자리를 비우면
            "안 보이는 것" 자체가 단서가 되므로 카테고리와 같은 자리·같은
            크기를 유지한다(8/11). */}
        <span className="zt-word">
          <span className="zt-word-cat">{state.category} /</span> {state.word ?? '???'}
        </span>

        <Timer deadlineAt={state.deadlineAt} />

        {fullscreenSupported && (
          <button
            type="button"
            className="zt-fullscreen-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? '전체화면 종료' : '전체화면'}
            title={isFullscreen ? '전체화면 종료' : '전체화면'}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        )}
      </header>

      {isFinalDefense && (
        <div className="zt-accused">
          <span className="zt-badge">지목됨</span>
          <strong>{accused?.label}</strong>
          <span className="zt-vote-count">{accusedVotes}표</span>
        </div>
      )}

      <div className="zt-stage">
        <ChatLog messages={state.messages} players={state.players} myId={state.myId} modal={modal} />

        {/* 8/12: 파트 D가 묘사 페이즈용 참가자 칩 목록을 새로 만들려던 걸 검토 후
            폐기 — 대신 이 투표 패널을 묘사 페이즈에도 그대로 띄우고 mode='turn'으로
            발언 순서 표시로 바꿔 쓴다(칩 목록 컴포넌트를 새로 안 만듦, 자세한 배경은
            [[zeteo-partc]] 참고).
            8/13: describe·debate 두 페이즈로만 좁혀뒀던 걸 전 페이즈로 넓혔다(요청:
            "페이즈가 바뀌어도 투표창이 항상 보이게") — 원래 설계 의도(GameScreen.tsx
            주석: "투표 패널·입력창은 팝업 중에도 계속 보여야 한다")와도 맞다. 토론이
            아닌 페이즈에선 마지막으로 반영된 투표 현황을 읽기 전용으로 계속 보여준다
            (readOnly, 아래 참고) — 클릭해서 새로 투표하는 건 토론 페이즈에서만. */}
        <aside
          id="zt-vote-panel"
          className={voteVisible ? 'zt-side-wide' : 'zt-side-wide is-collapsed'}
        >
          <VotePanel
            players={state.players}
            voteCounts={state.voteCounts}
            myVote={state.myVote}
            myId={state.myId}
            onVote={(targetId) => onEvent({ t: 'vote', targetId })}
            mode={isDescribe ? 'turn' : 'vote'}
            currentTurn={state.currentTurn}
            readOnly={!isDebate}
          />
        </aside>
      </div>

      {/* 여닫이 손잡이 겸 상시 요약탭 — 시안 1은 폰뿐 아니라 데스크톱에서도 항상
          떠 있다(데스크톱은 투표 패널이 이미 펼쳐져 있어 여닫을 게 없을 뿐, 탭
          자체는 계속 보인다). 화면 폭 전체를 쓰는 이유는 위 컴포넌트 주석 참고.
          묘사 페이즈엔 문구를 발언 순서 기준으로 바꾼다(8/12).
          8/13: 위 투표 패널과 같은 이유로 describe·debate 제한을 없애 전 페이즈에서
          계속 보이게 했다 — 폰에서 눌러 여닫는 대상 자체(zt-vote-panel)가 이제 항상
          DOM에 있으므로 탭도 항상 같이 있어야 한다. */}
      <button
        type="button"
        className="zt-vote-bar"
        aria-expanded={voteVisible}
        aria-controls="zt-vote-panel"
        onClick={() => setVoteOpen((open) => !open)}
      >
        <span className="zt-vote-bar-label">
          {isDescribe ? (
            <>발언 순서 · {turnName || '없음'}님 묘사 중</>
          ) : (
            <>
              투표 현황 · 내 선택{' '}
              {state.myVote
                ? (state.players.find((p) => p.id === state.myVote)?.label ?? state.myVote)
                : '없음'}
            </>
          )}
        </span>
        {/* 시안 1의 .bar .t — 요약탭 우측, 여닫이 화살표 바로 왼쪽(8/11) */}
        <Timer deadlineAt={state.deadlineAt} />
        <span className="zt-vote-bar-chev" aria-hidden="true">
          {voteVisible ? '▼' : '▲'}
        </span>
      </button>

      <ChatInputBar
        locked={locked}
        lockedLabel={lockedLabel}
        placeholder={isDescribe ? '묘사를 입력하세요…' : '메시지 입력…'}
        onSend={(text) => onEvent(isDescribe ? { t: 'describe', text } : { t: 'chat', text })}
        onFocus={() => setChatFocused(true)}
        onBlur={() => setChatFocused(false)}
      />
    </div>
  );
}
