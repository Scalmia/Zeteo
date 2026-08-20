import { supabase } from './db/supabase';
import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import { pickRandomCategoryAndWord } from './db/content';
import { startGame } from './db/game';
import { logMessage, logVote } from './db/log';
import { sendLogToDiscord } from './db/webhook';  
import { finalizeGame } from './db/game';
import { submitSurveyResponse, fetchSurveyResponsesForGame, SurveyResponseRow } from './db/survey';
import path from 'path';
import fs from 'fs';
import { ClientEvent, ServerEvent, Phase, BotContext } from '@zeteo/shared-types';
import {
  createRoom,
  getRoom,
  joinRoom,
  markReady,
  unmarkReady,
  isEveryoneReady,
  assignRoles,
  assignLabels,
  removePlayerFromLobby,
  deleteRoom,
  RoomInternalState,
} from './room';
import { buildGameStateFor } from './view';
import { setPhaseTimer, clearPhaseTimer } from './timer';
import { nextPhase } from './stateMachine';
import { decideBotAction } from './bot';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } }); // 개발 중엔 전체 허용, 나중에 좁힘

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// socket.id → { roomId, playerId } 매핑
const socketMeta = new Map<string, { roomId: string; playerId: string }>();

// phase별 제한시간. TODO: Day 0에 팀이 정하기로 한 실제 값으로 교체 필요, 지금은 테스트용 임시값
// describe는 B-7(나)로 전환하면서 턴별 타이머로 분리됨 → 아래 DESCRIBE_TURN_DURATION 참고
const PHASE_DURATIONS: Partial<Record<Phase, number>> = {
  roleReveal: 10000,
  debate: 120000,
  finalDefense: 60000,
  lifeVote: 30000,
  reveal: 10000,
  guessWord: 40000,
  botVote: 20000,
};
// describe 턴 하나당 제한시간. LLM 응답 6~13초 + 사람 타이핑 여유를 감안한 상한.
// 20~25초 사이에서 우선 20초로 잡음 — 필요하면 이 값만 조정하면 됨.
const DESCRIBE_TURN_DURATION = 20000;
// 현재 phase에 맞는 타이머를 건다 + 봇 차례인지 체크
function enterPhase(room: RoomInternalState) {
  if (room.phase === 'describe') {
    if (isDescribeComplete(room)) {
      // 정상 흐름에서는 발생하지 않지만(턴 0명 등) 방어적으로 처리
      advancePhase(room);
      return;
    }
    startDescribeTurnTimer(room);
    return;
  }

  const duration = PHASE_DURATIONS[room.phase];
  if (duration) {
    setPhaseTimer(room, duration, () => {
      if (room.phase === 'guessWord' && room.pendingLiarGameResult === null) {
        room.pendingLiarGameResult = 'citizenWin'; // 시간 초과 = 추측 실패
        room.liarGameResult = room.pendingLiarGameResult;
      }
      advancePhase(room);
    });
  } else {
    // 타이머 없는 phase(lobby, result 등) 진입 시, clearPhaseTimer는 deadlineAt을
    // 안 지워주므로 직전 phase/턴의 deadline이 잔상으로 남는 걸 막아준다.
    room.deadlineAt = null;
  }
  void maybeTriggerBot(room);
}

// 팀 피드백: 게임이 끝난 시점(result 진입)에 전체 대화 로그를 터미널에 띄워달라는 요청.
// 친구들과 테스트할 때나 나중에 대화 흐름을 복기할 때 유용하도록,
// (1) 서버 콘솔에 한 번에(증분 아님) 출력하고 (2) apps/backend/logs/ 에 md 형식으로도 남긴다.
// isBot/role은 클라이언트로는 절대 안 나가지만, 이건 서버 터미널/로컬 파일 전용이라
// 팀이 직접 복기할 때 누가 봇이었는지 바로 보이도록 표시해준다.
const LOG_DIR = path.join(__dirname, '../logs');

function describePlayer(room: RoomInternalState, id: string): string {
  if (id === 'system') return '[시스템]';
  const p = room.players.find((pl) => pl.id === id);
  if (!p) return id;
  return `${p.name}(${p.label}${p.isBot ? ' · 봇' : ''}${p.role === 'liar' ? ' · 라이어' : ''})`;
}

