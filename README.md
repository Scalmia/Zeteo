# Zeteo

라이어 게임 속에 숨은 **단 하나의 봇**을 찾는 소셜 디덕션 게임.

플레이어들은 라이어 게임을 한다고 생각하며 플레이하지만, 게임이 끝나는 순간 진짜 질문이 던져진다 — **이 중 누가 사람이 아니었나.**

- 한 방 4~8인 = 사람 3~7 + 봇 1 (봇은 인원수와 무관하게 항상 1명, 시민/라이어 무작위 배정)
- 착수 8/3 · MVP 8/9 · 최종발표 9/8

한 판의 흐름은 `Phase` 하나로 표현된다 — 진실은 `packages/shared-types` 다.

```
lobby → roleReveal → describe → debate → finalDefense → lifeVote → reveal
      → (guessWord: 라이어가 적발됐을 때만) → botVote → result → survey
```

앞의 여섯은 라이어 게임이고, `botVote` 부터가 이 게임의 진짜 질문이다.

---

## 게임 플레이

**https://zeteo.up.railway.app/**

설치할 것 없이 링크만 열면 된다. 모바일 브라우저에서도 돌아간다.

```
닉네임 입력(6자 이하) → 방 목록 → 방 만들기 또는 입장 → 전원 준비완료 → 시작
```

- **방을 만들면 봇이 자동으로 참가해 준비완료 상태로 기다린다.** 그래서 사람 3명만 모여도
  4명(봇 포함)이 되어 게임을 시작할 수 있다. 방 정원은 8명까지.
- 시작 버튼은 없다 — **방에 있는 전원이 준비완료를 누르면** 그 순간 시작된다.
- 한 판은 최소 6분쯤 걸린다. 묘사 한 바퀴 → 토론·투표 → 최후 변론 → 생사 투표까지가
  라이어 게임이고, 그게 끝난 뒤에 **"이 중 누가 봇이었나"** 를 익명으로 지목한다.
- 새로고침해도 게임 중이면 원래 자리로 돌아온다. 게임 화면은 봇 여부를 아예 받지 않으므로
  개발자도구를 열어도 답이 보이지 않는다.

---

## 프로젝트 시작하기

```bash
git clone https://github.com/Scalmia/Zeteo.git
cd Zeteo
npm install          # 워크스페이스 전체가 한 번에 설치된다
```

> **어느 브랜치가 앞서 있는지는 그때그때 다르다.** 받기 전에 한 줄로 확인한다 —
> 뒤처진 쪽을 받으면 이미 지워진 옛 파일 기준으로 `tsc` 가 엉뚱한 에러를 무더기로 낸다.
>
> ```bash
> git rev-list --left-right --count origin/main...origin/dev   # 왼쪽=main에만, 오른쪽=dev에만
> ```
>
> 2026-09-04 기준으로는 `7  0` — `main` 이 `dev` 를 전부 포함하고 7커밋 더 앞서 있다.

**터미널 두 개를 띄운다.** 둘 다 "서버"라 불리지만 하는 일이 완전히 다르다.

```bash
# 터미널 1 — 게임 서버 (게임 상태를 들고 있음. 봇도 여기 산다)
npm run dev -w backend

# 터미널 2 — Vite 개발 서버 (React 파일을 브라우저에 배달만 함)
npm run dev -w frontend
```

**서버 주소를 설정할 곳은 없다.** 개발 중엔 Vite 가 `/socket.io` 를 `localhost:3000` 으로
프록시하고(`vite.config.ts`), 배포에선 백엔드가 프론트 정적 파일까지 같이 서빙해서 결국
같은 origin 이다. 그래서 `net/socket.ts` 는 `io()` 를 URL 없이 부른다.

### 파트별 첫 명령어

| 파트         | 담당         | 명령어                                                |
| ------------ | ------------ | ----------------------------------------------------- |
| A · 서버     | 서버담당     | `npm run dev -w backend`                              |
| B · 봇       | 봇담당       | `npm run bot -w backend` ← 서버·화면 없이 봇만 테스트 |
| C · 게임화면 | 화면담당     | `npm run dev -w frontend` → `/?mock=`                 |
| D · 공통     | 레이아웃담당 | `npm run dev -w frontend`                             |

