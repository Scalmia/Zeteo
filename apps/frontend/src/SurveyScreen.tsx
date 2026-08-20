import { useEffect, useState } from "react";
import type { ResultPlayer, SurveyScreenState } from "./types";
import Button from "./components/Button";
import { ChatLog } from "./components/Chat";
import { Modal } from "./components/Modal";
import "./styles/tokens.css";
import "./screens/game.css";

/** 기획서 v4.0 리플레이 통합(2026-08-20) — 설문 화면을 플레이 화면(screens/MainScreen.tsx)과
 *  같은 레이아웃(헤더 + 채팅로그|우측 패널 + 하단 현황바)으로 바꿨다. 게임이 끝난 뒤
 *  대화를 다시 훑어보며("리플레이") 결과를 참고해 설문에 답할 수 있게 하는 것이 목적
 *  (기획서 §2 목표3: "설문 답변의 근거가 기억에서 기록으로 바뀐다").
 *
 *  구성 대응:
 *    · 헤더        — MainScreen의 zt-head에서 라운드·묘사진행도·타이머를 뺀 5개
 *                    (로고·ZETEO·"설문 진행 중"·제시어·전체화면버튼)만 남긴 버전.
 *    · 채팅 로그    — MainScreen과 같은 ChatLog. 라이브 게임 중엔 안 보이던 발언자
 *                    이름 줄을 여기서는 showSpeakerLabel로 켜고, 닉네임(nicknames,
 *                    랜딩에서 입력한 값)을 보여준다(8/20 2차 수정: 참가자 라벨
 *                    접두어는 뺐다 — 아바타 아이콘으로 이미 구분 가능해 중복이라는
 *                    지적) — 리플레이는 "누가 말했는지" 복기가 핵심이라 라이브 중
 *                    익명성 유지와는 반대 방향.
 *    · 우측 패널    — ResultScreen 요약 카드 내용(카테고리/제시어 줄만 헤더에 이미
 *                    있어 제외)을 MainScreen의 zt-side-wide 자리에 채운다. 라이브
 *                    투표 UI(VotePanel)가 아니라 이미 끝난 결과라 정적 텍스트다.
 *    · 하단 현황바  — zt-vote-bar 자리를 그대로 쓰되 문구를 "봇 지목 현황"으로
 *                    바꾸고 타이머(설문엔 제한시간이 없다, backend PHASE_DURATIONS에
 *                    survey 없음)를 뺐다.
 *    · 입력창       — 삭제(설문엔 채팅 전송이 필요 없다).
 *    · 설문 자체    — 카드 전체였던 것을 다른 페이즈 팝업(RoleReveal·LifeVote·
 *                    Reveal·BotVote)과 같은 Modal로 옮겼다. 그 화면들에 이미 있던
 *                    "바깥에 전체화면 버튼이 따로 있으니 안쪽 것은 제거" 요청에 따라
 *                    카드 모서리에 얹던 절대위치 FullscreenButton도 뺐다 — 헤더 안
 *                    상대위치 버튼(zt-fullscreen-btn, MainScreen과 동일 로직)으로
 *                    대체됐다. */

const TAG_CLASS: Record<ResultPlayer["tag"], string> = {
  봇: "tag-accent",
  라이어: "tag-outline",
  시민: "tag-neutral"
};

// 참가자 라벨은 서버가 "참가자 A" 형식으로 준다(shared-types InternalPlayer 주석 참고).
// 우측 패널(260px 고정폭)·하단 현황바는 폭이 좁아 "참가자" 접두어를 빼고 글자만
// 남긴다(2026-08-20 요청 — "창크기 고려해 [참가자] 텍스트만 제거"). 채팅 로그 쪽
// 라벨은 폭 제약 대상이 아니라서 그대로 둔다.
const stripParticipantPrefix = (label: string) => label.replace(/^참가자\s*/, "");

interface SurveyScreenProps extends SurveyScreenState {
  onSubmit: (checkedReasonIds: number[], freeText: string) => void;
}

