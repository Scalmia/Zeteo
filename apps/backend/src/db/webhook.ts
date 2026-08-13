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

  const stamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-');
  const form = new FormData();
  form.append('payload_json', JSON.stringify({ username: 'Zeteo 로그', content: summary }));
  form.append(
    'file',
    new Blob([markdown], { type: 'text/markdown' }),
    `${room.roomId}_${stamp}.md`,
  );

  try {
    const res = await fetch(WEBHOOK_URL, { method: 'POST', body: form });
    if (!res.ok) console.error(`웹훅 실패 HTTP ${res.status}`);
  } catch (e) {
    console.error('웹훅 오류:', e);
  }
}