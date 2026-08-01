import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import path from "path";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, { cors: { origin: "*" } }); // 개발 중엔 전체 허용, 나중에 좁힘

app.use(express.static(path.join(__dirname, "../../frontend/dist")));

io.on("connection", (socket) => {
  console.log("connected:", socket.id);
  socket.on("disconnect", () => console.log("disconnected:", socket.id));
});

// 그 외 모든 GET 요청은 index.html로 (React Router 쓸 때도 대응)
app.get("/*splat", (_req, res) => {
  res.sendFile(path.join(__dirname, "../../frontend/dist/index.html"));
});

// 중요: Railway는 PORT를 환경변수로 주입합니다. 하드코딩하면 배포가 실패해요.
const PORT = process.env.PORT || 3000;
httpServer.listen(PORT, () => console.log(`listening on ${PORT}`));