// 설문 응답(surveyRows)은 result 진입 시점엔 아직 없을 수 있어서 매개변수로 받는다.
// 로컬 로그(logTranscript)는 빈 배열로, 최종 디스코드 전송(sendFinalReportToDiscord)은
// Supabase에서 실제로 모아온 값으로 이 함수를 각각 호출한다.
function buildTranscriptMarkdown(room: RoomInternalState, surveyRows: SurveyResponseRow[]): string {
  const bot = room.players.find((p) => p.isBot);
  const liar = room.players.find((p) => p.role === 'liar');

  const summaryLines = [
    `# [${room.roomId}] 대화 로그`,
    '',
    `- 주제: ${room.category} / 제시어: ${room.word}`,
    `- 봇: ${bot ? describePlayer(room, bot.id) : '?'}`,
    `- 라이어: ${liar ? describePlayer(room, liar.id) : '?'}`,
    `- 라이어의 답: ${room.guessWord ?? '미제출'}`,
    `- 결과: ${room.liarGameResult ?? '미확정'}`,
    `- 총 라운드: ${room.round}`,
    '',
  ];

  const botVoteLines = [
    '## 봇 지목',
    '',
    '| 투표자 | 지목 | 적중 |',
    '|---|---|---|',
    ...Object.entries(room.botVotes).map(([voterId, targetId]) => {
      const targetLabel = room.players.find((p) => p.id === targetId)?.label ?? targetId;
      const hit = room.players.find((p) => p.id === targetId)?.isBot ? 'O' : 'X';
      return `| ${describePlayer(room, voterId)} | ${targetLabel} | ${hit} |`;
    }),
    '',
  ];

  const surveyLines = [
    '## 설문 응답',
    '',
    '| 응답자 | 선택한 이유(id) | 자유 서술 |',
    '|---|---|---|',
    ...surveyRows.map(
      (r) => `| ${r.voterLabel} | ${r.reasonIds.join(', ') || '-'} | ${r.freeText ?? '-'} |`,
    ),
    '',
  ];

  const chatLines = [
    '## 대화 로그',
    '',
    '| 시간 | 단계 | 발언자 | 내용 |',
    '|---|---|---|---|',
    ...room.messages.map((m) => {
      const time = new Date(m.at).toLocaleTimeString('ko-KR', { hour12: false });
      return `| ${time} | ${m.phase} | ${describePlayer(room, m.speakerId)} | ${m.text.replace(/\|/g, '\\|')} |`;
    }),
  ];

  return [...summaryLines, ...botVoteLines, ...surveyLines, ...chatLines].join('\n');
}

// result 진입 즉시 남기는 로컬 백업/콘솔용. 이 시점엔 설문이 아직 없으니 빈 배열로 만든다.
function logTranscript(room: RoomInternalState) {
  const plainLines = room.messages.map((m) => {
    const time = new Date(m.at).toLocaleTimeString('ko-KR', { hour12: false });
    return `[${time}] (${m.phase}) ${describePlayer(room, m.speakerId)}: ${m.text}`;
  });

  console.log(`\n===== [${room.roomId}] 대화 로그 (총 ${plainLines.length}건) =====`);
  for (const line of plainLines) console.log(line);
  console.log(`===== [${room.roomId}] 로그 끝 =====\n`);

  try {
    fs.mkdirSync(LOG_DIR, { recursive: true });
    const stamp = new Date().toISOString().replace(/[:.]/g, '-');
    const base = path.join(LOG_DIR, `${room.roomId}_${stamp}`);
    fs.writeFileSync(`${base}.md`, buildTranscriptMarkdown(room, []) + '\n', 'utf-8');
    console.log(`[${room.roomId}] 대화 로그 파일 저장: ${base}.md`);
  } catch (e) {
    console.error(`[${room.roomId}] 대화 로그 파일 저장 실패:`, e);
  }
}

