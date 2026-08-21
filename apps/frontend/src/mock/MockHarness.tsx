import { useState } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import type { ResultPlayer } from '../types';
import LandingScreen from '../LandingScreen';
import LobbyScreen from '../LobbyScreen';
import ResultScreen from '../ResultScreen';
import SurveyScreen from '../SurveyScreen';
import { GameScreen } from '../screens/GameScreen';
import { GameScreenTest } from './GameScreenTest';
import { GAME_TEST_KEY, LANDING_KEY, MOCK_KEYS, MOCK_STATES } from './states';

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

  const known =
    key === GAME_TEST_KEY || key === LANDING_KEY || (key !== null && key in MOCK_STATES);
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

  // 실제 GameScreen을 mock 칩으로 훑어보는 테스트 화면 — 자체 상태를 스스로
  // 들고 있어서 이 컴포넌트의 state/setState를 쓰지 않는다
  if (key === GAME_TEST_KEY) {
    return <GameScreenTest />;
  }

  // 랜딩은 아직 state 가 없는 화면이라 GameState 로 표현하지 않는다
  if (key === LANDING_KEY) {
    return <LandingScreen onJoin={(name, roomId) => console.log('[mock] join', { name, roomId })} />;
  }
  if (!state) return null;

  return renderMock(state, onEvent);
}

// result·survey가 공통으로 쓰는 계산 — App.tsx(원본)의 winnerLabel/buildResultPlayers를
// 그대로 옮겼다(위 파일 헤더 주석 참고 — D가 바꾸면 여기도 타입 에러로 걸린다).
function winnerLabel(state: GameState): string {
  return state.liarGameResult === 'liarWin' ? '라이어 승리' : state.liarGameResult === 'citizenWin' ? '시민 승리' : '';
}

function buildResultPlayers(state: GameState) {
  const labelOf = (id: string) => state.players.find((p) => p.id === id)?.label ?? id;
  return state.players.map((p) => {
    // 봇과 라이어가 같은 사람일 수 있다 — App.tsx(원본)와 동일 로직(2026-08-21 수정,
    // 위 파일 헤더 주석 참고).
    const tags: ResultPlayer['tags'] = [];
    if (p.id === state.revealedBotId) tags.push('봇');
    if (p.id === state.revealedLiarId) tags.push('라이어');
    if (tags.length === 0) tags.push('시민');
    return {
      id: p.id,
      label: p.label,
      name: state.revealedNames?.[p.id] ?? null,
      tags,
      votedFor: state.botVoteResults?.[p.id] ? labelOf(state.botVoteResults[p.id]!) : null,
    };
  });
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
      return (
        <ResultScreen
          winner={winnerLabel(state)}
          totalVoters={state.botVoteCounts.total}
          botVoteCorrectCount={state.botVoteCorrectCount}
          category={state.category}
          word={state.word}
          guessWord={state.guessWord}
          players={buildResultPlayers(state)}
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
          messages={state.messages}
          chatPlayers={state.players}
          myId={state.myId}
          category={state.category}
          word={state.word}
          nicknames={state.revealedNames}
          winner={winnerLabel(state)}
          totalVoters={state.botVoteCounts.total}
          botVoteCorrectCount={state.botVoteCorrectCount}
          guessWord={state.guessWord}
          resultPlayers={buildResultPlayers(state)}
          myBotVoteTargetId={state.botVoteResults?.[state.myId] ?? null}
          revealedBotId={state.revealedBotId}
          onSubmit={(reasonIds, freeText) => onEvent({ t: 'survey', reasonIds, freeText })}
        />
      );

    // 나머지는 전부 파트 C 게임 페이즈
    default:
      return <GameScreen state={state} onEvent={onEvent} />;
  }
}
