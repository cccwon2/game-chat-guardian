import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";

const app = express();
const httpServer = createServer(app);
const io = new Server(httpServer, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: true,
  },
  transports: ["websocket", "polling"], // WebSocket과 polling 모두 허용
  allowEIO3: true, // 호환성
});

app.use(cors());
app.use(express.json());

// 헬스 체크 엔드포인트
app.get("/", (req, res) => {
  res.json({ 
    status: "ok", 
    service: "STT Server",
    namespace: "/transcribe",
    timestamp: new Date().toISOString()
  });
});

// 네임스페이스 확인 엔드포인트
app.get("/transcribe", (req, res) => {
  res.json({ 
    status: "ok", 
    namespace: "/transcribe",
    message: "Socket.IO 네임스페이스가 활성화되어 있습니다"
  });
});

// STT 인터페이스
interface STTResult {
  text: string;
  isFinal: boolean;
}

// Mock STT 함수 (실제로는 Faster-Whisper 등의 API로 대체)
async function transcribe(buffer: Buffer): Promise<STTResult> {
  // Mock: 200ms 지연 후 고정 텍스트 반환
  await new Promise((resolve) => setTimeout(resolve, 200));
  
  // 실제로는 여기서 STT API 호출
  const mockTexts = [
    "안녕하세요",
    "게임을 시작합니다",
    "팀원들과 함께 플레이합니다",
    "좋은 플레이입니다",
  ];
  
  const text = mockTexts[Math.floor(Math.random() * mockTexts.length)];
  
  return {
    text,
    isFinal: true,
  };
}

// 네임스페이스 '/transcribe'
const transcribeNamespace = io.of("/transcribe");

// 네임스페이스 '/moderation'
const moderationNamespace = io.of("/moderation");

// 네임스페이스 연결 오류 핸들링
transcribeNamespace.on("connection_error", (error) => {
  console.error(`[STT] 네임스페이스 연결 오류:`, error);
});

interface AudioChunk {
  blob: number[];
  ts: number;
}

interface AudioBuffer {
  data: Buffer;
  timestamp: number;
}

transcribeNamespace.on("connection", (socket) => {
  console.log(`[STT] 클라이언트 연결 성공: ${socket.id}`);
  console.log(`[STT] 클라이언트 주소: ${socket.handshake.address}`);
  console.log(`[STT] 클라이언트 헤더:`, socket.handshake.headers);

  // 연결 시 테스트 메시지 전송
  socket.emit("overlay", {
    text: "STT 서버 연결 성공! 오디오 캡처를 시작하세요.",
    partial: false,
  });

  // 테스트용: 5초마다 mock 데이터 전송 (개발 모드)
  const testInterval = setInterval(() => {
    if (socket.connected) {
      const mockTexts = [
        "안녕하세요, 게임 채팅 보호 시스템입니다.",
        "음성 인식이 활성화되었습니다.",
        "대기 중...",
      ];
      const randomText = mockTexts[Math.floor(Math.random() * mockTexts.length)];
      socket.emit("overlay", {
        text: randomText,
        partial: false,
      });
      console.log(`[STT] 테스트 메시지 전송: ${randomText}`);
    } else {
      clearInterval(testInterval);
    }
  }, 5000); // 5초마다

  const buffers: AudioBuffer[] = [];
  let bufferTimeout: NodeJS.Timeout | null = null;
  const BUFFER_DURATION_MS = 2500; // 2.5초
  const MAX_BUFFER_SIZE = 10 * 1024 * 1024; // 10MB 제한

  const flushBuffer = async () => {
    if (buffers.length === 0) return;

    try {
      const totalSize = buffers.reduce((sum, b) => sum + b.data.length, 0);
      
      // 버퍼 크기 보호
      if (totalSize > MAX_BUFFER_SIZE) {
        console.warn(`[STT] 버퍼 크기 초과: ${totalSize} bytes, 초기화`);
        buffers.length = 0;
        return;
      }

      // 모든 버퍼 병합
      const mergedBuffer = Buffer.concat(buffers.map((b) => b.data));
      
      console.log(`[STT] 버퍼 플러시: ${buffers.length} 청크, ${mergedBuffer.length} bytes`);

      // STT 수행
      const result = await transcribe(mergedBuffer);

      // 부분 결과 전송
      socket.emit("overlay", {
        text: result.text,
        partial: !result.isFinal,
      });

      // 버퍼 초기화
      buffers.length = 0;
    } catch (error) {
      console.error(`[STT] 플러시 오류:`, error);
      buffers.length = 0;
    }
  };

  socket.on("audio_chunk", (data: AudioChunk) => {
    try {
      const buffer = Buffer.from(data.blob);
      
      buffers.push({
        data: buffer,
        timestamp: data.ts,
      });

      // 기존 타이머 취소
      if (bufferTimeout) {
        clearTimeout(bufferTimeout);
      }

      // 2.5초 후 플러시
      bufferTimeout = setTimeout(() => {
        flushBuffer();
        bufferTimeout = null;
      }, BUFFER_DURATION_MS);

      // 부분 결과 (최신 버퍼만 사용)
      if (buffers.length > 0) {
        socket.emit("overlay", {
          text: `[처리 중...]`,
          partial: true,
        });
      }
    } catch (error) {
      console.error(`[STT] 오디오 청크 처리 오류:`, error);
    }
  });

  socket.on("flush", () => {
    console.log(`[STT] 강제 플러시 요청`);
    if (bufferTimeout) {
      clearTimeout(bufferTimeout);
      bufferTimeout = null;
    }
    flushBuffer();
  });

  socket.on("disconnect", () => {
    console.log(`[STT] 클라이언트 연결 해제: ${socket.id}`);
    clearInterval(testInterval); // 테스트 인터벌 정리
    if (bufferTimeout) {
      clearTimeout(bufferTimeout);
      bufferTimeout = null;
    }
    buffers.length = 0;
  });
});