// 방이 완전히 빌 때(마지막 인원이 설문까지 마치거나 나갈 때) 호출한다.
// 그때쯤이면 제출된 설문 응답이 Supabase에 쌓여있으니, 그걸 합쳐서 최종본을 디스코드로 보낸다.
async function sendFinalReportToDiscord(room: RoomInternalState) {
  if (!room.dbGameId) return;
  const surveyRows = await fetchSurveyResponsesForGame(room.dbGameId);
  void sendLogToDiscord(room, buildTranscriptMarkdown(room, surveyRows));
}

// "봇 뺀 사람 전원이 끝났는가"(제출했거나 제출 없이 나갔거나)를 판단하는 지점이 두 곳이다 —
// case 'survey'(누군가 제출할 때)와 disconnect(제출 없이 나갈 때). 마지막 한 명이 제출 없이
// 나가는 경우는 그 뒤로 아무도 case 'survey'를 다시 안 타서, disconnect 쪽에서도 이 판정을
// 다시 해줘야 방이 좀비로 안 남는다. 두 경로가 같은 로직을 쓰게 여기 하나로 모은다.
async function finalizeSurveyIfDone(room: RoomInternalState) {
  const humans = room.players.filter((p) => !p.isBot);
  const allDone = humans.every(
    (p) => room.submittedSurveyIds.has(p.id) || room.abandonedSurveyIds.has(p.id),
  );
  if (!allDone) return;
  // room.players 명단이 아직 온전할 때(먼저 낸 사람도 안 지워진 상태) 리포트부터 만든다.
  await sendFinalReportToDiscord(room);
  deleteRoom(room.roomId);
}

// stateMachine으로 다음 phase 계산 → 필요한 부수효과 처리 → 다음 타이머 설정 → 브로드캐스트
function advancePhase(room: RoomInternalState) {
  nextPhase(room);

  if (room.phase === 'result') {
    logTranscript(room);
    void finalizeGame(room);
    room.readyIds.clear();
  }

  enterPhase(room);
  broadcastRoom(room.roomId);
}

// describe 턴 하나 시작: 그 턴 전용 타이머를 걸고 봇 차례인지 체크
function startDescribeTurnTimer(room: RoomInternalState) {
  setPhaseTimer(room, DESCRIBE_TURN_DURATION, () => skipDescribeTurn(room));
  void maybeTriggerBot(room);
}

// describe 턴 하나가 끝났을 때(발화/침묵/타임아웃 공용) 다음 턴으로 넘기거나 phase를 마감
function advanceDescribeTurn(room: RoomInternalState) {
  clearPhaseTimer(room.roomId);
  if (isDescribeComplete(room)) {
    advancePhase(room); // describe 종료 → 다음 phase. broadcast는 advancePhase 안에서 처리됨
    return;
  }
  startDescribeTurnTimer(room);
  broadcastRoom(room.roomId);
}

// describe 턴 제한시간 초과: 그 사람 묘사는 건너뛰고 다음 턴으로
// (룰북상 묘사는 한 바퀴 도는 것 — 놓친 사람은 정보를 안 준 셈이 되고 그게 의심 근거가 됨)
function skipDescribeTurn(room: RoomInternalState) {
  room.currentTurnIndex += 1;
  advanceDescribeTurn(room);
}

// 생사투표 도중, 아직 투표 안 한 사람이 남아있어도 결과가 이미 확정된 경우를 판정.
// (kill이 남은 인원 전부 spare로 던져도 못 뒤집을 만큼 앞섰거나, 반대로 spare가
// 남은 인원 전부 kill로 던져도 방어되는 경우) 이럴 땐 전원 투표를 기다리지 않는다.
function isLifeVoteDecided(room: RoomInternalState): boolean {
  const alive = room.players.filter((p) => p.isAlive && p.id !== room.accusedId);  let kill = 0;
  let spare = 0;
  for (const p of alive) {
    const v = room.lifeVotes[p.id];
    if (v === undefined) continue;
    if (v) kill++;
    else spare++;
  }
  const remaining = alive.length - (kill + spare);
  return kill > spare + remaining || spare >= kill + remaining;
}

