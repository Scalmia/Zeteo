# Zeteo

라이어 게임 속에 숨은 **단 하나의 봇**을 찾는 소셜 디덕션 게임.

플레이어들은 라이어 게임을 한다고 생각하며 플레이하지만, 게임이 끝나는 순간 진짜 질문이 던져진다 — **이 중 누가 사람이 아니었나.**

- 참가 5인 = 사람 4 + 봇 1 (봇은 인원수와 무관하게 항상 1명, 시민/라이어 무작위 배정)
- 착수 8/3 · MVP 8/9 · 완성 목표 8/23

---

## 시작하기

```bash
git clone https://github.com/Scalmia/Zeteo.git
cd Zeteo
npm install          # 워크스페이스 전체가 한 번에 설치된다
```

**터미널 두 개를 띄운다.** 둘 다 "서버"라 불리지만 하는 일이 완전히 다르다.

```bash
# 터미널 1 — 게임 서버 (게임 상태를 들고 있음. 봇도 여기 산다)
npm run dev -w backend

# 터미널 2 — Vite 개발 서버 (React 파일을 브라우저에 배달만 함)
npm run dev -w frontend
```

### 파트별 첫 명령어

| 파트         | 담당         | 명령어                                                |
| ------------ | ------------ | ----------------------------------------------------- |
| A · 서버     | 서버담당     | `npm run dev -w backend`                              |
| B · 봇       | 봇담당       | `npm run bot -w backend` ← 서버·화면 없이 봇만 테스트 |
| C · 게임화면 | 화면담당     | `npm run dev -w frontend` → `/?mock=`                 |
| D · 공통     | 레이아웃담당 | `npm run dev -w frontend`                             |

**서버가 없어도 화면을 볼 수 있다.** `http://localhost:5173/?mock=` 에 들어가면 mock 상태 목록이 나오고, `?mock=debate-voted` 처럼 지정하면 해당 화면으로 바로 진입한다.

**봇을 돌리려면** `apps/backend/.env` 가 필요하다.

```bash
cp apps/backend/.env.example apps/backend/.env   # 값을 채운다. .env 는 커밋되지 않는다
```

---

## 구조와 소유권

npm workspaces 모노레포. 파일 단위로 소유자가 갈리므로 충돌이 거의 없다.
**남의 파일이 필요하면 직접 고치지 말고 요청한다.**

```
packages/shared-types/src/index.ts     ★ 4파트 공동 계약
                                         변경 시 Discord 공지 + PR 제목에 [types]

apps/frontend/src/
  main.tsx App.tsx                          D
  screens/RoleReveal Describe Debate
          FinalDefense LifeVote Reveal      C
  screens/GameScreen.tsx                    C  ← 파트 C 단일 진입점
  screens/Landing Lobby BotVote Result      D
  components/Chat VotePanel PlayerList
             Timer                          C
  components/Button Layout                  D
  styles/tokens.css                         D  ← C의 game.css가 이 이름들을 참조
  mock/states.ts                            C·D 공동
  net/socket.ts  hooks/useGameState.ts      A

apps/backend/src/
  index.ts room.ts stateMachine.ts
  vote.ts timer.ts view.ts                  A
  bot/                                      B
```

타입은 `@zeteo/shared-types` 로 import 한다. 상대 경로를 쓰지 않는다.

```ts
import type { GameState, ClientEvent } from '@zeteo/shared-types';
```

### 연결 규약

- **파트 D → C**: 게임 페이즈일 때 `<GameScreen state={state} onEvent={onEvent} />` 하나만 마운트하면 된다. C의 화면 6개를 알 필요 없다.
- **파트 A → B**: 봇 차례에 `decideBotAction(ctx)` 하나만 호출한다. 봇 내부를 알 필요 없다.
- **파트 C·D → A**: 화면은 `GameState` 를 받아 **그리기만** 한다. 승패·과반·페이즈 판정은 전부 서버 몫이다.

---

## 설계 원칙

1. **서버가 단일 진실 공급원** — 클라이언트는 상태를 소유하지 않고 그리기만 한다.
2. **상태는 항상 통째로 보낸다** — 증분 전송을 하지 않는다. 이벤트를 놓쳐도 다음 상태를 받으면 저절로 복구된다.
3. **타이머의 진실은 서버** — 서버는 마감 절대 시각(`deadlineAt`)만 주고, 클라이언트가 `deadlineAt - Date.now()` 를 매 틱 재계산한다.
4. **과반은 인원수에서 계산** — 하드코딩 금지. `투표자 = 참가자 − 1`, `과반 = ⌊투표자/2⌋ + 1`
5. **🔴 `isBot`·`role` 은 절대 클라이언트로 나가지 않는다** — 상태 출구가 `apps/backend/src/view.ts` 의 `buildGameStateFor` 한 곳으로 모여 있다. 이 함수만 검토하면 되도록 유지한다. 이게 새면 개발자도구 한 번에 게임이 끝난다.

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

## 코드 스타일

```bash
npm run format        # 전체 포맷
npm run format:check  # 검사만
```

에디터에 Prettier 확장을 깔고 "저장 시 포맷"을 켜두면 신경 쓸 일이 없다. 설정은 루트 `.prettierrc` 하나를 4명이 공유한다.