**서버가 없어도 화면을 볼 수 있다.** `http://localhost:5173/?mock=` 에 들어가면 mock 목록이
나오고, 키를 지정하면 그 화면으로 바로 진입한다.

```
?mock=game-test        게임 화면 + 팝업 5종을 칩으로 전환하는 테스트 하네스
?mock=landing          닉네임 입력
?mock=room-list        방 목록 (정적 목업 rooms)
?mock=lobby  describe-myturn  describe-waiting  debate-voted
     finalDefense-accused  lifeVote-voter  lifeVote-accused
     roleReveal-citizen  roleReveal-liar  reveal-citizen  reveal-liar
     guessWord-liar  guessWord-watcher  botVote  result  survey
```

목록의 진실은 `mock/states.ts` 다 — 키를 추가하면 `/?mock=` 목록에 저절로 뜬다.

**봇을 돌리거나 DB 를 붙이려면** `apps/backend/.env` 가 필요하다.

```bash
cp apps/backend/.env.example apps/backend/.env   # 값을 채운다. .env 는 커밋되지 않는다
```

`.env.example` 에 환경변수 13개가 **어디서 발급받고 없으면 무엇이 깨지는지**까지 적혀 있다.
요약하면:

- `SUPABASE_URL` · `SUPABASE_SERVICE_ROLE_KEY` — **없으면 서버가 부팅 시점에 죽는다.**
  service_role 은 RLS 를 통과하는 서버 전용 키다. 프론트나 저장소에 절대 넣지 않는다.
- 봇 키(`BOT_*` 또는 `GPT_*`) — 없으면 서버는 살아 있고 **봇이 말을 안 하는 게임**이 된다.
- 나머지(`PORT` · `ADMIN_KEY` · `LOG_WEBHOOK_URL`)는 없어도 게임이 정상 동작한다.

프론트만 볼 거면 `.env` 자체가 필요 없다 — `?mock=` 으로 충분하다.

---

## 구조와 소유권

npm workspaces 모노레포. 파일 단위로 소유자가 갈리므로 충돌이 거의 없다.

> **중간발표 이후 파트 경계는 완화됐다.** 필요하면 다른 파트 소유 파일도 직접 고친다.
> 다만 그 파일의 기존 관례(스타일 작성 방식·토큰 참조 방식)는 그대로 따르고, 공용 토큰의
> "값"은 바꾸지 않는다(참조만). 아래 표기는 "기본 담당"이지 허가 절차가 아니다.

```
packages/shared-types/src/index.ts     ★ 4파트 공동 계약
                                         변경 시 Discord 공지 + PR 제목에 [types]

apps/frontend/src/
  main.tsx App.tsx types.ts roomConfig.ts        D  ← App.tsx 가 phase로 화면을 고른다
  LandingScreen LobbyScreen RoomListScreen
  ResultScreen SurveyScreen                      D  ← lobby/result/survey 는 D가 직접 그린다
  screens/GameScreen.tsx                         C  ← 파트 C 단일 진입점
  screens/MainScreen.tsx modalFor.tsx            C  ← 항상 떠 있는 본화면 + 팝업 판단
  screens/RoleReveal LifeVote Reveal BotVote     C  ← 팝업 내용물
  screens/game.css                               C
  components/Chat VotePanel Timer Modal          C
  components/Button                              D
  styles/tokens.css ambience.css roomList.css    D  ← C의 game.css가 이 이름들을 참조
  mock/states.ts MockHarness GameScreenTest      C·D 공동
  net/socket.ts  hooks/useGameState.ts           A

apps/backend/src/
  index.ts room.ts stateMachine.ts
  vote.ts timer.ts view.ts                       A  ← 방 상태는 room.ts 의 rooms 맵(메모리)
  db/supabase content game log survey
     webhook explore                             A
  bot/                                           B

docs/                                            설계·인수인계 문서 (아래 각 절에서 가리킨다)
```

표기가 없는 파일(`components/Ambience` `ParticleTrail` `Avatar` `FullscreenButton` 등)은
중간발표 이후 추가돼 담당이 문서로 정해진 적이 없다. 고치기 전에 `git log` 로 최근 작성자를
확인하고 그 사람에게 한마디 남긴다.

타입은 `@zeteo/shared-types` 로 import 한다. 상대 경로를 쓰지 않는다.

```ts
import type { GameState, ClientEvent } from '@zeteo/shared-types';
```