// debate/lifeVote/botVote에서 전원 투표했는지 판정 (사람 케이스 + 봇 케이스 공용)
function isVotingComplete(room: RoomInternalState): boolean {
  const alive = room.players.filter((p) => p.isAlive);
  if (room.phase === 'debate') return alive.every((p) => room.votes[p.id] !== undefined);
  if (room.phase === 'lifeVote') {
    const eligible = alive.filter((p) => p.id !== room.accusedId);
    return eligible.every((p) => room.lifeVotes[p.id] !== undefined);
  }
  if (room.phase === 'botVote') {
    const humans = room.players.filter((p) => !p.isBot); // 봇 제외, 죽은 사람도 포함
    return humans.every((p) => room.botVotes[p.id] !== undefined);
  }
  return false;
}

function recordSpeak(room: RoomInternalState, playerId: string, text: string) {
  const player = room.players.find((p) => p.id === playerId);
  room.messages.push({
    id: `m${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    speakerId: playerId,
    text,
    phase: room.phase,
    at: Date.now(),
  });
  room.currentTurnIndex += 1;
  if (player) void logMessage(room, player.label, player.isBot ? 'bot' : 'human', player.role, text);
}

function isDescribeComplete(room: RoomInternalState): boolean {
  return room.currentTurnIndex >= room.turnOrder.length;
}

// 응답을 기다리는 사이에 phase나(describe라면) turn이 이미 넘어갔는지 확인.
// 턴제 타이머로 바뀌면서 phase만 검사하는 걸로는 "타임아웃으로 다음 턴 넘어간 뒤
// 늦게 도착한 봇 응답이 남의 턴에 끼어드는" 케이스를 못 걸러서 turn까지 같이 본다.
function isStaleBotAction(
  room: RoomInternalState,
  phaseWhenAsked: Phase,
  turnWhenAsked: number,
): boolean {
  if (room.phase !== phaseWhenAsked) return true;
  if (room.phase === 'describe' && room.currentTurnIndex !== turnWhenAsked) return true;
  return false;
}

// 봇 차례 처리 (테스트용 decideBotAction 호출)
async function maybeTriggerBot(room: RoomInternalState) {
  const bot = room.players.find((p) => p.isBot && p.isAlive);
  if (!bot) return;

  if (room.phase === 'describe') {
    if (room.currentTurnIndex >= room.turnOrder.length) return;
    if (room.turnOrder[room.currentTurnIndex] !== bot.id) return;
  } else if (room.phase === 'debate') {
    // 투표를 이미 했어도 토론 채팅에는 계속 참여할 수 있어야 한다
  } else if (room.phase === 'finalDefense') {
    // 피고인이 아니어도 질의 형태로 자유 채팅에 참여할 수 있어야 한다
  } else if (room.phase === 'lifeVote') {
    if (bot.id === room.accusedId) return;
    if (room.lifeVotes[bot.id] !== undefined) return;
  } else if (room.phase === 'guessWord') {
    if (bot.id !== room.accusedId) return;
  } else {
    return;
  }

  const voteCounts: Record<string, number> = {};
  for (const targetId of Object.values(room.votes)) {
    if (!targetId) continue;
    voteCounts[targetId] = (voteCounts[targetId] ?? 0) + 1;
  }

  const phaseWhenAsked = room.phase;
  const turnWhenAsked = room.currentTurnIndex;
  const ctx: BotContext = {
    phase: room.phase,
    myRole: bot.role,
    category: room.category,
    word: bot.role === 'liar' ? null : room.word,
    selfId: bot.id,
    players: room.players.map((p) => ({ id: p.id, label: p.label, isAlive: p.isAlive, isReady: room.readyIds.has(p.id) })),
    transcript: room.messages,
    voteCounts,
    accusedId: room.accusedId,
    myVote: room.votes[bot.id] ?? null,
  };

  // B-6: decideBotAction 호출 실패(LLM API 에러 등) 시 unhandled rejection으로
  // 서버 프로세스가 죽는 걸 막는다. 실패하면 이번 트리거는 조용히 포기하고
  // 이후 진행은 phase/턴 타이머가 만료될 때 이어진다.
  let action: Awaited<ReturnType<typeof decideBotAction>>;
  try {
    action = await decideBotAction(ctx);
  } catch (e) {
    console.error(`[${room.roomId}] decideBotAction 실패 (phase=${phaseWhenAsked}, bot=${bot.id}):`, e);
    return;
  }
  if (isStaleBotAction(room, phaseWhenAsked, turnWhenAsked)) return;

  if ('delayMs' in action) {
    await new Promise((resolve) => setTimeout(resolve, action.delayMs));
    if (isStaleBotAction(room, phaseWhenAsked, turnWhenAsked)) return;
  }
  if (action.t === 'describe') {
    recordSpeak(room, bot.id, action.text);
    advanceDescribeTurn(room);
    return;
  }

  if (action.t === 'silent') {
    if (room.phase === 'describe') {
      room.currentTurnIndex += 1;
      advanceDescribeTurn(room);
      return;
    }
    broadcastRoom(room.roomId);
    void maybeTriggerBot(room);
    return;
  }
  if (action.t === 'chat') {
    room.messages.push({
      id: `m${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      speakerId: bot.id,
      text: action.text,
      phase: room.phase,
      at: Date.now(),
    });
    void logMessage(room, bot.label, 'bot', bot.role, action.text);
    broadcastRoom(room.roomId);
    void maybeTriggerBot(room);
    return;
  }
  if (action.t === 'vote') {
    room.votes[bot.id] = action.targetId;
    if (action.targetId) {
      const target = room.players.find((p) => p.id === action.targetId);
      if (target) void logVote(room, 'liar_vote', bot.label, target.label);
    }
  }
  if (action.t === 'lifeVote') {
    room.lifeVotes[bot.id] = action.kill;
    const accused = room.players.find((p) => p.id === room.accusedId);
    if (accused) {
      void logVote(room, 'life_vote', bot.label, action.kill ? accused.label : bot.label);
    }
  }
  if (action.t === 'guessWord') {
    const correct = action.word.trim() === room.word.trim();
    room.guessWord = action.word.trim();
    room.pendingLiarGameResult = correct ? 'liarWin' : 'citizenWin';
    clearPhaseTimer(room.roomId);
    advancePhase(room);
    return;
  }

  // debate는 의도적으로 제외한다 — 사람 쪽 case 'vote'도 마지막 한 표가 들어와도 조기
  // 종료하지 않고 타이머가 다 될 때까지 토론을 이어가게 만들어져 있다. 여기서 봇 케이스만
  // 예외 없이 조기종료시키면, 마지막 표를 봇이 던졌는지 사람이 던졌는지에 따라 같은
  // 상황(전원 투표 완료)이 다르게 처리되는 비대칭이 생긴다.
  if (room.phase !== 'debate' && isVotingComplete(room)) {
    clearPhaseTimer(room.roomId);
    advancePhase(room);
    return;
  }
  broadcastRoom(room.roomId);
  void maybeTriggerBot(room);
}

