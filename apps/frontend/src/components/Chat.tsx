import { useEffect, useRef, useState } from 'react';
import type { Message, PublicPlayer } from '@zeteo/shared-types';

interface Props {
  messages: Message[];
  players: PublicPlayer[];
  /** 아바타 이니셜·내 메시지 오른쪽 정렬 판별용. 시스템 메시지엔 해당 없다 */
  myId: string;
  /** 잠금 여부는 화면이 판단해서 내려준다. Chat이 스스로 규칙을 알지 않는다. */
  locked: boolean;
  /** 잠겼을 때 입력창 자리에 보여줄 문구 */
  lockedLabel?: string;
  placeholder?: string;
  onSend: (text: string) => void;
}

export function Chat({ messages, players, myId, locked, lockedLabel, placeholder, onSend }: Props) {
  const [text, setText] = useState('');
  const logRef = useRef<HTMLDivElement>(null);

  // 로그 요소만 직접 내린다. scrollIntoView 는 스크롤 가능한 조상을 찾아 거슬러 올라가므로,
  // 로그가 스크롤 컨테이너가 아닌 순간 페이지 전체를 끌어내린다 — 2판 테스트에서
  // 타이머와 투표 패널 윗부분이 화면 밖으로 밀려난 원인이었다. scrollTop 은 이 요소만 움직인다.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages.length]);

  const nameOf = (speakerId: string) =>
    speakerId === 'system'
      ? '시스템'
      : (players.find((p) => p.id === speakerId)?.label ?? speakerId);

  // 아바타 이니셜 — Avatar.tsx와 같은 규칙(마지막 단어의 첫 글자). "참가자 4" → "4"
  const initialOf = (speakerId: string) => {
    const label = nameOf(speakerId);
    const tokens = label.trim().split(/\s+/);
    return tokens[tokens.length - 1]?.charAt(0) ?? '?';
  };

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="zt-chat">
      <div className="zt-chat-log" ref={logRef}>
        {messages.map((m) => {
          if (m.speakerId === 'system') {
            return (
              <div key={m.id} className="zt-msg is-system">
                <span className="zt-msg-text">{m.text}</span>
              </div>
            );
          }
          const isMine = m.speakerId === myId;
          return (
            <div key={m.id} className={isMine ? 'zt-msg is-mine' : 'zt-msg'}>
              <span className="zt-msg-avatar">{initialOf(m.speakerId)}</span>
              <span className="zt-msg-text">{m.text}</span>
            </div>
          );
        })}
      </div>

      {locked ? (
        <div className="zt-chat-locked">🔒 {lockedLabel}</div>
      ) : (
        <div className="zt-chat-input">
          <input
            value={text}
            placeholder={placeholder ?? '메시지 입력…'}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') submit();
            }}
          />
          <button onClick={submit}>전송</button>
        </div>
      )}
    </div>
  );
}
