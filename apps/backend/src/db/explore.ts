import { supabase } from './supabase';

/**
 * DB 를 눈으로 보는 도구. 아무것도 바꾸지 않는다(마지막 gen 만 예외이고 그것도 기본은 미리보기).
 *
 *   npm run db -w backend                  개요 — 테이블별 행 수
 *   npm run db -w backend -- games         판 목록 (어떤 봇이 돌았는지 + 결과)
 *   npm run db -w backend -- epochs        같은 봇끼리 묶어 세기   ← 트리거가 쓸 계산
 *   npm run db -w backend -- game <id>     그 판의 발언 전문
 *   npm run db -w backend -- survey        설문 응답 + 지목된 발언
 *   npm run db -w backend -- picks         지목된 발언 전문   ← ② 가 사례로 만들 후보
 *   npm run db -w backend -- questions     설문 문항 세대 (is_active)
 *   npm run db -w backend -- gen           다음 세대 문항 INSERT 미리보기 (실행 안 함)
 *
 * 명령마다 "SQL 로 쓰면 이렇다"를 같이 찍는다. supabase-js 는 SQL 을 직접 쓰는 게 아니라
 * 메서드를 이어 붙이면 라이브러리가 SQL 로 번역해 보내는 방식이라, 둘을 나란히 보면
 * 무엇이 무엇으로 바뀌는지가 드러난다.
 *
 * ── DDL 과 DML 의 차이 ──────────────────────────────────────────────
 *
 *   DDL   테이블·칼럼·인덱스의 "모양"을 바꾼다   CREATE TABLE · ALTER TABLE · CREATE INDEX
 *   DML   그 안의 "데이터"를 다룬다             SELECT · INSERT · UPDATE · DELETE
 *
 * supabase-js 로는 DML 만 된다. DDL 은 Supabase 콘솔의 SQL Editor 에서 직접 쳐야 한다.
 * 자가개선 루프가 필요한 것은 전부 DML 이라(문항 INSERT) 이 도구 범위 안에 있다.
 *
 * 이 파일은 SUPABASE_SERVICE_ROLE_KEY 로 붙는다. RLS(행 단위 권한)를 통과하는 열쇠라
 * 실수로 지우는 명령을 넣지 않았다 — 지우는 건 콘솔에서 눈으로 보고 하는 편이 안전하다.
 *
 * 필요한 환경변수는 SUPABASE_URL 과 SUPABASE_SERVICE_ROLE_KEY 둘뿐이다.
 * 봇 쪽 키(BOT_API_KEY 등)는 필요 없다 — 이 파일은 supabase 만 import 한다.
 */

const line = (n = 74): string => '─'.repeat(n);

function sqlNote(sql: string, js: string): void {
  console.log('  SQL 로 쓰면');
  sql.split('\n').forEach((l) => console.log(`    ${l}`));
  console.log('  supabase-js 로는');
  js.split('\n').forEach((l) => console.log(`    ${l}`));
  console.log('');
}

/** 긴 sha 는 앞 7자만. git 이 쓰는 관례와 같다. */
const short = (s: string | null): string => (s === null ? '(null)' : s.slice(0, 7));

// ── 개요 ─────────────────────────────────────────────────────────────

const TABLES = [
  'games',
  'game_messages',
  'game_votes',
  'survey_responses',
  'survey_response_reasons',
  'survey_questions',
  'survey_reasons',
  'categories',
  'words',
];

async function overview(): Promise<void> {
  console.log(`\n${line()}\n테이블별 행 수\n${line()}`);
  sqlNote(
    'SELECT count(*) FROM games;',
    "supabase.from('games').select('*', { count: 'exact', head: true })\n  head:true 는 행은 안 받고 개수만 받는다는 뜻이다",
  );

  for (const t of TABLES) {
    const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true });
    console.log(`  ${t.padEnd(24)} ${error ? `오류: ${error.message}` : String(count ?? 0).padStart(6)}`);
  }
}

