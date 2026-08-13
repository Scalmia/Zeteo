import { useEffect, useRef, useState } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Modal } from '../components/Modal';
import { MainScreen } from '../screens/MainScreen';
import { modalFor } from '../screens/modalFor';
import { MOCK_STATES } from './states';

/** 팝업 5종. 각 칩은 이미 검증된 기존 MOCK_STATES 항목을 그대로 재사용한다
 *  (accused·revealedRole 같은 팝업별 필요 필드를 다시 채우는 실수를 없애려고 —
 *  각 mock이 이미 그 조합을 맞춰 갖고 있다). */
const POPUP_CHIPS: { label: string; key: string }[] = [
  { label: '역할 배정', key: 'roleReveal-citizen' },
  { label: '생사 투표', key: 'lifeVote-voter' },
  { label: '결과', key: 'reveal-liar' },
  { label: '제시어 추측', key: 'guessWord-liar' },
  { label: '봇 지목', key: 'botVote' },
];

/** 실제 GameScreen 레이아웃(채팅+투표+팝업)을 서버 없이 통째로 확인하는
 *  mock 전용 화면. `?mock=` 목록 최상단에 노출된다.
 *
 *  ⚠️ 8/11 두 번째 수정: 칩을 누르면 화면 자체(state)를 통째로 바꿔치기하던 걸
 *  그만뒀다 — 실제 게임에서 팝업 5종은 "지금 보고 있는 채팅+투표 화면 위에
 *  얹히는 것"이지 화면 전환이 아닌데, mock이 칩마다 다른 MOCK_STATES를
 *  통째로 넣다 보니 팝업을 열 때마다 뒤의 채팅 로그·투표 현황까지 같이
 *  바뀌어 보였다. 그래서 기본 화면(baseState)과 팝업 내용(popupState)을
 *  분리했다 — 칩은 popupState만 갈아 끼우고 baseState는 항상 'debate-voted'
 *  그대로다.
 *
 *  GameScreen을 통째로 쓰지 않고 MainScreen을 직접 조립하는 이유가 이거다 —
 *  modal 자리(zt-chat-log 안, position:relative 기준)에 실제 팝업과 칩 바를
 *  같이 꽂아야 팝업을 안 닫고도 다른 칩으로 바로 넘어가 볼 수 있다. modalFor는
 *  GameScreen과 같은 함수를 그대로 가져와 쓴다(어떤 phase에 어떤 팝업인지
 *  판단은 그 한 곳만 기준이어야 다른 자리에서 실수로 어긋나지 않는다). */
