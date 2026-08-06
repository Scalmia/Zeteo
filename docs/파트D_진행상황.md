# 파트 D 진행 상황 (박진)

마지막 갱신: 2026-08-06

## 완료된 것

- VoteScreen(봇지목)·ResultScreen(최종결과) — index.html CDN 방식 오류 복구, Vite 표준 전환
- 다크(블랙 앤 레드) 테마 11개 토큰 정합 (`apps/frontend/src/styles/tokens.css`) — game.css와 이름 일치 확인됨
- LandingScreen·LobbyScreen 신규 구현 (기획서 §5 D 잔여 작업 완료)
- App.tsx에 파트 C의 GameScreen 연결 (랜딩→대기실→게임6단계→봇지목→결과 mock 흐름), 닉네임 통일(myId=p3)
- 전부 `feat/layout`에 push 완료

## shared-types 계약 — 이미 dev에 병합됨 (중요, 범위 확인 필요)

2026-08-04, 팀원 공지로 `packages/shared-types` 잠금됨 → **같은 날 코디네이터가 dev에 이미 반영 완료** (`git fetch` 후 `origin/dev`에서 확인됨). 로컬 `feat/layout`에는 아직 안 받아온 상태 — **내일 `git merge origin/dev` 예정.**

**공지보다 실제 반영 범위가 더 큼.** dev의 최종 `packages/shared-types/src/index.ts` 확인 결과:

```ts
// GameState 신규 필드 (S6·S7)
botVoteCounts: { voted: number; total: number };
botVoteCorrectCount: number;
revealedBotId: string | null;
revealedLiarId: string | null;
revealedNames: Record<string, string> | null;  // ★ 공지에 없던 신규 필드 — playerId→실명
reasons: SurveyReason[];

// PublicPlayer 변경 — 이름 자체가 바뀜
interface PublicPlayer { id: string; label: string; isAlive: boolean; }  // name → label

// Phase에 'survey' 추가, ClientEvent에 survey 이벤트 추가
// BotAction/BotContext도 공지 1번 내용대로 반영됨 (describe/chat 분리 등)
```

**`PublicPlayer.name` → `label`로 이름이 통째로 바뀐 게 핵심.** 익명 표시가 기본이고, `revealedNames`로 result 단계에서만 실명 공개하는 설계로 보임(이유는 코드만 봐서는 추정 — 확인 필요). merge하면 `player.name` 참조하는 곳 전부 타입 에러 예상.

## 내일 할 것 (순서대로)

1. `git fetch origin` → `git merge origin/dev` (feat/layout에서)
2. `npx tsc -b --noEmit` 돌려서 깨지는 곳 전부 확인 (`App.tsx`, `types.ts`, mock 데이터 등 — `.name`→`.label` 변경 영향 큼)
3. `ResultScreen.tsx`/`types.ts`/`App.tsx` mock을 새 필드명으로 재작성
   - `reveals` → `revealedBotId`/`revealedLiarId`/`revealedNames`
   - `botDetectSummary` → `botVoteCorrectCount`
   - `votedCount`/`totalCount` → `botVoteCounts`
   - player 표시 로직을 `label`(평소) / `revealedNames`(공개 시점) 구조로 변경
4. `feat/game-ui`(이현우) 토큰 이름(`--color-divider`/`--radius-md` → `--color-line`/`--radius`) 동기화 — 이미 전달함, 처리 여부 확인
5. 파트 A 소켓 연결 완성되면 App.tsx의 mock 데이터를 실제 GameState로 교체
6. D5(방 입장 방식, 파트 A 공동), tokens.css 색상 최종 확정 — 팀 논의 대기

## 결과 화면 개편 (2026-08-06 논의)

현재 ResultScreen 하나에 결과+설문(왜 봇이라 생각했나)이 같이 있음. 아래 3단계로 분리 예정.

1. **결과 화면** — 기존 내용 그대로 유지 + **제시어도 전원 공개** 추가
2. **설문 페이지** (신규, 결과 다음 페이지로 분리)
3. ~~계속/종료 선택 화면~~ (2026-08-06 결정으로 폐기 — 아래 참고)

### 백엔드 의존도 확인 결과 (코드 확인 완료)