// ── 판 목록 ──────────────────────────────────────────────────────────

async function games(): Promise<void> {
  console.log(`\n${line()}\n판 목록 (최근 20개)\n${line()}`);
  sqlNote(
    "SELECT id, category, word, bot_commit_sha, bot_provider, bot_model,\n       bot_detected_count, bot_voter_total, ended_at\nFROM games ORDER BY created_at DESC LIMIT 20;",
    "supabase.from('games').select('...').order('created_at', { ascending: false }).limit(20)",
  );

  const { data, error } = await supabase
    .from('games')
    .select(
      'id, category, word, bot_commit_sha, bot_provider, bot_model, bot_detected_count, bot_voter_total, ended_at, created_at',
    )
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return void console.error('  오류:', error.message);
  if (!data?.length) return void console.log('  (없음)');

  console.log(`  ${'id'.padEnd(5)} ${'주제/제시어'.padEnd(20)} ${'sha'.padEnd(8)} ${'provider'.padEnd(11)} ${'적발'.padEnd(6)} 종료`);
  for (const g of data) {
    const w = `${g.category ?? '?'}/${g.word ?? '?'}`.slice(0, 19);
    const detect =
      g.bot_voter_total ? `${g.bot_detected_count ?? 0}/${g.bot_voter_total}` : '-';
    // id 를 찍어야 `-- game <id>` 를 쓸 수 있다. 안 찍으면 id 를 알아낼 경로가 없다.
    console.log(
      `  ${String(g.id).padEnd(5)} ${w.padEnd(20)} ${short(g.bot_commit_sha).padEnd(8)} ${String(g.bot_provider ?? '-').padEnd(11)} ${detect.padEnd(6)} ${g.ended_at ? 'O' : 'X'}`,
    );
  }
}

// ── 같은 봇끼리 묶기 — 트리거가 쓸 계산 ────────────────────────────────

async function epochs(): Promise<void> {
  console.log(`\n${line()}\n같은 봇끼리 묶어 세기 — 트리거가 하는 계산\n${line()}`);
  console.log('  같은 봇 = (sha, provider, model) 셋이 전부 같다. SHA 만으로는 못 가른다 —');
  console.log('  /x/provider 가 재배포 없이 프로바이더를 바꾸기 때문이다.\n');
  sqlNote(
    'SELECT bot_commit_sha, bot_provider, bot_model, count(*)\nFROM games\nWHERE ended_at IS NOT NULL\nGROUP BY 1, 2, 3;',
    "supabase.from('games').select('bot_commit_sha, bot_provider, bot_model')\n  .not('ended_at', 'is', null)\n  ※ supabase-js 에 GROUP BY 가 없어서 묶는 건 자바스크립트로 한다",
  );

  const { data, error } = await supabase
    .from('games')
    .select('bot_commit_sha, bot_provider, bot_model')
    .not('ended_at', 'is', null);

  if (error) return void console.error('  오류:', error.message);

  const bucket = new Map<string, number>();
  for (const g of data ?? []) {
    const key = `${g.bot_commit_sha ?? 'null'}|${g.bot_provider ?? 'null'}|${g.bot_model ?? 'null'}`;
    bucket.set(key, (bucket.get(key) ?? 0) + 1);
  }

  console.log(`  ${'sha'.padEnd(9)} ${'provider'.padEnd(11)} ${'model'.padEnd(16)} 판수   집계대상`);
  for (const [key, n] of [...bucket].sort((a, b) => b[1] - a[1])) {
    const [sha, prov, model] = key.split('|');
    // sha 가 없으면 로컬 실행이다. 코드가 계속 바뀌는 중이라 어떤 봇이었는지 특정할 수 없고,
    // null 끼리 전부 한 묶음이 되어버려서 트리거 계산에서 뺀다.
    const counts = sha !== 'null';
    console.log(
      `  ${short(sha === 'null' ? null : sha!).padEnd(9)} ${prov!.padEnd(11)} ${model!.slice(0, 15).padEnd(16)} ${String(n).padStart(4)}   ${counts ? 'O' : 'X (로컬)'}`,
    );
  }

  const usable = [...bucket].filter(([k]) => !k.startsWith('null|'));
  const most = usable.reduce((m, [, n]) => Math.max(m, n), 0);
  console.log(`\n  집계 대상 묶음 ${usable.length}개, 가장 큰 묶음 ${most}판`);
  console.log(`  → 5판 문턱 기준: ${most >= 5 ? '찼다' : `아직 ${5 - most}판 부족`}`);
}

