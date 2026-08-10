import { useState } from 'react';
import type { ClientEvent, GameState } from '@zeteo/shared-types';

/** S5 정체 공개 + S5-a 제시어 추측.
 *  두 페이즈를 한 파일이 담당한다 — 룰북상 "처형자가 라이어일 때만" 추측이 붙는
 *  연속 흐름이라 화면을 쪼개면 전환이 끊겨 보인다.
 *
 *  GameScreen 이 Modal 로 감싸 메인화면 위에 띄운다 — 제목과 타이머는 Modal 이 그리고,
 *  그 껍데기는 reveal → guessWord 사이에 마운트된 채로 유지된다. */
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
    // ★3 입력 권한자: 처형된 라이어 본인. A 확인 대기 (인수인계 6절)
    const canGuess = state.myRole === 'liar' && state.accused === state.myId;

    return (
      <>
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
                if (e.key === 'Enter' && guess.trim()) onEvent({ t: 'guessWord', word: guess.trim() });
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
      </>
    );
  }

  // phase === 'reveal'
  const wasLiar = state.revealedRole === 'liar';

  return (
    <>
      <p className="zt-label">{executed?.label}은(는)</p>
      <p className={wasLiar ? 'zt-role is-liar' : 'zt-role'}>
        {state.revealedRole === 'liar' ? '라이어' : '시민'}
      </p>
      <p className="zt-label">이었습니다</p>

      {/* liarGameResult 는 reveal 에서 항상 null 이라 이 블록은 뜨지 않는다.
          지우지 않는 이유: 라이어를 잡은 경우만 결과를 숨기면 "결과가 안 뜬다"는
          사실 자체가 스포일러가 되므로, 두 경우를 화면에서 구분할 수 없게 서버가
          result 직전까지 미룬다 (기획서 v2.0 §4) */}
      {state.liarGameResult && (
        <p className="zt-result">
          {state.liarGameResult === 'liarWin' ? '라이어 승리' : '시민 승리'}
        </p>
      )}
      {wasLiar && <p className="zt-muted">제시어 추측 단계로 넘어갑니다…</p>}
    </>
  );
}
