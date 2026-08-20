import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// 이 파일이 처음 import되는 순간(서버 부팅 시점)에 던진다. 값이 없어도 일단 띄워두면
// 첫 쿼리가 실제로 실행되는 시점(게임 시작 등)에야 실패해서 원인 찾기가 더 어려워진다.
if (!url || !serviceKey) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env에 없습니다');
}

export const supabase = createClient(url, serviceKey, {
  // 서버 프로세스라 브라우저 세션이 없다 — persistSession은 로컬스토리지에 세션을
  // 저장하는 옵션이라 여기선 의미가 없고, 켜두면 불필요한 저장 시도만 늘어난다.
  auth: { persistSession: false },
});