// ── 한 판의 발언 전문 ────────────────────────────────────────────────

async function game(id: string | undefined): Promise<void> {
  if (!id) {
    console.error('판 id 가 필요하다.  npm run db -w backend -- game <id>');
    console.error('id 는 `-- games` 로 확인한다.');
    process.exit(1);
  }

  console.log(`\n${line()}\n판 ${id} 의 발언\n${line()}`);
  sqlNote(
    "SELECT runtime_id, speaker_label, speaker_type, role, phase, text\nFROM game_messages WHERE game_id = '<id>' ORDER BY at;",
    "supabase.from('game_messages').select('...').eq('game_id', id).order('at')\n  ※ 이 표의 시각 칼럼은 created_at 이 아니라 at 이다",
  );

  const { data, error } = await supabase
    .from('game_messages')
    .select('runtime_id, speaker_label, speaker_type, role, phase, text')
    .eq('game_id', id)
    .order('at');

  if (error) return void console.error('  오류:', error.message);
  if (!data?.length) return void console.log('  (발언 없음 — id 가 맞는지 확인)');

  for (const m of data) {
    const who = `${m.speaker_label ?? '진행'}${m.speaker_type === 'bot' ? '·봇' : ''}${m.role === 'liar' ? '·라이어' : ''}`;
    console.log(`  [${String(m.phase).padEnd(13)}] ${who.padEnd(12)} ${m.text}`);
  }
  console.log(`\n  runtime_id 는 화면이 들고 있던 id 다. 설문에서 "이 발언이 봇 같았다"로`);
  console.log(`  고른 값이 여기에 맞춰진다(survey_responses.picked_message_runtime_id).`);
}

// ── 설문 ─────────────────────────────────────────────────────────────

async function survey(): Promise<void> {
  console.log(`\n${line()}\n설문 응답 (최근 20건)\n${line()}`);
  sqlNote(
    'SELECT voter_label, guessed_bot_label, guessed_correctly,\n       free_text, picked_message_runtime_id\nFROM survey_responses ORDER BY created_at DESC LIMIT 20;',
    "supabase.from('survey_responses').select('...').order('created_at', { ascending: false }).limit(20)",
  );

  const { data, error } = await supabase
    .from('survey_responses')
    .select('game_id, voter_label, guessed_bot_label, guessed_correctly, free_text, picked_message_runtime_id')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) return void console.error('  오류:', error.message);
  if (!data?.length) return void console.log('  (없음)');

  for (const r of data) {
    // guessed_bot_label 이 null 이면 botVote 20초를 놓친 것이고, false 면 틀린 것이다.
    // 예전에는 놓치면 설문이 통째로 안 남았는데 지금은 구분해서 남는다.
    const guess =
      r.guessed_bot_label === null ? '지목안함' : `${r.guessed_bot_label}${r.guessed_correctly ? '(정답)' : '(오답)'}`;
    console.log(`  ${String(r.voter_label).padEnd(3)} ${guess.padEnd(12)} 고른발언 ${r.picked_message_runtime_id ?? '-'}`);
    if (r.free_text) console.log(`      "${r.free_text}"`);
  }

  const picked = (data ?? []).filter((r) => r.picked_message_runtime_id).length;
  console.log(`\n  발언 지목 ${picked}건 / ${data.length}건`);
  console.log('  이 지목이 replay 사례의 후보가 된다 — "어디서" 를 사람이 알려준 것이다.');
}

