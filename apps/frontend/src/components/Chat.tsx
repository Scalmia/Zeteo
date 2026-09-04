import { memo, useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Message, PublicPlayer } from '@zeteo/shared-types';
import Avatar from './Avatar';
import Button from './Button';

/** 8/11: 로그와 입력창을 분리했다. 시안 1은 하단 요약탭(zt-vote-bar)·입력창(zt-chat-input)이
 *  채팅 기둥 폭이 아니라 화면 전체 폭으로 늘어난다 — 우측 투표 패널과는 그 두 줄에서만
 *  나란한 게 아니라 그 아래에서 가로로 통합된다. 로그+입력창이 한 컴포넌트(.zt-chat) 안에
 *  같이 들어있으면 MainScreen이 이 둘을 서로 다른 폭의 레이아웃에 따로 배치할 수 없어서,
 *  ChatLog(로그만)와 ChatInputBar(입력창만)로 나눠 MainScreen이 각자 원하는 자리에 꽂는다. */

// ── 1. 채팅 로그 ─────────────────────────────────────────────────────

interface LogProps {
  messages: Message[];
  players: PublicPlayer[];
  /** 아바타에 내 발언인지 표시하는 용도로만 쓴다(VotePanel의 mine 강조 테두리와 같은 규칙) */
  myId: string;
  /** 페이즈 팝업(GameScreen의 <Modal>) — 8/11부터 전체 화면이 아니라 채팅 로그
   *  영역 위에만 뜨도록 여기로 내려받아 zt-chat-log 안에 얹는다(설계 결정: 투표
   *  패널·입력창은 팝업이 떠 있어도 계속 보여야 한다). null이면 팝업 없음. */
  modal?: ReactNode;
  /** 8/20: 설문(리플레이) 화면 전용 opt-in — 켜면 메시지마다 발언자 이름 줄을
   *  보여준다. 8/13 17차 결정(라이브 게임 중엔 발신자 이름 텍스트를 뺀다)은 기본값
   *  false로 그대로 유지되므로 MainScreen 등 기존 호출부는 영향이 없다. */
  showSpeakerLabel?: boolean;
  /** playerId → 랜딩에서 입력한 닉네임. showSpeakerLabel이 true일 때만 쓰인다.
   *  8/20 2차 수정: 닉네임이 있으면 닉네임만 보여준다(참가자 라벨 접두어는 뺌 —
   *  아바타 아이콘으로 이미 구분 가능해 중복이라는 지적). 닉네임이 없을 때만 라벨로
   *  대체한다. */
  nicknames?: Record<string, string> | null;
  /** 설문 "가장 봇 같았던 발언 고르기"(zeteo-partd) 전용 opt-in — 켜면 메시지(시스템
   *  메시지 제외)를 클릭해 하나를 고를 수 있다. 별도 목록을 새로 만들지 않고 이미 있는
   *  리플레이 로그를 선택 대상으로 그대로 쓴다는 설계라, MainScreen 등 기존 호출부는
   *  prop을 안 주면(기본 false) 지금처럼 클릭 불가능한 순수 로그로 남는다. */
  selectable?: boolean;
  selectedMessageId?: string | null;
  onSelectMessage?: (id: string) => void;
}

/** 메시지 한 줄. React.memo로 감싸서 — 투표·봇 발화·페이즈 전환 등 채팅과 무관한
 *  브로드캐스트로 ChatLog가 리렌더될 때마다 안 바뀐 옛날 메시지까지 Avatar까지
 *  포함해 매번 다시 그리던 것을 막는다(메시지가 쌓일수록 이벤트당 비용이 N에
 *  비례해 커지던 원인 — 모바일 CPU에서 "채팅 쌓일수록 렉"으로 체감됨).
 *  ⚠️ message 객체를 통째로 넘기지 않고 text/speakerId를 개별 prop으로 푼다 —
 *     state는 서버 브로드캐스트마다 소켓을 통해 JSON으로 새로 파싱돼 들어오므로,
 *     내용이 같은 메시지라도 객체 참조는 매번 새로 생긴다. 객체를 그대로 넘기면
 *     memo의 기본 얕은 비교가 매번 "참조가 다르다"고 판단해 최적화가 무효화된다.
 *     원시값(string/boolean)으로 넘겨야 값 비교가 성립해 실제로 리렌더가 스킵된다. */
