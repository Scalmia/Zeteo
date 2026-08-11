import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Message, PublicPlayer } from '@zeteo/shared-types';
import Avatar from './Avatar';

interface Props {
  messages: Message[];
  players: PublicPlayer[];
  /** 아바타에 내 발언인지 표시하는 용도로만 쓴다(VotePanel의 mine 강조 테두리와 같은 규칙) */
  myId: string;
  /** 잠금 여부는 화면이 판단해서 내려준다. Chat이 스스로 규칙을 알지 않는다. */
  locked: boolean;
  /** 잠겼을 때 입력창 자리에 보여줄 문구 */
  lockedLabel?: string;
  placeholder?: string;
  onSend: (text: string) => void;
  /** 페이즈 팝업(GameScreen의 <Modal>) — 8/11부터 전체 화면이 아니라 채팅 로그
   *  영역 위에만 뜨도록 여기로 내려받아 zt-chat-log 안에 얹는다(설계 결정: 투표
   *  패널·입력창은 팝업이 떠 있어도 계속 보여야 한다). null이면 팝업 없음. */
  modal?: ReactNode;
}

export function Chat({ messages, players, myId, locked, lockedLabel, placeholder, onSend, modal }: Props) {
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

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  return (
    <div className="zt-chat">
      <div className="zt-chat-log" ref={logRef}>
        {messages.map((m) => (
          <div key={m.id} className={m.speakerId === 'system' ? 'zt-msg is-system' : 'zt-msg'}>
            {m.speakerId !== 'system' && (
              <Avatar label={nameOf(m.speakerId)} variant={m.speakerId === myId ? 'mine' : 'default'} />
            )}
            <span className="zt-msg-name">{nameOf(m.speakerId)}</span>
            <span className="zt-msg-text">{m.text}</span>
          </div>
        ))}

        {modal}
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