// ── 지목된 발언 — ② 가 사례로 만들 후보 ──────────────────────────────

async function picks(): Promise<void> {
  console.log(`\n${line()}\n사람이 "이게 봇 같았다" 고 고른 발언\n${line()}`);
  console.log('  루프 ② 가 사례로 만들 후보다. 판 하나에 발언이 수십 개라 전부 사례로 만들 수는');
  console.log('  없는데, 지목이 "어디서" 를 좁혀준다.\n');
  sqlNote(
    "SELECT r.picked_message_runtime_id, r.voter_label, m.speaker_label, m.phase, m.text\nFROM survey_responses r\nJOIN game_messages m ON m.runtime_id = r.picked_message_runtime_id\nWHERE r.picked_message_runtime_id IS NOT NULL;",
    "지목을 먼저 받고, 그 runtime_id 들로 발언을 한 번 더 받는다\n  supabase-js 는 외래키가 걸린 관계만 자동 JOIN 해준다. 이 둘은 runtime_id 로\n  느슨하게 이어져 있어서 쿼리를 두 번 나눈다",
  );

  const { data: rows, error } = await supabase
    .from('survey_responses')
    .select('game_id, voter_label, picked_message_runtime_id, free_text')
    .not('picked_message_runtime_id', 'is', null);
  if (error) return void console.error('  오류:', error.message);
  if (!rows?.length) return void console.log('  (아직 없음)');

  const ids = [...new Set(rows.map((r) => r.picked_message_runtime_id as string))];
  const { data: msgs } = await supabase
    .from('game_messages')
    .select('runtime_id, game_id, speaker_label, speaker_type, role, phase, text')
    .in('runtime_id', ids);

  const byId = new Map((msgs ?? []).map((m) => [m.runtime_id as string, m]));

  // 같은 발언을 여러 사람이 찍었으면 그만큼 센다. 두 명이 같은 곳을 짚었다면
  // 한 명이 짚은 것보다 사례로서 값이 크다.
  const votes = new Map<string, number>();
  for (const r of rows) {
    const id = r.picked_message_runtime_id as string;
    votes.set(id, (votes.get(id) ?? 0) + 1);
  }

  for (const [id, n] of [...votes].sort((a, b) => b[1] - a[1])) {
    const m = byId.get(id);
    if (!m) {
      console.log(`  ${id}  ← 발언을 못 찾음 (다른 판이거나 지워짐)`);
      continue;
    }
    const who = `${m.speaker_label}${m.speaker_type === 'bot' ? '·봇' : ''}${m.role === 'liar' ? '·라이어' : ''}`;
    console.log(`  ${n}명 지목  [${m.phase}]  ${who}`);
    console.log(`      "${m.text}"`);
    for (const r of rows.filter((x) => x.picked_message_runtime_id === id && x.free_text)) {
      console.log(`      ${r.voter_label}: "${r.free_text}"`);
    }
    console.log('');
  }
}

// ── 문항 세대 ────────────────────────────────────────────────────────

async function questions(): Promise<void> {
  console.log(`\n${line()}\n설문 문항 세대\n${line()}`);
  console.log('  활성은 항상 최대 1개다. DB 쪽 부분 유니크 인덱스가 그걸 보장한다.\n');
  sqlNote(
    'SELECT id, is_active FROM survey_questions ORDER BY id;',
    "supabase.from('survey_questions').select('id, is_active').order('id')",
  );

  const { data: qs, error } = await supabase
    .from('survey_questions')
    .select('id, is_active')
    .order('id');
  if (error) return void console.error('  오류:', error.message);

  for (const q of qs ?? []) {
    console.log(`  질문 #${q.id} ${q.is_active ? '← 활성' : ''}`);
    const { data: rs } = await supabase
      .from('survey_reasons')
      .select('id, text, is_other')
      .eq('question_id', q.id)
      .order('sort_order');
    for (const r of rs ?? []) console.log(`      ${String(r.id).padStart(3)}. ${r.text}${r.is_other ? '  (기타)' : ''}`);
  }
}