- **1번(결과→설문 분리)**: 완료. `stateMachine.ts:101` 주석에 "survey는 nextPhase()로 진입하는 실제 phase가 아니다 — result에 머문 채 index.ts의 case survey가 부수효과 없이 액션만 처리한다"고 명시됨. 서버 phase는 계속 `'result'`로 유지되므로 화면 단계 분리는 프론트 로컬 상태로 처리.
  - `types.ts`: `ResultScreenState`에서 설문 필드(reasons/checkedReasonIds/freeText) 분리, 신규 `SurveyScreenState` 추가
  - `ResultScreen.tsx`: 설문 블록 제거, `onNext` 콜백 + "다음" 버튼 추가
  - `SurveyScreen.tsx` 신규: 기존 설문 블록(이유 체크박스·자유서술·제출) 그대로 이관
  - `App.tsx`: `ResultFlow` 컴포넌트 신규 — `useState`로 result/survey 2단계 로컬 전환 관리 (서버 phase는 안 건드림)
  - `npx tsc -b --noEmit` 통과 확인
  - (웹 확인 후 추가 수정) 세로 중앙 정렬 누락 수정(`alignItems:"center"`), 정체공개 카드를 봇·라이어 2명만 보여주던 것에서 **전체 참가자**(시민 포함, `label`=입장 시 배정되는 알파벳 한 글자)를 보여주도록 변경 — `types.ts`에 `ResultPlayer{id,label,name,tag}` 추가, `App.tsx`에서 `state.players` 전체를 매핑해 태그(봇/라이어/시민) 계산
  - 알파벳 라벨 옆에 원래 입장 아이디도 표시 — `view.ts:87-90`에서 서버가 이미 result phase에 `revealedNames`(전체 참가자 id→원래 이름)를 채워서 보내고 있어서 백엔드 변경 없이 프론트만 수정(`ResultScreen.tsx`, `App.tsx`)해서 해결
- **2번(제시어 전원 공개)**: 파트 A가 `origin/feat/server`(`139aca3`, "2,3 제외 수정 완료", 2026-08-06 10:17)에서 이미 해결 완료. `view.ts` A-4 수정 — `word: me.role === 'liar' && room.phase !== 'result' ? null : room.word`.
  - **merge 보류 중**: 로컬 `feat/layout` 워킹트리에 백엔드 커밋 안 된 수정사항 있음(`index.ts`/`room.ts`/`view.ts`/`vote.ts`/`bot/*` 등, `feat/server`가 건드리는 파일과 겹침) — 그 작업 완료된 뒤 `feat/server` merge 진행하기로 함 (2026-08-06 결정)
- **3번 폐기, 새 결정(2026-08-06)**: 계속/종료 선택 화면 없이, **설문 제출하면 바로 랜딩(아이디·방번호 재입력) 화면으로 복귀**하는 걸로 확정. (처음엔 "로비"라고 했다가 "맨 처음 화면"으로 재확인 — 로비 아니고 랜딩 맞음)
  - 프론트: `App.tsx`의 `ResultFlow`에서 "submitted" 단계·placeholder 제거함
  - **백엔드 미구현 확인됨**: `index.ts:404-418`의 `case 'survey'`가 지금은 콘솔 로그만 찍고 `return`(상태 변화·broadcast 없음)
  - **단순 소켓 disconnect로는 안 됨**: `index.ts:432-446` disconnect 핸들러가 `room.phase === 'lobby'`일 때만 방에서 제거하고, 게임 시작 후(result 포함)엔 "중도 탈락 없음" 원칙으로 그대로 둠. 프론트에서 소켓만 끊으면 서버 방 정보에 유령처럼 남음 → **의도적 "방 나가기" 전용 이벤트가 새로 필요** (`ClientEvent`에 `leaveRoom` 추가 + `index.ts`에 확실히 방에서 제거하는 처리)
- **신규 요청(2026-08-06)**: 봇지목 개별 투표 내역("누가 누구를 지목했는지") 노출 필요. `vote.ts:48-58` `tallyBotVoteResults`가 내부적으로 `room.botVotes`(투표자→지목대상)를 이미 쓰고 있지만 `GameState`엔 집계(`botVoteCounts`)만 있고 원본이 없음 — `revealedBotId`/`revealedLiarId`와 같은 패턴으로 result phase에서만 채우는 `botVoteResults: Record<voterId, targetId>` 필드 추가 필요
  - `origin/feat/server`(`49d78aa`, 2026-08-06 13:23)에서 타입 추가 확인됨(단, `GameState` 인터페이스에 같은 줄 2번 중복 선언돼있음 — 컴파일엔 문제없어 보이나 참고)
  - 민성님이 `leaveRoom` 이벤트도 필요 없다고 확인해주심: `stateMachine.ts`에 result→survey 자동 전이 이미 있고, `index.ts`가 설문 제출 시점에 바로 방에서 제거 + 빈 방 자동 삭제까지 처리해둠. 프론트는 설문 제출 후 소켓 끊고 로컬 state를 null로 리셋하면 랜딩 나옴(새 이벤트 불필요)

## `feat/server` merge 시도 사고 기록 (2026-08-06)

