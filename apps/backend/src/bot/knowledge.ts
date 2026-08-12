import { fetchTopSuspicionReasons, fetchRecentBotLines } from '../db/history';

let suspicionHint = '';
let recentLines: string[] = [];

async function loadBotKnowledge(): Promise<void> {
  try {
    const reasons = await fetchTopSuspicionReasons(5);
    if (reasons.length > 0) {
      suspicionHint =
        `\n[참고 — 과거 판에서 사람들이 봇을 의심했던 이유 상위 ${reasons.length}개]\n` +
        reasons.map((r) => `- ${r.reason}`).join('\n') +
        `\n이런 티가 나지 않도록 특히 신경 쓰세요.`;
    }
  } catch (e) {
    console.error('[bot] 설문 데이터 로드 실패:', e);
  }

  try {
    recentLines = await fetchRecentBotLines(100);
  } catch (e) {
    console.error('[bot] 과거 발언 로드 실패:', e);
  }
}

const REFRESH_INTERVAL_MS = 5 * 60 * 1000;

/** 서버 시작 시 한 번 부른다. 즉시 한 번 읽고, 이후 5분마다 다시 읽는다. */
export function startBotKnowledge(): void {
  void loadBotKnowledge();
  setInterval(() => void loadBotKnowledge(), REFRESH_INTERVAL_MS);
}

export function getSuspicionHint(): string {
  return suspicionHint;
}

export function getRecentBotLines(): string[] {
  return recentLines;
}