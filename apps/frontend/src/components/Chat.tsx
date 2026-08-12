import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Message, PublicPlayer } from '@zeteo/shared-types';
import Avatar from './Avatar';
import Button from './Button';

/** 8/11: 로그와 입력창을 분리했다. 시안 1은 하단 요약탭(zt-vote-bar)·입력창(zt-chat-input)이
 *  채팅 기둥 폭이 아니라 화면 전체 폭으로 늘어난다 — 우측 투표 패널과는 그 두 줄에서만
 *  나란한 게 아니라 그 아래에서 가로로 통합된다. 로그+입력창이 한 컴포넌트(.zt-chat) 안에
 *  같이 들어있으면 MainScreen이 이 둘을 서로 다른 폭의 레이아웃에 따로 배치할 수 없어서,
 *  ChatLog(로그만)와 ChatInputBar(입력창만)로 나눠 MainScreen이 각자 원하는 자리에 꽂는다. */

interface LogProps {
  messages: Message[];
  players: PublicPlayer[];
  /** 아바타에 내 발언인지 표시하는 용도로만 쓴다(VotePanel의 mine 강조 테두리와 같은 규칙) */
  myId: string;
  /** 페이즈 팝업(GameScreen의 <Modal>) — 8/11부터 전체 화면이 아니라 채팅 로그
   *  영역 위에만 뜨도록 여기로 내려받아 zt-chat-log 안에 얹는다(설계 결정: 투표
   *  패널·입력창은 팝업이 떠 있어도 계속 보여야 한다). null이면 팝업 없음. */
  modal?: ReactNode;
}

export function ChatLog({ messages, players, myId, modal }: LogProps) {
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

  return (
    <div className="zt-chat-log" ref={logRef}>
      {messages.map((m) => {
        // 8/12: 파트 D 코멘트로 다시 요청받은 "내 메시지 우측 정렬" — is-system과는
        // 겹칠 일이 없다(system은 myId가 될 수 없음). 시스템 메시지 판정이 우선이라
        // 순서상 먼저 검사한다.
        const isMine = m.speakerId !== 'system' && m.speakerId === myId;
        const rowClass = m.speakerId === 'system' ? 'zt-msg is-system' : isMine ? 'zt-msg is-mine' : 'zt-msg';
        return (
          <div key={m.id} className={rowClass}>
            {m.speakerId !== 'system' && (
              <Avatar label={nameOf(m.speakerId)} variant={isMine ? 'mine' : 'default'} />
            )}
            <span className="zt-msg-name">{nameOf(m.speakerId)}</span>
            <span className="zt-msg-text">{m.text}</span>
          </div>
        );
      })}

      {modal}
    </div>
  );
}

interface InputProps {
  /** 잠금 여부는 화면이 판단해서 내려준다. 이 컴포넌트가 스스로 규칙을 알지 않는다. */
  locked: boolean;
  /** 잠겼을 때 입력창 자리에 보여줄 문구 */
  lockedLabel?: string;
  placeholder?: string;
  onSend: (text: string) => void;
}

export function ChatInputBar({ locked, lockedLabel, placeholder, onSend }: InputProps) {
  const [text, setText] = useState('');

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onSend(t);
    setText('');
  };

  if (locked) {
    return <div className="zt-chat-locked">🔒 {lockedLabel}</div>;
  }

  return (
    <div className="zt-chat-input">
      {/* 8/12: 파트 D의 화면 간 디자인 통일 지침 — 입력창은 tokens.css의 공용 .input,
          전송 버튼은 공용 Button(.btn .btn-primary) + --text-button(21px)을 그대로
          따른다. 이전엔 둘 다 브라우저 기본 스타일 그대로였다. */}
      <input
        className="input"
        value={text}
        placeholder={placeholder ?? '메시지 입력…'}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') submit();
        }}
      />
      <Button onClick={submit} style={{ fontSize: 'var(--text-button)' }}>
        전송
      </Button>
    </div>
  );
}
