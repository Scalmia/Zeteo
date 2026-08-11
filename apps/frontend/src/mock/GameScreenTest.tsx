import { useState } from 'react';
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
  const onEvent = (e: ClientEvent) => {
    console.log('[mock] ClientEvent', e);
    if (e.t === 'vote') setBaseState((s) => ({ ...s, myVote: e.targetId }));
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
