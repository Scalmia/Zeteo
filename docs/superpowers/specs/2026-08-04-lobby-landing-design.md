# 랜딩·대기실 화면 설계 (파트 D)

날짜: 2026-08-04
담당: 박진 (파트 D)

## 배경

기획서 v2.0 §2 구조표에 `screens/ Landing Lobby BotVote Result`가 파트 D 소유로 명시되어있다.
BotVote·Result는 이미 구현됨. 남은 것은 Landing·Lobby.

기획서 §7 D5(방 입장 방식)는 A·D 공동 미결정 상태다. 실제 방 생성/공유 로직은 이 문서 범위 밖이며,
화면 UI만 mock 데이터로 먼저 만든다 — BotVote/Result를 만들 때와 같은 방식.

## 범위

- `LandingScreen.tsx`, `LobbyScreen.tsx` 신규 작성
- `types.ts`에 `LobbyPlayer`, `LobbyScreenState` 추가
- `App.tsx`에 `landing`/`lobby` phase 배선, 기본 진입 화면을 landing으로 변경
- 실제 소켓 연결, 방 생성 로직은 포함하지 않음 (파트 A 소켓 완료 후 별도 작업)

## LandingScreen

- 입력: 닉네임, 방번호 (로그인 없음)
- "입장하기" 버튼: 둘 다 입력해야 활성화
- `onJoin(name: string, roomId: string) => void` 콜백 호출

## LobbyScreen

```ts
interface LobbyPlayer {
  id: PlayerId;
  name: string;
  isReady: boolean; // GameState 계약에 없음 — mock 전용, 실 연동 시 필드 협의 필요
}

interface LobbyScreenState {
  roomId: string;
  players: LobbyPlayer[]; // 최대 5슬롯
  myId: PlayerId;
}
```

- 방번호 표시
- 참가자 5슬롯 — 채워진 자리는 이름+준비여부, 빈 자리는 "대기중"
- 본인용 "준비완료" 토글 버튼

## App.tsx 배선

- `MockPhase`: `"landing" | "lobby" | "botVote" | "result"`
- 기본 phase: `landing`
- landing → onJoin → lobby
- lobby에는 기존 botVote/result 미리보기 버튼 유지 (개발용 단축)

## 후속 논의 필요 (팀)

- `isReady` 필드를 GameState에 추가할지 (S6/S7 필드 미결정과 같은 성격의 이슈)
- D5(방 입장 방식) 확정 후 실제 join 로직 연결
