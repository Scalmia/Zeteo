import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import path from 'path';
import { ClientEvent } from '@zeteo/shared-types';
import { createRoom, getRoom, joinRoom } from './room';
import { buildGameStateFor } from './view';

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: '*' } }); // 개발 중엔 전체 허용, 나중에 좁힘

app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// socket.id → { roomId, playerId } 매핑
const socketMeta = new Map<string, { roomId: string; playerId: string }>();

function broadcastRoom(roomId: string) {
  const room = getRoom(roomId);
  if (!room) return;
  const socketsInRoom = io.sockets.adapter.rooms.get(roomId);
  if (!socketsInRoom) return;
  for (const socketId of socketsInRoom) {
    const meta = socketMeta.get(socketId);
    if (!meta) continue;
    const state = buildGameStateFor(room, meta.playerId);
    io.to(socketId).emit('state', state);
  }
}

io.on('connection', (socket) => {
  console.log('connected:', socket.id);

  socket.on('action', (action: ClientEvent) => {
    try {
      switch (action.t) {
        case 'join': {
          let room = getRoom(action.roomId);
          if (!room) room = createRoom(action.roomId);
          const player = joinRoom(action.roomId, action.name);
          socketMeta.set(socket.id, { roomId: action.roomId, playerId: player.id });
          socket.join(action.roomId);
          break;
        }
        case 'chat':
        case 'describe': {
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
        default:
          // ready・vote・lifeVote・guessWord・botVote는 stateMachine/vote.ts가 더 갖춰지는
          // 이후 단계(Day 4~)에 이어서 연결합니다.
          console.log('아직 처리 안 하는 액션:', action.t);
          return;
      }

      const meta = socketMeta.get(socket.id);
      if (meta) broadcastRoom(meta.roomId);
    } catch (e) {
      socket.emit('error', { reason: String(e) });
    }
  });

  socket.on('disconnect', () => {
    console.log('disconnected:', socket.id);
    socketMeta.delete(socket.id);
  });
});

// 그 외 모든 GET 요청은 index.html로 (React Router 쓸 때도 대응)
app.get('/*splat', (_req, res) => {
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// 중요: Railway는 PORT를 환경변수로 주입합니다. 하드코딩하면 배포가 실패해요.
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on ${PORT}`));