**⚠️ 이 패키지에는 타입만 넣는다 — 런타임 값(`const`)을 넣으면 배포가 죽는다.**
`package.json` 의 main 이 `src/index.ts` 를 그대로 가리키는 타입 전용 패키지라, 타입 import 는
컴파일 때 통째로 사라지지만 상수는 남는다. 빌드된 `apps/backend/dist` 가 실행 중
`require('@zeteo/shared-types')` 를 시도하고 Node 가 `.ts` 를 못 읽어 그 자리에서 죽는다(실측).
그래서 방 정원은 서버 `room.ts` 와 프론트 `roomConfig.ts` 에 **같은 값으로 두 벌** 있다.

```
MIN_PLAYERS = 4   봇 포함. 이 인원부터 게임이 시작된다
MAX_PLAYERS = 8   봇 포함. 방 정원 고정값
NAME_MAX_LENGTH = 6
```

한쪽만 고치면 "목록에선 들어갈 수 있어 보이는데 서버가 거절"하는, 화면에 원인이 안 드러나는
상태가 된다.

### 연결 규약

- **파트 D → C**: 게임 페이즈일 때 `<GameScreen state={state} onEvent={onEvent} />` 하나만
  마운트하면 된다. C의 내부 구성을 알 필요 없다. `roleReveal` 부터 `botVote` 까지 8개 페이즈가
  C 담당이다(`botVote` 는 기획서 v3.0 으로 D → C 이관, 8/11).
- **파트 A → B**: 봇 차례에 `decideBotAction(ctx)` 하나만 호출한다. 봇 내부를 알 필요 없다.
- **파트 C·D → A**: 화면은 `GameState` 를 받아 **그리기만** 한다. 승패·과반·페이즈 판정은
  전부 서버 몫이다.
- 설문 화면은 기획서 v4.0 리플레이 통합(8/20) 이후 result 와 같은 필드(`messages`·`revealed*`)를
  쓴다. `view.ts` 가 survey 를 result 와 같은 "게임이 끝난 뒤"로 취급해 채워 보낸다.

---

## 설계 원칙

1. **서버가 단일 진실 공급원** — 클라이언트는 상태를 소유하지 않고 그리기만 한다.
2. **상태는 항상 통째로 보낸다** — 증분 전송을 하지 않는다. 이벤트를 놓쳐도 다음 상태를 받으면 저절로 복구된다.
3. **타이머의 진실은 서버** — 서버는 마감 절대 시각(`deadlineAt`)만 주고, 클라이언트가 `deadlineAt - Date.now()` 를 매 틱 재계산한다.
4. **과반은 인원수에서 계산** — 하드코딩 금지. `투표자 = 참가자 − 1`, `과반 = ⌊투표자/2⌋ + 1`
5. **🔴 `isBot`·`role` 은 절대 클라이언트로 나가지 않는다** — 상태 출구가 `apps/backend/src/view.ts` 의 `buildGameStateFor` 한 곳으로 모여 있다. 이 함수만 검토하면 되도록 유지한다. 이게 새면 개발자도구 한 번에 게임이 끝난다.
6. **권한 판정의 근거는 서버가 쥔 값 하나** — 방장 여부는 `room.hostId`, 시작 가능 여부는
   `readyIds.size`. 클라이언트의 버튼 비활성화는 UI 편의일 뿐 방어 수단이 아니다.

---

## 브랜치

```
main            발표·시연용. 항상 동작. 봇담당만 병합
 └ dev          통합. PR + 리뷰 1명 승인으로만 진입
    ├ feat/server     서버담당
    ├ feat/bot        봇담당
    ├ feat/game-ui    화면담당
    └ feat/layout     레이아웃담당
```

- `main` 직접 push 금지
- 매일 작업 시작 전 `git checkout dev && git pull` 후 자기 브랜치에서 `git merge dev`
- PR 올린 뒤 30분 안에 리뷰가 없으면 병합한다 — 리뷰가 진행을 막는 것이 리뷰를 안 하는 것보다 나쁘다
- `packages/shared-types` 변경은 반드시 Discord 공지 후, PR 제목에 `[types]`

커밋 메시지: `feat(backend): 방 입장 이벤트 처리` / `fix(ui): 투표 패널 미갱신` / `chore: prettier 설정`

---

## 배포 (Railway)