export default function SurveyScreen({
  reasons,
  checkedReasonIds: initialChecked,
  freeText: initialFreeText,
  messages,
  chatPlayers,
  myId,
  category,
  word,
  nicknames,
  winner,
  totalVoters,
  botVoteCorrectCount,
  guessWord,
  resultPlayers,
  myBotVoteTargetId,
  revealedBotId,
  onSubmit
}: SurveyScreenProps) {
  const [checked, setChecked] = useState<number[]>(initialChecked);
  const [freeText, setFreeText] = useState(initialFreeText);
  // 우측 패널(모바일 하단 시트)의 기본 열림 상태 — MainScreen의 규칙(토론·묘사처럼
  // "지금 봐야 할 페이즈"만 자동으로 열고 나머지는 접힌 채 시작, 8/13 12차)을 그대로
  // 따른다. 설문은 그 자동열림 대상에 안 들어가니 접힌 채로 시작한다.
  const [voteOpen, setVoteOpen] = useState(false);

  const toggle = (id: number) =>
    setChecked((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  // 전체화면 버튼 — screens/MainScreen.tsx와 완전히 같은 로직(문서: document.fullscreenEnabled
  // 미지원 브라우저에선 버튼 자체를 안 그린다). 이 화면은 이제 헤더가 생겨 카드 모서리에
  // 얹던 절대위치 FullscreenButton 대신 헤더 안 상대위치 버튼을 쓴다.
  const fullscreenSupported = typeof document !== "undefined" && document.fullscreenEnabled;
  const [isFullscreen, setIsFullscreen] = useState(
    () => typeof document !== "undefined" && !!document.fullscreenElement
  );
  useEffect(() => {
    if (!fullscreenSupported) return;
    const onChange = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [fullscreenSupported]);
  const toggleFullscreen = () => {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else {
      document.documentElement.requestFullscreen().catch(() => {});
    }
  };

  // ResultScreen과 같은 판정 — 서버는 승패(winner)로만 알려주고 guessWord 정답
  // 여부는 화면에서 직접 비교한다.
  const guessedRight = guessWord !== null && word !== null && guessWord.trim() === word.trim();

  const myBotVoteLabel = myBotVoteTargetId
    ? stripParticipantPrefix(
        resultPlayers.find((p) => p.id === myBotVoteTargetId)?.label ?? myBotVoteTargetId
      )
    : null;
  const revealedBotLabel = revealedBotId
    ? stripParticipantPrefix(resultPlayers.find((p) => p.id === revealedBotId)?.label ?? revealedBotId)
    : null;

  // 다른 페이즈 팝업(RoleReveal·LifeVote·Reveal·BotVote)과 같은 Modal 셸을 그대로
  // 쓴다 — 폭(zt-modal, 360px)·텍스트 크기는 전부 아래에서 개별 지정(기존 설문
  // 화면과 동일한 크기 유지 요청)했지 Modal 기본값을 바꾸지 않았다.
  //
  // 8/20 2차 수정: 줄간격(margin/padding/gap)만 전체적으로 좁혔다 — 채팅 로그
  // 영역보다 팝업이 길어지면 Modal 자체가 스크롤(.zt-modal { overflow-y: auto })
  // 되는데, 화면을 조금만 줄여도 그 스크롤이 뜨던 문제. 텍스트 크기(fontSize)는
  // 요청대로 그대로 뒀다 — 줄인 건 여백뿐이다.
  const surveyModal = (
    <Modal title="설문" deadlineAt={null}>
      <h4 style={{ marginBottom: 4 }}>왜 봇이라고 생각했나요?</h4>
      <div
        className="text-muted"
        style={{ fontSize: "var(--text-label)", fontWeight: 600, marginBottom: "var(--space-2)" }}
      >
        적중자 대상 · 해당하는 이유 선택 (복수)
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: "var(--space-2)" }}>
        {reasons.map((reason) => {
          const isChecked = checked.includes(reason.id);
          return (
            <label
              key={reason.id}
              className="radio"
              onClick={() => toggle(reason.id)}
              style={{
                justifyContent: "flex-start",
                padding: "6px var(--space-4)",
                border: `1px solid ${isChecked ? "var(--color-accent)" : "var(--color-line)"}`,
                borderRadius: "var(--radius)",
                cursor: "pointer"
              }}
            >
              <span
                style={{
                  width: 16,
                  height: 16,
                  flex: "none",
                  borderRadius: 3,
                  border: `1.5px solid ${isChecked ? "var(--color-accent)" : "var(--color-line)"}`,
                  background: isChecked ? "var(--color-accent)" : "transparent",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 17,
                  color: "white"
                }}
              >
                {isChecked ? "✓" : ""}
              </span>
              <span style={{ fontSize: "var(--text-body)", fontWeight: 600 }}>{reason.label}</span>
            </label>
          );
        })}
      </div>

      <div className="field" style={{ marginBottom: "var(--space-2)" }}>
        <label style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>기타 (자유 서술)</label>
        {/* 카드 전체가 화면이던 예전엔 flex:1로 남는 세로 공간을 흡수했지만, 이제
            360px짜리 고정폭 팝업이라 그 방식이 안 맞는다 — 요청대로 3줄 높이만
            고정으로 준다. */}
        <textarea
          className="input"
          rows={3}
          style={{ fontSize: "var(--text-body)", resize: "none" }}
          value={freeText}
          onChange={(e) => setFreeText(e.target.value)}
          placeholder="직접 입력해주세요"
        />
      </div>

      <Button block style={{ fontSize: "var(--text-button)" }} onClick={() => onSubmit(checked, freeText)}>
        제출
      </Button>
    </Modal>
  );

  return (
    <div className="zt-screen">
      <header className="zt-head">
        <span className="zt-brand">
          <img className="zt-brand-icon" src="/zeteo-o.png" alt="" />
          <span className="zt-brand-name">ZETEO</span>
        </span>

        <span className="zt-sub">설문 진행 중</span>

        <span className="zt-word">
          <span className="zt-word-cat">{category} /</span> {word ?? "???"}
        </span>

        {fullscreenSupported && (
          <button
            type="button"
            className="zt-fullscreen-btn"
            onClick={toggleFullscreen}
            aria-label={isFullscreen ? "전체화면 종료" : "전체화면"}
            title={isFullscreen ? "전체화면 종료" : "전체화면"}
          >
            {isFullscreen ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3v3a2 2 0 0 1-2 2H3" />
                <path d="M21 8h-3a2 2 0 0 1-2-2V3" />
                <path d="M3 16h3a2 2 0 0 1 2 2v3" />
                <path d="M16 21v-3a2 2 0 0 1 2-2h3" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M8 3H5a2 2 0 0 0-2 2v3" />
                <path d="M21 8V5a2 2 0 0 0-2-2h-3" />
                <path d="M3 16v3a2 2 0 0 0 2 2h3" />
                <path d="M16 21h3a2 2 0 0 0 2-2v-3" />
              </svg>
            )}
          </button>
        )}
      </header>

      <div className="zt-stage">
        <ChatLog
          messages={messages}
          players={chatPlayers}
          myId={myId}
          modal={surveyModal}
          showSpeakerLabel
          nicknames={nicknames}
        />

        <aside
          id="zt-vote-panel"
          className={voteOpen ? "zt-side-wide" : "zt-side-wide is-collapsed"}
        >
          <div className="zt-vote">
            <div
              className="tag tag-accent"
              style={{
                fontSize: "var(--text-emphasis)",
                fontWeight: 700,
                padding: "4px 16px",
                marginBottom: "var(--space-2)",
                // 8/20 2차 수정: .zt-vote(부모)가 flex-column이라 기본 align-items:stretch로
                // 자식 폭이 패널 전체(260px)까지 늘어난다 — 글자 크기에 맞춰 폭을 접는다.
                alignSelf: "flex-start"
              }}
            >
              {winner}
            </div>

            {guessWord !== null && (
              <div style={{ marginBottom: "var(--space-2)" }}>
                <div className="card-title" style={{ fontSize: 20 }}>라이어의 추측</div>
                <div
                  className="text-muted"
                  style={{
                    fontSize: "var(--text-label)",
                    fontWeight: 600,
                    color: guessedRight ? "var(--color-accent)" : undefined
                  }}
                >
                  {guessWord} · {guessedRight ? "정답" : "오답"}
                </div>
              </div>
            )}

            <div style={{ marginBottom: "var(--space-2)" }}>
              <div className="card-title" style={{ fontSize: 20 }}>봇 색출</div>
              <div className="text-muted" style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>
                {totalVoters}명 중 {botVoteCorrectCount}명이 봇 지목 성공
              </div>
            </div>

            <div className="hr" />

            <h4 style={{ marginBottom: "var(--space-2)" }}>정체 공개 · 봇 지목 현황</h4>
            {resultPlayers.map((player, i) => (
              <div
                key={player.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  padding: "6px 0",
                  borderBottom: i < resultPlayers.length - 1 ? "1px solid var(--color-line)" : "none"
                }}
              >
                <span style={{ display: "flex", alignItems: "baseline", gap: "var(--space-2)" }}>
                  <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--text-body)" }}>
                    {stripParticipantPrefix(player.label)}
                  </span>
                  {player.name && (
                    <span className="text-muted" style={{ fontSize: "var(--text-label)", fontWeight: 600 }}>
                      {player.name}
                    </span>
                  )}
                </span>
                {player.votedFor && (
                  // 8/20 2차 수정: "지목" 텍스트 제거 — 패널 폭이 좁아 한 줄에 안 맞음.
                  <span style={{ fontFamily: "var(--font-body)", fontWeight: 600, fontSize: "var(--text-body)", marginLeft: "var(--space-2)" }}>
                    → {stripParticipantPrefix(player.votedFor)}
                  </span>
                )}
                <span className={`tag ${TAG_CLASS[player.tag]}`} style={{ fontSize: "var(--text-label)", fontWeight: 600, marginLeft: "auto" }}>
                  {player.tag}
                </span>
              </div>
            ))}
          </div>
        </aside>
      </div>

      <button
        type="button"
        className="zt-vote-bar"
        aria-expanded={voteOpen}
        aria-controls="zt-vote-panel"
        onClick={() => setVoteOpen((open) => !open)}
      >
        <span className="zt-vote-bar-label">
          봇 지목 현황 · 내 선택 {myBotVoteLabel ?? "없음"} · 봇 정체 {revealedBotLabel ?? "—"}
        </span>
        <span className="zt-vote-bar-chev" aria-hidden="true">
          {voteOpen ? "▼" : "▲"}
        </span>
      </button>
    </div>
  );
}