`origin/feat/server`를 `feat/layout`에 직접 merge 시도했다가 대형 충돌 발생 — 원인: **`feat/server` 브랜치엔 `apps/frontend` 디렉터리 자체가 없음**(브랜치 히스토리상 프론트 파일을 한 번도 안 받아옴). 공통 조상엔 있던 `App.tsx`/`main.tsx`/`styles/tokens.css`/`screens/*`/`components/*`/`mock/states.ts` 등이 전부 modify/delete 충돌로 잡힘. `git merge --abort`로 즉시 중단.

- **사고**: abort 과정에서 `App.tsx`의 미커밋 작업(`ResultFlow` 등)이 함께 삭제됨 — 직접 재작성해서 복구, `tsc` 통과 확인함. 다른 파일은 영향 없었음.
- **재발 방지**: `feat/server`가 프론트 파일 히스토리를 계속 안 가져오는 한, 어느 브랜치에 merge하든(feat/layout이든 dev든) 매번 같은 충돌 재발함. 근본 해결은 파트 A가 주기적으로 `dev`를 자기 브랜치에 merge/rebase해서 프론트 파일을 최신으로 유지하는 것.
- **결정(2026-08-06)**: 지금 임시로 경로 선택 체크아웃하지 않고, **`dev`에 정식 병합될 때까지 대기 → 그 뒤 `feat/layout`에 `dev` merge → 그때 프론트 수정 작업(제시어 노출, 개별 투표 내역 표시, 설문→랜딩 소켓 리셋) 진행**하기로 함

## `dev` merge 및 잔여 작업 완료 (2026-08-06)

`dev`에 파트 A/B/C 전부 병합된 것(`1696512`) 확인 후 `feat/layout`에 `dev` merge 진행. `--no-commit --no-ff`로 먼저 충돌 규모 확인 → **충돌 0건**, 프론트·백엔드 `tsc` 둘 다 통과 확인 후 커밋(`e5da58a`). 이전 `feat/server` 직접 merge 사고와 달리 `dev`는 프론트 파일을 정상적으로 갖고 있어서 깔끔하게 합쳐짐.

merge 후 남은 3건 전부 완료:

1. **제시어 노출**: `types.ts`의 `ResultScreenState`에 `category`/`word` 추가, `App.tsx`에서 `state.category`/`state.word` 그대로 전달, `ResultScreen.tsx`에 "제시어" 카드 추가
2. **개별 투표 내역**: `types.ts`의 `ResultPlayer`에 `votedFor: string | null` 추가, `App.tsx`에서 `state.botVoteResults[p.id]`로 지목 대상 id를 찾아 label로 변환, `ResultScreen.tsx`에서 각 참가자 줄 아래 "→ X 지목" 표시
3. **설문 제출 → 랜딩 복귀**: `useGameState.ts`에 `leaveToLanding()` 추가(소켓 disconnect → state를 null로 리셋 → 소켓 재연결, 새 이벤트 불필요). `App.tsx`의 result 분기 `onSubmit`에서 `survey` 이벤트 전송과 함께 `leaveToLanding()` 호출

`npx tsc -b --noEmit`(프론트) 통과 확인.

## 결과→설문 버그 수정 (2026-08-06, 웹 테스트 중 발견)

**증상**: 설문 화면에서 이유 체크박스가 안 보이고 자유서술 textarea만 나옴.

**원인**: `view.ts:101-102` — `reasons`는 `room.phase === 'survey'`일 때만 채워짐(result·survey 공통 아님, survey 단독). 그런데 `index.ts:398-399`를 보면 **결과 화면 "다음" 버튼은 서버에 `{t:'ready'}` 이벤트를 보내야 실제로 `room.phase`가 `result→survey`로 전이되는 구조**로 바뀌어 있었음. 저희 `ResultFlow`는 로컬 `useState`로만 화면을 바꾸고 서버엔 아무 이벤트도 안 보내서, 서버 phase가 계속 `result`에 머물러 `reasons`가 빈 배열로 옴.

**수정**: `dev` merge로 서버가 실제 `survey` phase를 broadcast해주는 게 확인됐으므로, `App.tsx`에서 로컬 상태로 결과→설문을 흉내내던 `ResultFlow`/`useState` 전부 제거. `state.phase`(서버 진실)를 그대로 신뢰해서 `result`/`survey`를 `renderScreen`의 별도 분기로 처리하는 걸로 단순화:
- 결과 화면 "다음" → `onEvent({ t: "ready" })` 호출 (서버가 phase 전이)
- `state.phase === "survey"`일 때 `SurveyScreen` 직접 렌더링

`npx tsc -b --noEmit` 재통과 확인.
