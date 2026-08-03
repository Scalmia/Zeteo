import { useEffect, useRef, useState } from 'react';
import type { Message, PublicPlayer } from '@zeteo/shared-types';

interface Props {
  messages: Message[];
  players: PublicPlayer[];
  /** 잠금 여부는 화면이 판단해서 내려준다. Chat이 스스로 규칙을 알지 않는다. */
  locked: boolean;
  /** 잠겼을 때 입력창 자리에 보여줄 문구 */
  lockedLabel?: string;
  placeholder?: string;
  onSend: (text: string) => void;
}

export function Chat({ messages, players, locked, lockedLabel, placeholder, onSend }: Props) {
  const [text, setText] = useState('');
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const nameOf = (speakerId: string) =>
    speakerId === 'system'
      ? '시스템'
      : (players.find((p) => p.id === speakerId)?.name ?? speakerId);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="zt-chat">
      <div className="zt-chat-log">
        {messages.map((m) => (
          <div key={m.id} className={m.speakerId === 'system' ? 'zt-msg is-system' : 'zt-msg'}>
            <span className="zt-msg-name">{nameOf(m.speakerId)}</span>
            <span className="zt-msg-text">{m.text}</span>
          </div>
        ))}
        <div ref={endRef} />
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
