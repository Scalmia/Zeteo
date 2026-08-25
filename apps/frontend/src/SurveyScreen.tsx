import { useEffect, useState } from "react";
import type { ResultPlayer, SurveyScreenState } from "./types";
import Avatar from "./components/Avatar";
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

const TAG_CLASS: Record<ResultPlayer["tags"][number], string> = {
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

  // 이 사람이 봇을 맞혔는지. 쓰이는 곳은 행 글자색 하나뿐이다 — 맞으면 초록
  // (--color-ok), 틀리면 빨강(--color-danger), 투표를 안 했으면 색을 안 준다.
  // 지목 대상(→ E)은 맞고 틀림과 무관하게 투표한 모든 행에 적는다: 행마다 그 칸이
  // 비었다 차 있었다 하는 것보다 늘 같은 자리에 있는 편이 훑기 쉬웠다.
  //
  // votedFor는 id가 아니라 라벨 문자열이다(App.tsx buildResultPlayers의 labelOf).
  // revealedBotLabel은 이미 접두어가 떼어져 있어 이쪽도 떼고 맞춘다 — 한쪽만
  // "참가자 E" 형태로 와도 어긋나지 않게.
  const guessedBot = (p: ResultPlayer) =>
    p.votedFor !== null && revealedBotLabel !== null && stripParticipantPrefix(p.votedFor) === revealedBotLabel;

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
          {/* 8/25: 담는 내용은 그대로 두고 표현만 바꿨다.
              이 패널은 게임 중 VotePanel이 들어가는 바로 그 자리인데 어휘가 전혀 달라
              화면에서 혼자 떠 보였다 — 참가자를 왼쪽 채팅 로그·투표 패널은 <Avatar>
              원형 배지로 그리는데 여기만 맨 글자였고, 행도 .zt-vote-row 박스가 아니라
              밑줄만 그은 인라인 div였다(화면의 다른 모든 요소는 테두리 박스다).
              VotePanel·BotVote가 쓰는 클래스를 그대로 가져다 쓴다 — 새 CSS는 없다.

              zt-botvote를 같이 붙인다: game.css의 768px 미디어쿼리가 .zt-vote-list/
              .zt-vote-row를 폰에서 원형 아이콘 나열로 바꾸는데, 그건 눌러서 고르는
              투표 후보일 때 얘기다. 여기는 이미 끝난 결과라 폰에서도 세로 목록이어야
              한다 — BotVote.tsx가 똑같은 이유로 쓰는 마커 클래스다(자체 스타일 없이
              그 미디어쿼리에서 빠지기만 한다). */}
          <div className="zt-vote zt-botvote">
            {/* 승패 — Reveal.tsx가 같은 문자열("시민 승리"/"라이어 승리")에 쓰는 클래스.
                기존의 28px tag-accent 칩은 11px 칩용 glow를 그대로 키운 것이라 모달의
                빨간 "제출" 버튼과 구분이 안 됐다. */}
            {/* 크기만 --text-emphasis(28px)로 올린다 — tokens.css가 이 토큰의 용도를
                "승패 배지 등 강조 배지 — 시민 승리"라고 못박아 뒀고, 걷어낸 칩도 원래
                이 값이었다(달라진 건 채움·glow 같은 버튼 크롬을 뗀 것뿐).
                .zt-result 자체(game.css, 파트 C 소유)는 안 건드린다 — Reveal.tsx가 같은
                클래스를 쓰고 있어 그쪽 팝업까지 같이 커진다. */}
            <p className="zt-result" style={{ fontSize: "var(--text-emphasis)" }}>
              {winner}
            </p>

            {/* 라이어 추측·봇 색출 — RoleReveal.tsx의 라벨:값 그리드를 재사용한다.
                "20px 제목 + 회색 한 줄" 블록을 두 번 반복하던 자리다. */}
            <dl className="zt-kv">
              {guessWord !== null && (
                <>
                  <dt>라이어의 추측</dt>
                  <dd style={{ color: guessedRight ? "var(--color-accent)" : undefined }}>
                    {guessWord} · {guessedRight ? "정답" : "오답"}
                  </dd>
                </>
              )}
              <dt>봇 색출</dt>
              <dd>
                {totalVoters}명 중 {botVoteCorrectCount}명 성공
              </dd>
            </dl>

            <div className="hr" />

            <h3 className="zt-vote-title">정체 공개 · 봇 지목 현황</h3>
            <ul className="zt-vote-list">
              {resultPlayers.map((player) => {
                const hit = guessedBot(player);
                return (
                <li key={player.id}>
                  {/* disabled 버튼 — VotePanel이 묘사 모드(클릭 불가)에서 쓰는 것과 같은
                      형태다. .zt-vote-row:disabled 가 이미 cursor를 되돌려 놓는다.

                      색은 행 전체에 건다. .avatar 와 .tag* 는 각자 color 를 직접 정해 두고
                      있어(tokens.css) 이 상속을 안 받는다 — 그래서 닉네임과 지목 대상
                      글자만 물든다. 투표를 안 한 행(봇 본인)은 맞고 틀림이 없어 색도 없다. */}
                  <button
                    type="button"
                    className="zt-vote-row"
                    disabled
                    style={{
                      // 기존 패널은 이름·지목·직업 글자를 전부 600으로 썼는데, .zt-vote-row로
                      // 옮기며 body 기본값(400)을 상속받아 눈에 띄게 얇아졌다 — 원래 무게로
                      // 되돌린다. .tag는 font-weight를 안 정해 두고 있어(tokens.css) 직업
                      // 뱃지도 이 상속을 같이 받는다, 이 역시 기존과 같다.
                      // 크기는 15px 그대로 둔다 — 기존값 16px로 올리면 260px 폭에서 긴
                      // 닉네임("레이아웃담당")이 다시 넘친다.
                      fontWeight: 600,
                      color:
                        player.votedFor === null
                          ? undefined
                          : hit
                            ? "var(--color-ok)"
                            : "var(--color-danger)"
                    }}
                  >
                    <span className="zt-vote-name">
                      {/* 아바타가 곧 라벨 글자다(avatarInitial). 그래서 글자를 따로 또
                          쓰지 않고 텍스트 자리엔 닉네임을 둔다 — 왼쪽 채팅 로그가 쓰는
                          [아바타 = 글자][이름 = 닉네임]과 같은 짝이다. 아바타는
                          aria-hidden이라, 닉네임이 없으면 라벨을 글자로 남겨 읽히게 한다.
                          zt-vote-label로 감싸지 않는 이유: 그 클래스는 폰에서
                          display:none이라(원형 버튼에 글자가 안 들어가서) 여기서 쓰면
                          폰에서 이름이 통째로 사라진다 — BotVote.tsx도 같은 이유로 안 쓴다. */}
                      <Avatar label={player.label} variant={player.id === myId ? "mine" : "default"} />
                      {player.name ?? stripParticipantPrefix(player.label)}
                    </span>
                    {/* 아바타·닉네임을 뺀 나머지(정체 뱃지 + 지목 대상)는 한 덩어리로 묶어
                        행 오른쪽 끝에 붙인다 — .zt-vote-row가 justify-content:space-between
                        이라 자식이 둘일 때만 "왼쪽 끝 / 오른쪽 끝"으로 갈린다. 뱃지와
                        화살표를 각각 직접 자식으로 두면 자식이 셋이 되어 셋을 균등
                        배분하느라 가운데 것이 행마다 다른 자리에서 떠다닌다.
                        겹침(봇+라이어)이면 뱃지가 2개라 폭이 모자랄 때 줄바꿈되게 두고,
                        개별 뱃지엔 nowrap·flexShrink:0을 줘 글자가 세로로 쪼개지며
                        찌그러지는 걸 막는다(2026-08-21 수정 유지). */}
                    <span
                      style={{
                        display: "flex",
                        alignItems: "center",
                        // 8px(--space-2)이면 260px 패널에서 긴 닉네임("레이아웃담당") 행이
                        // 한계선에 걸려 두 줄로 감긴다 — 4px로 줄여 여유를 만든다.
                        gap: 4,
                        flexWrap: "wrap",
                        justifyContent: "flex-end"
                      }}
                    >
                      {/* 지목 대상은 직업 뱃지 바로 왼쪽에 둔다(이 그룹의 DOM 순서가 곧
                          왼→오 배치다). 적중한 행에도 같이 적는다 — 정의상 항상 봇을
                          가리켜 정보량 자체는 없지만, 행마다 이 칸이 비었다 차 있었다
                          하는 것보다 늘 같은 자리에 있는 편이 훑기 쉽다. 맞고 틀림은
                          글자색이 따로 말한다.
                          8/20 2차 수정: "지목" 텍스트 제거 — 패널 폭이 좁아 한 줄에 안 맞음. */}
                      {player.votedFor && (
                        <span className="zt-vote-count">→ {stripParticipantPrefix(player.votedFor)}</span>
                      )}
                      {player.tags.map((t) => (
                        <span
                          key={t}
                          className={`tag ${TAG_CLASS[t]}`}
                          style={{
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                            // 가장 넓은 뱃지(라이어, 3글자)에 폭을 맞추고 가운데 정렬한다 —
                            // 그래야 시민·봇처럼 글자 수가 다른 뱃지도 글자축이 세로로 맞는다.
                            // 오른쪽 정렬만 하면 오른쪽 변만 맞고 글자는 행마다 어긋난다.
                            //
                            // minWidth 는 라이어의 실제 폭 아래로는 못 내린다 — 넘기는 순간
                            // 라이어만 혼자 넓어져 정렬이 깨진다. 그래서 더 좁히려면 .tag 의
                            // 좌우 padding(기본 10px)부터 줄여야 한다. 7px로 낮추면 라이어가
                            // 11px×3자 + 14px = 47px가 되고, minWidth 48이 그 바로 위다.
                            // 세로 padding(3px)은 그대로 둬 다른 화면의 뱃지와 높이를 맞춘다.
                            // 48이 아니라 50인 것은 위에서 글자 무게를 600으로 되돌렸기
                            // 때문이다 — 47px는 400 기준 실측이라 여유가 없다.
                            padding: "3px 7px",
                            minWidth: 50,
                            justifyContent: "center"
                          }}
                        >
                          {t}
                        </span>
                      ))}
                    </span>
                  </button>
                </li>
                );
              })}
            </ul>
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