const ChatMessageRow = memo(function ChatMessageRow({
  id,
  text,
  speakerId,
  isMine,
  name,
  nickname,
  showSpeakerLabel,
  selectable,
  isSelected,
  onSelect,
}: {
  id: string;
  text: string;
  speakerId: string;
  isMine: boolean;
  name: string;
  nickname?: string;
  showSpeakerLabel?: boolean;
  selectable?: boolean;
  isSelected?: boolean;
  // 부모(ChatLog)가 넘기는 콜백은 메시지마다 새로 안 만들고 하나를 그대로 공유한다 —
  // 이 컴포넌트가 참조 동일성으로 리렌더를 스킵하는 memo라(위 주석 참고), row별로 감싼
  // 콜백을 새로 만들면 매 렌더 참조가 달라져 그 최적화가 무효화된다.
  onSelect?: (id: string) => void;
}) {
  const canSelect = !!selectable && speakerId !== 'system';
  const rowClass = [
    'zt-msg',
    speakerId === 'system' ? 'is-system' : isMine ? 'is-mine' : '',
    canSelect ? 'is-selectable' : '',
    canSelect && isSelected ? 'is-selected' : '',
  ]
    .filter(Boolean)
    .join(' ');
  return (
    <div className={rowClass} onClick={canSelect ? () => onSelect?.(id) : undefined}>
      {speakerId !== 'system' && <Avatar label={name} variant={isMine ? 'mine' : 'default'} />}
      {/* 8/20: span→div. showSpeakerLabel일 때 이 버블 안에 이름 줄(zt-msg-name, block)이
       *  하나 더 들어가는데, 인라인 span 안에 block 자식을 두면 렌더링이 불안정하다 —
       *  클래스 기반 CSS(.zt-msg-text)는 태그가 바뀌어도 그대로 적용되고, .zt-msg가
       *  display:flex라 flex 자식은 원래 태그가 span이든 div든 동일하게 배치되므로
       *  기존 레이아웃(showSpeakerLabel=false)엔 영향이 없다. */}
      <div className="zt-msg-text">
        {/* 8/20 2차 수정: 라벨(참가자 X) 접두어는 뺐다 — 아바타 아이콘으로 이미
         *  구분되니 중복이라는 지적. 닉네임이 없으면(랜딩 닉네임 미공개 등) 라벨로
         *  대체 표시한다. */}
        {showSpeakerLabel && speakerId !== 'system' && (
          <span className="zt-msg-name">{nickname ?? name}</span>
        )}
        {text}
      </div>
    </div>
  );
});

