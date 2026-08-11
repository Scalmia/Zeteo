import { useState } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Modal } from '../components/Modal';
import { MainScreen } from '../screens/MainScreen';
import { modalFor } from '../screens/modalFor';
import { MOCK_STATES } from './states';

/** mock 전용 임시 칩 — 팝업 5종을 개별 mock 키로 하나씩 확인하는 대신,
 *  실제 GameScreen 위에서 즉시 갈아 끼워 확인한다. 각 칩은 이미 검증된
 *  기존 MOCK_STATES 항목을 그대로 재사용한다(accused·revealedRole 같은
 *  팝업별 필요 필드를 다시 채우는 실수를 없애려고 — 각 mock이 이미 그
 *  조합을 맞춰 갖고 있다). */
const CHIPS: { label: string; key: string }[] = [
  { label: '채팅 (팝업 없음)', key: 'debate-voted' },
  { label: '역할 배정', key: 'roleReveal-citizen' },
  { label: '생사 투표', key: 'lifeVote-voter' },
  { label: '결과', key: 'reveal-liar' },
  { label: '제시어 추측', key: 'guessWord-liar' },
  { label: '봇 지목', key: 'botVote' },
];

/** 실제 GameScreen 레이아웃(채팅+투표+팝업)을 서버 없이 통째로 확인하는
 *  mock 전용 화면. `?mock=` 목록 최상단에 노출된다.
 *
 *  ⚠️ 8/11 수정: 칩 바를 화면 하단 고정(position:fixed)에서 채팅 로그 하단으로
 *  옮겼다 — 뷰포트에 고정돼 있으면 실제 화면 폭이 넓어진 입력창(zt-chat-input,
 *  전체 폭)과 겹쳤다. GameScreen을 통째로 쓰지 않고 MainScreen을 직접 조립하는
 *  이유가 이거다 — modal 자리(zt-chat-log 안, position:relative 기준)에 실제
 *  팝업과 칩 바를 같이 꽂아야 칩 바가 "채팅 로그 영역 안 하단"에만 뜨고
 *  투표 패널·입력창 쪽으로는 안 번진다. modalFor는 GameScreen과 같은 함수를
 *  그대로 가져와 쓴다(어떤 phase에 어떤 팝업인지 판단은 그 한 곳만 기준이어야
 *  다른 자리에서 실수로 어긋나지 않는다). */
export function GameScreenTest() {
  const [state, setState] = useState<GameState>(MOCK_STATES['debate-voted']);

  // 서버가 없으므로 이벤트를 로컬 상태에 즉시 반영해 상호작용만 확인한다
  // (MockHarness의 onEvent와 같은 패턴).
  const onEvent = (e: ClientEvent) => {
    console.log('[mock] ClientEvent', e);
    if (e.t === 'vote') setState((s) => ({ ...s, myVote: e.targetId }));
    if (e.t === 'botVote') setState((s) => ({ ...s, myVote: e.targetId }));
    if (e.t === 'lifeVote') setState((s) => ({ ...s, myLifeVote: e.kill }));
  };

  const modalInfo = modalFor(state, onEvent);
  const realModal = modalInfo && (
    <Modal title={modalInfo.title} deadlineAt={state.deadlineAt}>
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
        MOCK 테스트 · 팝업 전환
      </span>
      {CHIPS.map((c) => (
        <button
          key={c.key}
          type="button"
          onClick={() => setState(MOCK_STATES[c.key])}
          style={{
            padding: '4px 10px',
            fontSize: 12,
            fontWeight: 600,
            color: state.phase === MOCK_STATES[c.key].phase ? '#000' : '#ff9800',
            background: state.phase === MOCK_STATES[c.key].phase ? '#ff9800' : 'transparent',
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
      state={state}
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
