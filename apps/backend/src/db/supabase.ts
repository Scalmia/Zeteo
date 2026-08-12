import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const url = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 .env에 없습니다');
}

export const supabase = createClient(url, serviceKey, {
  auth: { persistSession: false },
});