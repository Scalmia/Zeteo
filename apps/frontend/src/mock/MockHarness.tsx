import { useState } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { GameScreen } from '../screens/GameScreen';
import { MOCK_KEYS, MOCK_STATES } from './states';

/**
 * 서버 없이 화면을 확인하는 개발용 하네스.
 *   /?mock=debate-voted
 * 키 없이 열면 전체 목록이 나온다.
 *
 * 파트 C 완료 판정("서버 없이 mock 데이터만으로 6개 화면이 전부 렌더되고,
 * URL로 페이즈를 바꿔 전환을 확인할 수 있다")이 이 파일로 충족된다.
 */
export function MockHarness() {
  const key = new URLSearchParams(location.search).get('mock');
  const initial = key ? MOCK_STATES[key] : undefined;
  const [state, setState] = useState<GameState | undefined>(initial);

  if (!state) {
    return (
      <div className="zt-screen zt-center">
        <div className="zt-card">
          <p className="zt-label">mock 상태 목록</p>
          <ul className="zt-mock-list">
            {MOCK_KEYS.map((k) => (
              <li key={k}>
                <a href={`?mock=${k}`}>{k}</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
    );
  }

  // 서버가 없으므로 이벤트를 로컬 상태에 즉시 반영해 상호작용만 확인한다.
  // 실제 통합에서는 A의 net/socket.ts 가 이 자리를 대신한다.
  const onEvent = (e: ClientEvent) => {
    console.log('[mock] ClientEvent', e);
    if (e.t === 'vote') setState({ ...state, myVote: e.targetId });
    if (e.t === 'lifeVote') setState({ ...state, myLifeVote: e.kill });
  };

  return <GameScreen state={state} onEvent={onEvent} />;
}