export function GameScreenTest() {
  const [baseState, setBaseState] = useState<GameState>(MOCK_STATES['debate-voted']);
  const [popupKey, setPopupKey] = useState<string | null>(null);
  const [popupState, setPopupState] = useState<GameState | null>(null);

  // 8/13: 팝업 스크롤 고정(zt-chat-log-wrap)·새 메시지 알림 핀(zt-chat-newmsg)을
  // 눈으로 직접 켜보고 테스트하기 위한 mock 전용 도구 — 참가자가 돌아가며 "1·2·3·4"를
  // 세는 채팅을 5초마다 하나씩 자동으로 채팅 로그에 추가한다. 기본은 꺼짐(off) —
  // 로그가 계속 쌓이면 다른 mock 조작(칩 전환 등)을 하기 불편하므로, 테스트할 때만
  // 켜고 충분히 쌓이면 꺼서 멈출 수 있게 토글로 뒀다. 배포 코드 경로(GameScreen.tsx)엔
  // 안 쓰이는 mock 전용 기능이라 여기(GameScreenTest.tsx)에만 둔다.
  const [autoChat, setAutoChat] = useState(false);
  const autoChatCountRef = useRef(0);

  useEffect(() => {
    if (!autoChat) return;
    const interval = setInterval(() => {
      autoChatCountRef.current += 1;
      const n = autoChatCountRef.current;
      setBaseState((s) => {
        const speaker = s.players[(n - 1) % s.players.length];
        return {
          ...s,
          messages: [
            ...s.messages,
            {
              id: `autochat${Date.now()}_${n}`,
              speakerId: speaker.id,
              text: String(((n - 1) % 4) + 1),
              phase: s.phase,
              at: Date.now(),
            },
          ],
        };
      });
    }, 5000);
    return () => clearInterval(interval);
  }, [autoChat]);

  const openPopup = (key: string) => {
    setPopupKey(key);
    setPopupState(MOCK_STATES[key]);
  };
  const closePopup = () => {
    setPopupKey(null);
    setPopupState(null);
  };

  // 서버가 없으므로 이벤트를 로컬 상태에 즉시 반영해 상호작용만 확인한다
  // (MockHarness의 onEvent와 같은 패턴). 'vote'는 기본 화면(토론 투표 패널)
  // 소관이라 baseState를, 'lifeVote'·'botVote'는 팝업 안 상호작용이라
  // popupState를 갱신한다 — 서로 건드리지 않는다.
  //
  // ⚠️ 8/11 7차: 'vote'가 myVote만 바꾸고 voteCounts는 그대로 둬서, 후보를
  // 눌러도 투표 현황 그래프(zt-tally, voteCounts 기반)가 안 바뀌는 것처럼
  // 보였다("실시간 수정이 제대로 안 되는 것 같다" 지적) — 그래프에 표를 받은
  // 사람만 뜨는 게 원래 규칙(0표는 표시 안 함)인데, 카운트 자체가 안 바뀌니
  // 새로 찍은 후보가 계속 목록에 안 떴다. 실 서버라면 재투표할 때마다 서버가
  // 집계를 다시 보내주지만 mock은 서버가 없으므로, 여기서 "이전에 내가 찍었던
  // 후보 표를 빼고 새로 찍은 후보에 표를 더하는" 최소한의 재집계를 직접
  // 시뮬레이션한다(기권=null로 바꾸면 표만 빠지고 아무도 안 더해진다).
  const onEvent = (e: ClientEvent) => {
    console.log('[mock] ClientEvent', e);
    if (e.t === 'vote') {
      setBaseState((s) => {
        const voteCounts = { ...s.voteCounts };
        if (s.myVote) voteCounts[s.myVote] = Math.max(0, (voteCounts[s.myVote] ?? 0) - 1);
        if (e.targetId) voteCounts[e.targetId] = (voteCounts[e.targetId] ?? 0) + 1;
        return { ...s, myVote: e.targetId, voteCounts };
      });
    }
    if (e.t === 'lifeVote') setPopupState((s) => (s ? { ...s, myLifeVote: e.kill } : s));
    if (e.t === 'botVote') setPopupState((s) => (s ? { ...s, myVote: e.targetId } : s));
  };

  const modalInfo = popupState && modalFor(popupState, onEvent);
  const realModal = modalInfo && (
    <Modal title={modalInfo.title} deadlineAt={popupState!.deadlineAt}>
      {modalInfo.body}
    </Modal>
  );

  // 실제 팝업(있다면) 위에 mock 칩 바를 같이 얹는다 — 팝업을 안 닫고도 다른
  // 칩으로 바로 넘어가 볼 수 있어야 하므로 스크림(z-index:10)보다 위(20)에 둔다.
  const chipBar = (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        bottom: 0,
        zIndex: 20,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'center',
        gap: 6,
        padding: '8px 12px',
        background: '#000',
        borderTop: '2px dashed #ff9800',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <span style={{ fontSize: 11, fontWeight: 700, color: '#ff9800', marginRight: 4 }}>
        MOCK 테스트 · 팝업 띄우기
      </span>
      {/* 8/13: 채팅 팝업 스크롤 고정·새 메시지 알림 핀 테스트용 — 켜면 참가자가
          돌아가며 1·2·3·4를 세는 채팅이 5초마다 하나씩 쌓인다. 팝업 칩과 헷갈리지
          않게 색을 초록 계열로 구분했다. */}
      <button
        type="button"
        onClick={() => setAutoChat((v) => !v)}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 600,
          color: autoChat ? '#000' : '#4caf50',
          background: autoChat ? '#4caf50' : 'transparent',
          border: '1px solid #4caf50',
          borderRadius: 999,
          cursor: 'pointer',
        }}
      >
        {autoChat ? '채팅 자동생성 중지' : '채팅 자동생성 시작 (5초마다 1·2·3·4)'}
      </button>
      <button
        type="button"
        onClick={closePopup}
        style={{
          padding: '4px 10px',
          fontSize: 12,
          fontWeight: 600,
          color: popupKey === null ? '#000' : '#ff9800',
          background: popupKey === null ? '#ff9800' : 'transparent',
          border: '1px solid #ff9800',
          borderRadius: 999,
          cursor: 'pointer',
        }}
      >
        팝업 닫기
      </button>
      {POPUP_CHIPS.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => openPopup(c.key)}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: popupKey === c.key ? '#000' : '#ff9800',
            background: popupKey === c.key ? '#ff9800' : 'transparent',
            border: '1px solid #ff9800',
            borderRadius: 999,
            cursor: 'pointer',
          }}
        >
          {c.label}
        </button>
      ))}
    </div>
  );

  return (
    <MainScreen
      state={baseState}
      onEvent={onEvent}
      blocked={modalInfo !== null}
      modal={
        <>
          {realModal}
          {chipBar}
        </>
      }
    />
  );
}