export function ChatLog({
  messages,
  players,
  myId,
  modal,
  showSpeakerLabel = false,
  nicknames = null,
  selectable = false,
  selectedMessageId = null,
  onSelectMessage,
}: LogProps) {
  const logRef = useRef<HTMLDivElement>(null);
  // 사용자가 "바닥 근처"에 있었는지를 스크롤 이벤트로 실시간 추적한다. 메시지가
  // 늘어난 뒤(effect 시점)에 계산하면 DOM엔 이미 새 글이 들어가 있어 항상 바닥으로
  // 나온다 — 그래서 스크롤이 실제로 일어날 때마다(사용자 스크롤이든, 우리가 직접
  // scrollTop을 바꾼 것이든 상관없이) 갱신해 둔다(8/13).
  const nearBottomRef = useRef(true);
  const prevLenRef = useRef(messages.length);
  const [newCount, setNewCount] = useState(0);

  const handleScroll = () => {
    const el = logRef.current;
    if (!el) return;
    const distanceFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight;
    const atBottom = distanceFromBottom < 40; // 여유 40px — 정확히 바닥이 아니어도 "거의 다 봤다"로 취급
    nearBottomRef.current = atBottom;
    if (atBottom) setNewCount(0);
  };

  // 8/13: 예전엔 메시지가 늘 때마다 무조건 바닥으로 스크롤했다 — 위쪽 글을 읽던
  // 중에 새 채팅이 오면 강제로 아래로 끌려가 불편하다는 지적. 이제 "바닥 근처에
  // 있었을 때만" 자동으로 따라가고, 위로 스크롤해 읽는 중이었다면 스크롤은 그대로
  // 두고 대신 하단에 작은 "새 메시지" 알림만 띄운다(zt-chat-newmsg, 클릭하면 바닥으로).
  useEffect(() => {
    const el = logRef.current;
    if (!el) return;
    const delta = messages.length - prevLenRef.current;
    prevLenRef.current = messages.length;
    if (delta <= 0) return;
    if (nearBottomRef.current) {
      el.scrollTop = el.scrollHeight;
    } else {
      setNewCount((n) => n + delta);
    }
  }, [messages.length]);

  const jumpToBottom = () => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
    nearBottomRef.current = true;
    setNewCount(0);
  };

  const nameOf = (speakerId: string) =>
    speakerId === 'system'
      ? '시스템'
      : (players.find((p) => p.id === speakerId)?.label ?? speakerId);

  return (
    // 8/13: 팝업(modal)이 로그 스크롤을 따라 같이 밀려 올라가 안 보이던 버그 —
    // 예전엔 modal이 스크롤되는 .zt-chat-log 안쪽에 같이 들어 있어서, absolute
    // 위치 기준(.zt-chat-log 자신)이 스크롤 콘텐츠와 함께 움직였다. 스크롤 안 되는
    // 바깥 래퍼(zt-chat-log-wrap)를 하나 더 두고, 그 위에 스크롤되는 로그와 modal을
    // 각자 절대 위치의 형제로 얹는다 — modal은 이제 로그가 얼마나 스크롤됐든
    // 항상 같은 자리(래퍼 기준 inset:0)에 고정된다.
    <div className="zt-chat-log-wrap">
      <div className="zt-chat-log" ref={logRef} onScroll={handleScroll}>
        {messages.map((m) => {
          // 8/12: 파트 D 코멘트로 다시 요청받은 "내 메시지 우측 정렬" — is-system과는
          // 겹칠 일이 없다(system은 myId가 될 수 없음). 시스템 메시지 판정이 우선이라
          // 순서상 먼저 검사한다.
          const isMine = m.speakerId !== 'system' && m.speakerId === myId;
          return (
            <ChatMessageRow
              key={m.id}
              id={m.id}
              text={m.text}
              speakerId={m.speakerId}
              isMine={isMine}
              name={nameOf(m.speakerId)}
              nickname={nicknames?.[m.speakerId]}
              showSpeakerLabel={showSpeakerLabel}
              selectable={selectable}
              isSelected={selectable && m.id === selectedMessageId}
              onSelect={onSelectMessage}
            />
          );
        })}
      </div>

      {newCount > 0 && (
        <button type="button" className="zt-chat-newmsg" onClick={jumpToBottom}>
          새 메시지 {newCount}개 ↓
        </button>
      )}

      {modal}
    </div>
  );
}

// ── 2. 채팅 입력창 ────────────────────────────────────────────────────

interface InputProps {
  /** 잠금 여부는 화면이 판단해서 내려준다. 이 컴포넌트가 스스로 규칙을 알지 않는다. */
  locked: boolean;
  /** 잠겼을 때 입력창 자리에 보여줄 문구 */
  lockedLabel?: string;
  placeholder?: string;
  onSend: (text: string) => void;
  /** 8/14: 모바일에서 입력 포커스 중엔 투표창(하단 시트)을 닫으라는 요청 — 그 판단은
   *  MainScreen이 하고, 이 컴포넌트는 포커스/블러 시점만 그대로 전달한다(locked과 같은 설계). */
  onFocus?: () => void;
  onBlur?: () => void;
}

export function ChatInputBar({ locked, lockedLabel, placeholder, onSend, onFocus, onBlur }: InputProps) {
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
        onFocus={onFocus}
        onBlur={onBlur}
      />
      <Button onClick={submit} style={{ fontSize: 'var(--text-button)' }}>
        전송
      </Button>
    </div>
  );
}