// ── 다음 세대 미리보기 ───────────────────────────────────────────────

async function gen(): Promise<void> {
  console.log(`\n${line()}\n다음 세대 문항 INSERT — 미리보기 (실행하지 않는다)\n${line()}`);
  console.log('  루프 ⑤ 가 할 일이다. 사람이 플래그를 켜지 않고 루프가 직접 쓴다.');
  console.log('  활성이 둘이 되면 인덱스가 막으므로, 옛 행 비활성화와 새 행 활성 INSERT 를');
  console.log('  한 덩어리로 처리해야 한다.\n');

  sqlNote(
    "BEGIN;\n  UPDATE survey_questions SET is_active = false WHERE is_active = true;\n  INSERT INTO survey_questions (is_active) VALUES (true) RETURNING id;\n  INSERT INTO survey_reasons (question_id, text, sort_order) VALUES (...);\nCOMMIT;",
    "supabase.from('survey_questions').update({ is_active: false }).eq('is_active', true)\nsupabase.from('survey_questions').insert({ is_active: true }).select('id').single()\nsupabase.from('survey_reasons').insert([...])\n  ※ supabase-js 는 트랜잭션을 못 묶는다. 묶으려면 Postgres 함수(rpc)를 만들어야 한다",
  );

  const { data: active } = await supabase
    .from('survey_questions')
    .select('id')
    .eq('is_active', true)
    .maybeSingle();

  console.log(`  지금 활성 질문: ${active ? `#${active.id}` : '없음'}`);
  console.log('  이 명령은 여기까지만 한다. 실제 쓰기는 /selfrefine 이 맡는다.');
}

// ── 실행 ─────────────────────────────────────────────────────────────

const HELP: Record<string, string> = {
  overview: '테이블별 행 수',
  games: '판 목록 — 어떤 봇이 돌았고 몇 명이 적발했나',
  epochs: '같은 봇끼리 묶어 세기 (트리거가 하는 계산)',
  'game <id>': '그 판의 발언 전문',
  survey: '설문 응답',
  picks: '"이게 봇 같았다" 고 고른 발언 전문',
  questions: '설문 문항 세대 (is_active)',
  gen: '다음 세대 문항 INSERT 미리보기 — 실행하지 않는다',
};

async function main(): Promise<void> {
  const [cmd = 'overview', arg] = process.argv.slice(2);

  const table: Record<string, () => Promise<void>> = {
    overview,
    games,
    epochs,
    game: () => game(arg),
    survey,
    picks,
    questions,
    gen,
  };

  if (cmd === 'help' || cmd === '--help' || cmd === '-h') {
    console.log('\n  npm run db -w backend -- <명령>\n');
    for (const [name, what] of Object.entries(HELP)) {
      console.log(`    ${name.padEnd(10)} ${what}`);
    }
    console.log('\n  전부 읽기만 한다. gen 도 미리보기라 쓰지 않는다.');
    console.log('  필요한 환경변수: SUPABASE_URL · SUPABASE_SERVICE_ROLE_KEY\n');
    return;
  }

  const run = table[cmd];
  if (!run) {
    console.error(`알 수 없는 명령: "${cmd}"`);
    console.error(`  가능한 값: ${Object.keys(table).join(', ')}, help`);
    process.exit(1);
  }

  await run();
  console.log('');
}

main().catch((e) => {
  console.error('\n실패:', e instanceof Error ? e.message : e);
  console.error('\n확인할 것:');
  console.error('  1. apps/backend/.env 에 SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 있는가');
  console.error('  2. 그 키가 이 프로젝트의 것인가');
  process.exit(1);
});