**프론트를 따로 배포하지 않는다.** 백엔드가 `apps/frontend/dist` 를 정적 서빙하고, 모르는
경로는 전부 `index.html` 로 되돌린다(`app.get('/*splat')`). 소켓도 같은 origin 으로 붙으므로
프론트에 서버 주소를 넣을 곳이 없다.

```bash
npm run build     # 루트 — 프론트 빌드 후 백엔드 tsc
npm start         # node apps/backend/dist/index.js
```

레포에 배포 설정 파일은 없다 — 실제 빌드/시작 커맨드와 환경변수는 Railway 대시보드에만 있다.

**⚠️ Vercel 류로 못 옮긴다.** WebSocket 연결 상한이 5분인데 한 판이 최소 6분이다. 그리고 방
상태는 `room.ts` 의 `rooms` 맵, 즉 **서버 프로세스 메모리에만** 산다 — 인스턴스가 여러 개로
늘어나면 같은 방의 두 사람이 서로 다른 게임을 하게 된다.

- `RAILWAY_GIT_COMMIT_SHA` 는 Railway 가 배포마다 자동 주입하고 `games.bot_commit_sha` 로
  들어간다. **로컬에서 `'local'` 같은 값으로 채우지 말 것** — 판 집계가 섞여서 "프롬프트를
  바꾼 전후" 비교가 망가진다. 로컬에선 null 이 맞다.
- `/x/provider` · `/x/status` 는 재배포 없이 봇 프로바이더를 바꾸는 숨은 라우트다.
  `ADMIN_KEY` 가 비어 있으면 라우트 자체가 없는 것으로 취급된다(404). 틀린 열쇠에도 403 이
  아니라 404 를 준다 — "여기 뭔가 있다"를 안 알려주려고.

---

## 봇 개발 도구

전부 `apps/backend` 에서 돈다. 서버도 화면도 띄우지 않고 봇만 굴려볼 수 있다.

| 명령어                    | 무엇                                                                 |
| ------------------------- | -------------------------------------------------------------------- |
| `npm run bot -w backend`  | 목업 상황에서 봇 발화를 한 번에 여러 개 뽑는다. 인자: `[역할] [페이즈] [횟수] [시나리오] [피고인]` |
| `npm run talk -w backend` | 봇과 1대1 대화. 지연을 실제로 기다려서 발화 속도·끊어 보내는 간격을 몸으로 확인한다 |
| `npm run replay -w backend` | 실측 판에서 문제가 터진 지점을 라벨까지 고정 복원해, 같은 자리에서 실패를 **센다** |
| `npm run db -w backend`   | DB 를 눈으로 보는 읽기 전용 도구. `-- games` `-- survey` `-- picks` `-- refine-check` 등 |

```bash
npm run bot -w backend -- liar                    라이어로 묘사 5개
npm run bot -w backend -- citizen finalDefense 8 tiger me   봇이 몰린 최후 변론
npm run talk -w backend -- citizen 김치            제시어 지정
npm run replay -w backend -- stance 10             한 사례를 10회
npm run db -w backend -- games                     판 목록 (어떤 봇이 돌았는지 + 결과)
```

`bot` 과 `replay` 는 목적이 반대다. 앞은 매번 무작위로 뽑아 **다양성**을 보고, 뒤는 상황을 얼려
고정해 **고치기 전후를 견준다**. `db` 는 `SUPABASE_*` 두 개만 있으면 되고 봇 키는 필요 없다.

---

## 자가개선 루프

봇 프롬프트를 감으로 고치지 않기 위한 장치다. 설계 근거는 `docs/자가개선_설계.md`.

```
판이 5개 쌓인다 → replay 로 지금 실패율을 잰다 → 프롬프트·코드를 고친다
              → 같은 자리를 다시 잰다 → 숫자가 줄었으면 PR
```

```bash
npm run db -w backend -- refine-check     # 안 쓴 판이 문턱을 넘었나
```

- **고쳐지는 건 발언이 아니라 프롬프트다.** 그래서 산출물이 코드 diff 이고 PR 이 나온다.
- **머지 여부는 사람이 정한다.** 사람이 하는 일은 "봇이 이상한 결론을 냈는지 검사하는 것"
  하나뿐이고, 봇이 못 하는 일을 사람이 대신하는 단계는 만들지 않는다.
