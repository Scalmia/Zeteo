import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } }); // 개발 중엔 전체 허용, 나중에 좁힘

app.get("/", (_req, res) => res.send("OK"));

io.on("connection", (socket) => {
  console.log("connected:", socket.id);
  socket.on("disconnect", () => console.log("disconnected:", socket.id));
});

// 중요: Railway는 PORT를 환경변수로 주입합니다. 하드코딩하면 배포가 실패해요.
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on ${PORT}`));
