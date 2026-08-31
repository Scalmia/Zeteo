import { RoomInternalState } from '../room';

const WEBHOOK_URL = process.env.LOG_WEBHOOK_URL;

export async function sendLogToDiscord(room: RoomInternalState, markdown: string) {
  if (!WEBHOOK_URL) return; // 미설정이면 조용히 건너뜀

  const bot = room.players.find((p) => p.isBot);
  const summary = [
    `**[${room.roomId}]** 종료 · ${room.players.length}인 · ${room.round}라운드`,
    `주제 ${room.category} / 제시어 ${room.word}`,
    `봇 ${bot?.label ?? '?'} · 결과 ${room.liarGameResult ?? '미확정'}`,
  ].join('\n');

  // 콜론(:)이 그대로면 첨부파일명으로 저장할 때 문제가 되는 환경이 있어 하이픈으로 바꾼다.
  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ username: 'Zeteo 로그', content: summary }));
  form.append(
    'file',
    new Blob([markdown], { type: 'text/markdown' }),
    `${room.roomId}_${stamp}.md`,
  );

  // 호출부(index.ts의 sendFinalReportToDiscord)가 이 함수를 `void`로 띄워놓고 기다리지
  // 않는다 — 디스코드 전송은 부가 알림이지 게임 종료 처리(deleteRoom 등)를 막을 이유가
  // 아니라서다. 그래서 여기서 예외를 밖으로 던지면 아무도 안 잡는 unhandled rejection이
  // 되므로, 실패는 로그만 남기고 삼킨다.
  try {
    const res = await fetch(WEBHOOK_URL, { method: 'POST', body: form });
    if (!res.ok) console.error(`웹훅 실패 HTTP ${res.status}`);
  } catch (e) {
    console.error('웹훅 오류:', e);
  }
}