- **아무것도 안 하고 끝나는 것이 정상 결과 중 하나다.** 조건이 안 찼으면 "아직 N판입니다"
  하고 끝낸다 — 매번 뭔가를 고쳐야 한다고 여기면 고칠 게 없을 때 억지로 만들어낸다.
- 판정은 기계가 확실히 셀 수 있는 것만 본다(라벨을 불렀나, 특정 낱말이 들어갔나, 침묵했나).
  눈치가 있는지 없는지는 셀 수 없으므로 발언을 전부 찍어 사람이 읽는다.

---

## DB (Supabase)

스키마는 Supabase 안에만 있다 — 레포에 마이그레이션 파일이 없다. DDL 은 SQL Editor 에서
직접 실행하고, **무엇을 왜 바꿨는지는 PR 본문에 남긴다.** 안 남기면 어디에도 기록이 없다.
(`supabase-js` 로는 DML 만 된다. `npm run db` 도 읽기 전용이다.)

판 하나가 남기는 것: `games` · `players` · `game_messages` · `game_votes` ·
`survey_responses` · `survey_response_reasons`. 주제·단어와 설문 문항은 마스터 테이블이다.
ERD 는 `docs/DB_ERD.html`.

### 설문 문항 세대 교체

문항은 덮어쓰지 않고 세대별로 쌓는다. `survey_reasons` 를 `UPDATE` 로 갈면
`survey_response_reasons.reason_id` 가 가리키는 뜻이 소급해서 바뀌어, 과거 응답이
새 문항으로 읽힌다. 코드는 `is_active = true` 인 문항 하나만 읽는다
(`db/survey.ts` 의 `fetchSurveyReasons`).

```sql
begin;

-- 활성 문항은 항상 하나다(부분 유니크 인덱스 uniq_survey_questions_active).
-- 먼저 내리지 않고 새 행을 켜면 인덱스 위반으로 통째로 실패한다.
update survey_questions set is_active = false where is_active;

insert into survey_questions (code, text, is_active)
values ('bot_reason_v2', '왜 봇이라고 생각했나요?', true);

insert into survey_reasons (question_id, code, text, is_other, sort_order)
select q.id, v.code, v.text, v.is_other, v.sort_order
from survey_questions q,
  (values
    ('too_fast',     '반응이 너무 빠름',   false, 1),
    ('too_polished', '말투가 너무 정돈됨', false, 2),
    ('other',        '기타',               true,  3)
  ) as v(code, text, is_other, sort_order)
where q.code = 'bot_reason_v2';

commit;
```

`npm run db -w backend -- gen` 이 다음 세대 INSERT 문을 **미리보기로만** 찍어준다(실행 안 함).
`-- questions` 로 현재 세대를 확인할 수 있다.

**빠뜨리기 쉬운 NOT NULL** — 아래 칸들은 기본값이 없어서 안 넣으면 실패한다.

| 테이블 | 반드시 넣을 것 |
| --- | --- |
| `survey_questions` | `code`, `text`, `is_active` |
| `survey_reasons` | `question_id`, `code`, `text`, `is_other`, `sort_order` |

**⚠️ DB 만 고치면 화면은 안 바뀐다.** `fetchSurveyReasons` 의 `cachedReasons` 가 프로세스가
사는 동안 안 풀려서, 서버가 재시작할 때까지 옛 문구를 보여준다. PR → 머지 → Railway
리빌드 흐름이면 재시작이 저절로 끼지만, "DB 만 살짝 고치기" 는 안 통한다.

**⚠️ 무료 프로젝트는 일주일간 활동이 없으면 일시정지된다.** 데이터는 남고 대시보드에서
Resume 하면 되지만, 며칠 손 놓으면 다음에 열었을 때 멈춰 있다.

---

## 코드 스타일

```bash
npm run format        # 전체 포맷
npm run format:check  # 검사만
```

에디터에 Prettier 확장을 깔고 "저장 시 포맷"을 켜두면 신경 쓸 일이 없다. 설정은 루트 `.prettierrc` 하나를 4명이 공유한다.

줄바꿈은 루트 `.gitattributes`(`* text=auto eol=lf`)로 통일돼 있다. pull 후에도 CRLF 차이가
남으면 `git ls-files --eol <파일>` 로 확인하고 `git restore .` 로 작업 폴더를 다시 깐다.
