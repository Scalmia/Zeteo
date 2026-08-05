import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { ClientEvent, ServerEvent, Phase, BotContext } from '@zeteo/shared-types';
import {
  createRoom,
  getRoom,
  joinRoom,
  markReady,
  isEveryoneReady,
  assignRoles,
  removePlayerFromLobby,
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
const PHASE_DURATIONS: Partial<Record<Phase, number>> = {
  roleReveal: 5000,
  describe: 5000, // TODO: 실제 값 확정 필요 (1인당 1회씩, 시간은 팀 협의)
  debate: 60000,
  finalDefense: 5000,
  lifeVote: 60000,
  reveal: 3000,
  guessWord: 15000,
  botVote: 30000,
};

// 현재 phase에 맞는 타이머를 건다 + 봇 차례인지 체크
function enterPhase(room: RoomInternalState) {
  const duration = PHASE_DURATIONS[room.phase];
  if (duration) {
    setPhaseTimer(room, duration, () => {
      if (room.phase === 'guessWord' && room.pendingLiarGameResult === null) {
        room.pendingLiarGameResult = 'citizenWin'; // 시간 초과 = 추측 실패
      }
      advancePhase(room);
    });
  }
  void maybeTriggerBot(room);
}

// stateMachine으로 다음 phase 계산 → 필요한 부수효과 처리 → 다음 타이머 설정 → 브로드캐스트
function advancePhase(room: RoomInternalState) {
  nextPhase(room);

  if (room.phase === 'describe') {
    room.turnOrder = room.players.map((p) => p.id);
    room.currentTurnIndex = 0;
  }

  enterPhase(room);
  broadcastRoom(room.roomId);
}

// debate/lifeVote/botVote에서 전원 투표했는지 판정 (사람 케이스 + 봇 케이스 공용)
function isVotingComplete(room: RoomInternalState): boolean {
  const alive = room.players.filter((p) => p.isAlive);
  if (room.phase === 'debate') return alive.every((p) => room.votes[p.id] !== undefined);
  if (room.phase === 'lifeVote') return alive.every((p) => room.lifeVotes[p.id] !== undefined);
  if (room.phase === 'botVote') {
    const humans = room.players.filter((p) => !p.isBot); // 봇 제외, 죽은 사람도 포함
    return humans.every((p) => room.botVotes[p.id] !== undefined);
  }
  return false;
}

function recordSpeak(room: RoomInternalState, playerId: string, text: string) {
  room.messages.push({
    id: `m${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    speakerId: playerId,
    text,
    phase: room.phase,
    at: Date.now(),
  });
  room.currentTurnIndex += 1;
}

function isDescribeComplete(room: RoomInternalState): boolean {
  return room.currentTurnIndex >= room.turnOrder.length;
}

// 봇 차례 처리 (테스트용 decideBotAction 호출)
async function maybeTriggerBot(room: RoomInternalState) {
  const bot = room.players.find((p) => p.isBot && p.isAlive);
  if (!bot) return;

  if (room.phase === 'describe') {
    if (room.currentTurnIndex >= room.turnOrder.length) return;
    if (room.turnOrder[room.currentTurnIndex] !== bot.id) return;
  } else if (room.phase === 'debate') {
    if (room.votes[bot.id] !== undefined) return;
  } else if (room.phase === 'lifeVote') {
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

  const action = await decideBotAction(ctx);
  if (room.phase !== phaseWhenAsked) return; // 응답 오는 사이 phase 바뀌었으면 무시

  if (action.t === 'describe') {
    recordSpeak(room, bot.id, action.text);
    if (isDescribeComplete(room)) {
      clearPhaseTimer(room.roomId);
      advancePhase(room);
      return;
    }
    broadcastRoom(room.roomId);
    void maybeTriggerBot(room);
    return;
  }

  if (action.t === 'silent') {
    room.currentTurnIndex += 1;
    if (isDescribeComplete(room)) {
      clearPhaseTimer(room.roomId);
      advancePhase(room);
      return;
    }
    broadcastRoom(room.roomId);
    void maybeTriggerBot(room);
    return;
  }

  if (action.t === 'vote') room.votes[bot.id] = action.targetId;
  if (action.t === 'lifeVote') room.lifeVotes[bot.id] = action.kill;
  if (action.t === 'guessWord') {
    const correct = action.word.trim() === room.word.trim();
    room.pendingLiarGameResult = correct ? 'liarWin' : 'citizenWin';
    clearPhaseTimer(room.roomId);
    advancePhase(room);
    return;
  }

  if (isVotingComplete(room)) {
    clearPhaseTimer(room.roomId);
    advancePhase(room);
    return;
  }

  broadcastRoom(room.roomId);
}

function broadcastRoom(roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;

  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  if (!socketsInRoom) return;
  for (const socketId of socketsInRoom ?? []) {
    const meta = socketMeta.get(socketId);
    if (!meta) continue;
    const event: ServerEvent = { t: 'state', state: buildGameStateFor(room, meta.playerId) };
    io.to(socketId).emit('event', event);
  }
}

io.on('connection', (socket) => {
  console.log('connected:', socket.id);

  socket.on('action', (action: ClientEvent) => {
    try {
      switch (action.t) {
        case 'join': {
          let room = getRoom(action.roomId);
          if (!room) {
            room = createRoom(action.roomId);
            // 테스트용: 방 새로 만들어질 때 봇 1명 자동 참가 + 자동 ready
            const bot = joinRoom(action.roomId, '테스트봇', true);
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
          room.messages.push({
            id: `m${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
            speakerId: meta.playerId,
            text: action.text,
            phase: room.phase,
            at: Date.now(),
          });
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

          if (isDescribeComplete(room)) {
            clearPhaseTimer(room.roomId);
            advancePhase(room);
            return;
          }

          void maybeTriggerBot(room);
          break;
        }
        case 'ready': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');

          markReady(room, meta.playerId);

          const MIN_PLAYERS_TO_START = 5; // 봇 포함 5명 (기획서 기준)
          if (
            room.phase === 'lobby' &&
            room.players.length >= MIN_PLAYERS_TO_START &&
            isEveryoneReady(room)
          ) {
            assignRoles(room);
            // TODO: 실제 주제 데이터셋 붙기 전까지 테스트용 하드코딩
            room.category = '동물';
            room.word = '코끼리';
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

          room.votes[meta.playerId] = action.targetId;

          if (isVotingComplete(room)) {
            clearPhaseTimer(room.roomId);
            advancePhase(room);
            return;
          }
          break;
        }
        case 'lifeVote': {
          const meta = socketMeta.get(socket.id);
          if (!meta) throw new Error('아직 방에 입장하지 않았습니다');
          const room = getRoom(meta.roomId);
          if (!room) throw new Error('room not found');
          if (room.phase !== 'lifeVote') throw new Error('지금은 생사 투표 단계가 아닙니다');

          room.lifeVotes[meta.playerId] = action.kill;

          if (isVotingComplete(room)) {
            clearPhaseTimer(room.roomId);
            advancePhase(room);
            return;
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
          room.pendingLiarGameResult = correct ? 'liarWin' : 'citizenWin';
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
          if (room.phase !== 'result') throw new Error('지금은 설문 단계가 아닙니다');

          // TODO: DB 붙이면 여기서 실제 저장 (박진님 기능). 지금은 받기만 하고 버림.
          console.log(
            `[${room.roomId}] 설문 수신 (${meta.playerId}):`,
            action.reasonIds,
            action.freeText,
          );
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
    }
    // 게임 시작 후("lobby" 아님)엔 기획서 원칙대로 그대로 둠 — 중도 탈락 없음
  });
});

// 그 외 모든 GET 요청은 index.html로 (React Router 쓸 때도 대응)
app.get('/*splat', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// 중요: Railway는 PORT를 환경변수로 주입합니다. 하드코딩하면 배포가 실패해요.
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on ${PORT}`));
