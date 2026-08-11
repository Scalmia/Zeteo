import { useState } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import LandingScreen from '../LandingScreen';
import LobbyScreen from '../LobbyScreen';
import ResultScreen from '../ResultScreen';
import SurveyScreen from '../SurveyScreen';
import { GameScreen } from '../screens/GameScreen';
import { LANDING_KEY, MOCK_KEYS, MOCK_STATES } from './states';

/**
 * 서버 없이 화면을 확인하는 개발용 하네스.
 *   /?mock=debate-voted
 * 키 없이 열면 전체 목록이 나온다.
 *
 * 파트 C 화면뿐 아니라 파트 D 화면(랜딩·대기실·결과·설문)까지 같은 목록에서
 * 열 수 있다. 봇지목(botVote)은 8/11부로 파트 C 이관 — default 분기의 GameScreen이
 * 그린다. 아래 분기는 App.tsx 의 renderScreen 을 그대로 따라 한 것이다 —
 * ⚠️ App.tsx(파트 D 소유)가 원본이고 여기가 사본이다. D가 화면 props 를 바꾸면
 * 이 파일이 타입 에러로 먼저 깨지므로, 그때 App.tsx 를 보고 맞추면 된다.
 */
export function MockHarness() {
  const key = new URLSearchParams(location.search).get('mock');
  const [state, setState] = useState<GameState | undefined>(() =>
    key ? MOCK_STATES[key] : undefined,
  );

  const known = key === LANDING_KEY || (key !== null && key in MOCK_STATES);
  if (!known) {
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
    if (!state) return;
    if (e.t === 'vote') setState({ ...state, myVote: e.targetId });
    if (e.t === 'botVote') setState({ ...state, myVote: e.targetId });
    if (e.t === 'lifeVote') setState({ ...state, myLifeVote: e.kill });
  };

  // 랜딩은 아직 state 가 없는 화면이라 GameState 로 표현하지 않는다
  if (key === LANDING_KEY) {
    return <LandingScreen onJoin={(name, roomId) => console.log('[mock] join', { name, roomId })} />;
  }
  if (!state) return null;

  return renderMock(state, onEvent);
}

function renderMock(state: GameState, onEvent: (e: ClientEvent) => void) {
  switch (state.phase) {
    case 'lobby': {
      const me = state.players.find((p) => p.id === state.myId);
      return (
        <LobbyScreen
          roomId={state.roomId}
          players={state.players}
          myId={state.myId}
          myReady={me?.isReady ?? false}
          onToggleReady={() => onEvent({ t: 'ready' })}
        />
      );
    }

    case 'result': {
      const winner =
        state.liarGameResult === 'liarWin'
          ? '라이어 승리'
          : state.liarGameResult === 'citizenWin'
            ? '시민 승리'
            : '';
      const labelOf = (id: string) => state.players.find((p) => p.id === id)?.label ?? id;
      const resultPlayers = state.players.map((p) => ({
        id: p.id,
        label: p.label,
        name: state.revealedNames?.[p.id] ?? null,
        tag:
          p.id === state.revealedBotId
            ? ('봇' as const)
            : p.id === state.revealedLiarId
              ? ('라이어' as const)
              : ('시민' as const),
        votedFor: state.botVoteResults?.[p.id] ? labelOf(state.botVoteResults[p.id]!) : null,
      }));

      return (
        <ResultScreen
          winner={winner}
          totalVoters={state.botVoteCounts.total}
          botVoteCorrectCount={state.botVoteCorrectCount}
          category={state.category}
          word={state.word}
          players={resultPlayers}
          onNext={() => onEvent({ t: 'ready' })}
        />
      );
    }

    case 'survey':
      return (
        <SurveyScreen
          reasons={state.reasons}
          checkedReasonIds={[]}
          freeText=""
          onSubmit={(reasonIds, freeText) => onEvent({ t: 'survey', reasonIds, freeText })}
        />
      );

    // 나머지는 전부 파트 C 게임 페이즈
    default:
      return <GameScreen state={state} onEvent={onEvent} />;
  }
}
