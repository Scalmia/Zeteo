import { useState } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';
import { Timer } from '../components/Timer';

/** S5 정체 공개 + S5-a 제시어 추측.
 *  두 페이즈를 한 파일이 담당한다 — 룰북상 "처형자가 라이어일 때만" 추측이 붙는
 *  연속 흐름이라 화면을 쪼개면 전환이 끊겨 보인다. */
export function Reveal({
  state,
  onEvent,
}: {
  state: GameState;
  onEvent: (e: ClientEvent) => void;
}) {
  const [guess, setGuess] = useState('');
  const executed = state.players.find((p) => p.id === state.accused);

  if (state.phase === 'guessWord') {
    // ★3 입력 권한자: 처형된 라이어 본인. A 승인 필요 (작업계획서 3절)
    const canGuess = state.myRole === 'liar' && state.accused === state.myId;

    return (
      <div className="zt-screen zt-center">
        <header className="zt-head">
          <span className="zt-sub">제시어 추측</span>
          <Timer deadlineAt={state.deadlineAt} />
        </header>

        <div className="zt-card">
          <span className="zt-badge">라이어 적발</span>
          <p className="zt-role is-liar">{executed?.label}</p>
          <p className="zt-muted">주제: {state.category}</p>

          {canGuess ? (
            <div className="zt-chat-input">
              <input
                value={guess}
                placeholder="제시어 입력…"
                onChange={(e) => setGuess(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && guess.trim())
                    onEvent({ t: 'guessWord', word: guess.trim() });
                }}
              />
              <button
                disabled={!guess.trim()}
                onClick={() => onEvent({ t: 'guessWord', word: guess.trim() })}
              >
                확정
              </button>
            </div>
          ) : (
            <p className="zt-muted">라이어가 제시어를 추측하는 중입니다…</p>
          )}
        </div>
      </div>
    );
  }

  // phase === 'reveal'
  const wasLiar = state.revealedRole === 'liar';

  return (
    <div className="zt-screen zt-center">
      <header className="zt-head">
        <span className="zt-sub">결과</span>
      </header>

      <div className="zt-card">
        <p className="zt-label">{executed?.label}은(는)</p>
        <p className={wasLiar ? 'zt-role is-liar' : 'zt-role'}>
          {state.revealedRole === 'liar' ? '라이어' : '시민'}
        </p>
        <p className="zt-label">이었습니다</p>

        {state.liarGameResult && (
          <p className="zt-result">
            {state.liarGameResult === 'liarWin' ? '라이어 승리' : '시민 승리'}
          </p>
        )}
        {wasLiar && <p className="zt-muted">제시어 추측 단계로 넘어갑니다…</p>}
      </div>
    </div>
  );
}
