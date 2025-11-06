import { io, Socket } from "socket.io-client";

const STT_SERVER_URL = process.env.NEXT_PUBLIC_STT_SERVER_URL || "http://localhost:3001";

export function connectTranscribe(): Socket {
  console.log(`[Socket] STT 서버 연결 시도: ${STT_SERVER_URL}/transcribe`);
  
  const socket = io(`${STT_SERVER_URL}/transcribe`, {
    transports: ["polling", "websocket"], // polling을 먼저 시도 (WebSocket보다 안정적)
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: Infinity,
    timeout: 10000, // 10초 타임아웃 (20초는 너무 길 수 있음)
    forceNew: false,
    autoConnect: true,
    upgrade: true, // polling에서 websocket으로 업그레이드 허용
    rememberUpgrade: true, // 업그레이드 기억
  });

  // 연결 상태 로깅
  socket.on("connect", () => {
    console.log("Socket.IO 연결 성공:", socket.id);
  });

  socket.on("disconnect", (reason) => {
    console.log("Socket.IO 연결 끊김:", reason);
  });

  socket.on("connect_error", (error) => {
    console.error("Socket.IO 연결 오류:", error.message);
    console.error("연결 URL:", `${STT_SERVER_URL}/transcribe`);
    // 서버가 실행 중인지 확인
    if (error.message.includes("timeout") || error.message.includes("ECONNREFUSED")) {
      console.warn("STT 서버가 실행되지 않았거나 연결할 수 없습니다.");
      console.warn("STT 서버를 시작하려면: pnpm dev:stt");
    }
  });

  socket.on("reconnect", (attemptNumber) => {
    console.log("Socket.IO 재연결 성공:", attemptNumber);
  });

  socket.on("reconnect_attempt", (attemptNumber) => {
    console.log("Socket.IO 재연결 시도:", attemptNumber);
  });

  socket.on("reconnect_error", (error) => {
    console.error("Socket.IO 재연결 오류:", error.message);
  });

  socket.on("reconnect_failed", () => {
    console.error("Socket.IO 재연결 실패");
  });

  return socket;
}

export function emitAudioChunk(
  socket: Socket,
  blob: Blob,
  timestamp: number
): void {
  // Blob을 ArrayBuffer로 변환하여 전송
  blob.arrayBuffer().then((buffer) => {
    socket.emit("audio_chunk", {
      blob: Array.from(new Uint8Array(buffer)),
      ts: timestamp,
    });
  });
}

