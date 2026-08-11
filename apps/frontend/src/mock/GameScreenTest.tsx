import { useState } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { GameScreen } from '../screens/GameScreen';
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
 *  mock 전용 화면. `?mock=` 목록 최상단에 노출된다. 화면 아래에 뜨는
 *  칩 바는 이 화면에서만 존재하는 테스트 도구이고 실제 게임 화면의 일부가
 *  아니다 — GameScreen을 마운트하는 App.tsx(프로덕션)는 이 파일을 참조하지
 *  않는다. */
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

  return (
    <>
      <GameScreen state={state} onEvent={onEvent} />
      <div
        style={{
          position: 'fixed',
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
    </>
  );
}