// 이름은 broadcast지만 방 전체에 같은 값 하나를 뿌리지 않는다 — buildGameStateFor가
// playerId별로 다른 GameState를 만든다(라이어에겐 word를 숨기고, myVote/myId도
// 사람마다 다르다). 그래서 소켓 하나하나를 돌며 각자에게 맞는 state를 따로 계산해 보낸다.
async function broadcastRoom(roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;

  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  if (!socketsInRoom) return;

  for (const socketId of socketsInRoom) {
    const meta = socketMeta.get(socketId);
    if (!meta) continue;
    const event: ServerEvent = { t: 'state', state: await buildGameStateFor(room, meta.playerId) };
    io.to(socketId).emit('event', event);
  }
}

io.on('connection', (socket) => {
  console.log('connected:', socket.id);

  socket.on('action', async (action: ClientEvent) => {
    try {
      switch (action.t) {
        case 'join': {
          let room = getRoom(action.roomId);
          if (!room) {
            room = createRoom(action.roomId);
            // 테스트용: 방 새로 만들어질 때 봇 1명 자동 참가 + 자동 ready
            const bot = joinRoom(action.roomId, 'Zeteo', true);
            markReady(room, bot.id);
          }
          const player = joinRoom(action.roomId, action.name);
          socketMeta.set(socket.id, { roomId: action.roomId, playerId: player.id });
          socket.join(action.roomId);
          break;
        }
        case 'chat': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          const player = room.players.find((p) => p.id === meta.playerId);
          room.messages.push({
            id: `m${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            speakerId: meta.playerId,
            text: action.text,
            phase: room.phase,
            at: Date.now(),
          });
          if (player) void logMessage(room, player.label, player.isBot ? 'bot' : 'human', player.role, action.text);
          break;
        }
        case 'describe': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          if (room.phase !== 'describe') throw new Error('지금은 묘사 단계가 아닙니다');

          const currentTurnId = room.turnOrder[room.currentTurnIndex];
          if (meta.playerId !== currentTurnId) throw new Error('지금은 당신 차례가 아닙니다');

          recordSpeak(room, meta.playerId, action.text);
          advanceDescribeTurn(room);
          return;
        }
        case 'ready': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          if (room.phase === 'result') {
            room.surveyedIds.add(meta.playerId); // 이 사람만 개인적으로 survey로 이동
            break;           
          }

          if (room.readyIds.has(meta.playerId)) {
            unmarkReady(room, meta.playerId);
          } else {
            markReady(room, meta.playerId);
          }

          if (room.phase === 'lobby' && isEveryoneReady(room)) {
            assignRoles(room);
            assignLabels(room);
            // roleReveal 시작 시점에 describe 발언 순서(turnOrder)를 미리 정해두고,
            // 참가자 목록(room.players)도 아래 sort로 바로 그 순서에 맞춰 재배열한다 —
            // describe 화면까지 갈 필요 없이 roleReveal부터 이미 익명화된 순서로 보이게
            // 하기 위함이다. VotePanel/BotVote 등도 room.players 순서를 그대로 쓰므로,
            // 여기서 안 섞으면 로비 때 입장 순서(=봇이 항상 먼저 join)가 그대로 노출된다.
            const ids = room.players.map((p) => p.id);
            for (let i = ids.length - 1; i > 0; i--) {
              const j = Math.floor(Math.random() * (i + 1));
              [ids[i], ids[j]] = [ids[j]!, ids[i]!];
            }
            room.turnOrder = ids;
            room.currentTurnIndex = 0;
            const order = new Map(ids.map((id, i) => [id, i]));
            room.players.sort((a, b) => (order.get(a.id) ?? 0) - (order.get(b.id) ?? 0));
            const { category, word } = await pickRandomCategoryAndWord();
            room.category = category;
            room.word = word;

            try {
              room.dbGameId = await startGame(room.roomId, category, word, room.players);
            } catch (e) {
              console.error(`[${room.roomId}] 게임 기록 생성 실패:`, e);
            }

            room.phase = 'roleReveal';
            enterPhase(room);
          }
          break;
        }
        case 'vote': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          if (room.phase !== 'debate') throw new Error('지금은 투표 단계가 아닙니다');
          if (action.targetId && !room.players.some((p) => p.id === action.targetId)) {
            throw new Error('존재하지 않는 대상입니다');
          }

          room.votes[meta.playerId] = action.targetId;

          if (action.targetId) {
            const voter = room.players.find((p) => p.id === meta.playerId)!;
            const target = room.players.find((p) => p.id === action.targetId)!;
            void logVote(room, 'liar_vote', voter.label, target.label);
          }

          break;
        }
        case 'lifeVote': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          if (room.phase !== 'lifeVote') throw new Error('지금은 생사 투표 단계가 아닙니다');
          if (meta.playerId === room.accusedId) {
            throw new Error('본인에 대한 생사 투표에는 참여할 수 없습니다');
          }
          if (room.lifeVotes[meta.playerId] !== undefined) {
            throw new Error('이미 투표했습니다');
          }
          room.lifeVotes[meta.playerId] = action.kill;

          const voter = room.players.find((p) => p.id === meta.playerId)!;
          const accused = room.players.find((p) => p.id === room.accusedId);
          if (accused) {
            void logVote(room, 'life_vote', voter.label, action.kill ? accused.label : voter.label);
          }

          if (isVotingComplete(room)) {
            clearPhaseTimer(room.roomId);
            advancePhase(room);
            return;
          }
          if (!room.lifeVoteDecided && isLifeVoteDecided(room)) {
            // 결과가 수학적으로 확정된 순간 바로 넘기면 화면이 갑자기 전환돼서 "어?" 하고
            // 당황하게 된다. 3초를 줘서 지금 투표 현황이 어떻게 됐길래 넘어가는지 파악할
            // 시간을 준다.
            room.lifeVoteDecided = true;
            setPhaseTimer(room, 3000, () => advancePhase(room));
            break;
          }
          break;
        }
        case 'guessWord': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          if (room.phase !== 'guessWord') throw new Error('지금은 제시어 추측 단계가 아닙니다');
          if (meta.playerId !== room.accusedId)
            throw new Error('라이어만 제시어를 추측할 수 있습니다');
          clearPhaseTimer(room.roomId);
          const correct = action.word.trim() === room.word.trim();
          room.guessWord = action.word.trim(); 
          room.pendingLiarGameResult = correct ? 'liarWin' : 'citizenWin';
          room.liarGameResult = room.pendingLiarGameResult; // 제출 즉시 공개
          advancePhase(room);
          return;
        }

        case 'botVote': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          if (room.phase !== 'botVote') throw new Error('지금은 봇 지목 단계가 아닙니다');

          room.botVotes[meta.playerId] = action.targetId;

          if (isVotingComplete(room)) {
            clearPhaseTimer(room.roomId);
            advancePhase(room);
            return;
          }
          break;
        }

        case 'survey': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          if (!room.surveyedIds.has(meta.playerId)) throw new Error('지금은 설문 단계가 아닙니다');
          await submitSurveyResponse(room, meta.playerId, action.reasonIds, action.freeText);
          room.submittedSurveyIds.add(meta.playerId);

          socketMeta.delete(socket.id);
          socket.leave(meta.roomId);

          await finalizeSurveyIfDone(room);
          return; // 게임 상태에 영향 없으니 broadcast 불필요
          }
          default:
            console.log('아직 처리 안 하는 액션:', action);
            return;
        }

      const meta = socketMeta.get(socket.id);
      if (meta) broadcastRoom(meta.roomId);
    } catch (e) {
      const event: ServerEvent = { t: 'error', reason: String(e) };
      socket.emit('event', event);
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnected:', socket.id);
    const meta = socketMeta.get(socket.id);
    socketMeta.delete(socket.id);

    if (!meta) return;
    const room = getRoom(meta.roomId);
    if (!room) return;

    if (room.phase === 'lobby') {
      removePlayerFromLobby(meta.roomId, meta.playerId);
      broadcastRoom(meta.roomId); // 남은 사람들한테 갱신된 인원 알려줌 (방이 삭제됐으면 자동으로 no-op)
      return;
    }

   if (room.surveyedIds.has(meta.playerId) && !room.submittedSurveyIds.has(meta.playerId)) {
      // 설문 화면까지 왔다가 제출 전에 나간 경우. room.players에서는 안 지운다 —
      // 최종 리포트가 이 사람의 과거 발언을 이름으로 못 찾으면 raw id로 깨져 나온다.
      // 대신 abandonedSurveyIds에 기록하고, 이 사람이 마지막 한 명이었을 수도 있으니
      // finalizeSurveyIfDone으로 다시 판정한다 — 여기서 안 하면, case 'survey'는
      // 이미 나간 사람에 대해선 다시 안 불리므로 아무도 이 방을 못 끝낸다.
      room.abandonedSurveyIds.add(meta.playerId);
      void finalizeSurveyIfDone(room);
    }
    // 그 외(게임 진행 중)엔 기획서 원칙대로 그대로 둠 — 중도 탈락 없음
  });
});

// 그 외 모든 GET 요청은 index.html로 (React Router 쓸 때도 대응)
app.get('/*splat', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// 중요: Railway는 PORT를 환경변수로 주입합니다. 하드코딩하면 배포가 실패해요.
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on ${PORT}`));