// 서버 시작 로그
console.log(`[STT] 서버 초기화 중...`);
console.log(`[STT] Socket.IO 네임스페이스 등록: /transcribe`);

const PORT = process.env.PORT || 3001;

httpServer.on("error", (error: NodeJS.ErrnoException) => {
  if (error.code === "EADDRINUSE") {
    console.error(`[STT] 포트 ${PORT}가 이미 사용 중입니다.`);
    console.error(`[STT] 기존 프로세스를 종료하거나 다른 포트를 사용하세요.`);
    console.error(`[STT] 포트를 확인하려면: netstat -ano | findstr :${PORT}`);
    process.exit(1);
  } else {
    console.error(`[STT] 서버 오류:`, error);
    process.exit(1);
  }
});

// Moderation 네임스페이스 처리
moderationNamespace.on("connection", (socket) => {
  console.log(`[Moderation] 클라이언트 연결 성공: ${socket.id}`);

  socket.on("ocr_lines", (data: { lines: Array<{ text: string; bbox: { x: number; y: number; width: number; height: number } }> }) => {
    try {
      console.log(`[Moderation] OCR 라인 수신: ${data.lines.length}개`);

      // Mock moderation: 간단한 룰 기반 필터링
      const toxicWords = ["욕설", "비방", "혐오", "차별"]; // 예시
      const indices: number[] = [];
      let score = 0;

      data.lines.forEach((line, index) => {
        const lowerText = line.text.toLowerCase();
        const hasToxic = toxicWords.some((word) => lowerText.includes(word.toLowerCase()));
        
        if (hasToxic) {
          indices.push(index);
          score = Math.max(score, 0.7 + Math.random() * 0.2); // 0.7-0.9
        } else {
          // 랜덤 점수 (테스트용)
          const randomScore = Math.random();
          if (randomScore > 0.8) {
            indices.push(index);
            score = Math.max(score, randomScore);
          }
        }
      });

      // 최소 점수 설정
      if (indices.length > 0 && score < 0.5) {
        score = 0.5 + Math.random() * 0.3;
      }

      console.log(`[Moderation] 결과: indices=${indices.join(",")}, score=${score.toFixed(2)}`);

      socket.emit("tox_lines", {
        indices,
        score,
      });
    } catch (error) {
      console.error(`[Moderation] 처리 오류:`, error);
    }
  });

  socket.on("disconnect", () => {
    console.log(`[Moderation] 클라이언트 연결 해제: ${socket.id}`);
  });
});

httpServer.listen(PORT, () => {
  console.log(`[STT] 서버 시작: http://localhost:${PORT}`);
  console.log(`[STT] 네임스페이스 '/transcribe' 대기 중...`);
  console.log(`[STT] 네임스페이스 '/moderation' 대기 중...`);
  console.log(`[STT] 헬스 체크: http://localhost:${PORT}/`);
  console.log(`[STT] Socket.IO 네임스페이스: ws://localhost:${PORT}/transcribe`);
  console.log(`[STT] Socket.IO 네임스페이스: ws://localhost:${PORT}/moderation`);
});

