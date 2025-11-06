"use client";

import { useEffect, useState, useRef } from "react";
import { connectTranscribe, emitAudioChunk } from "@/lib/socket";
import { toast } from "sonner";

export default function CapturePage() {
  const [sources, setSources] = useState<CaptureSource[]>([]);
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(null);
  const [isCapturing, setIsCapturing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const socketRef = useRef<ReturnType<typeof connectTranscribe> | null>(null);

  useEffect(() => {
    loadSources();
  }, []);

  const loadSources = async () => {
    try {
      if (!window.api?.capture?.listSources) {
        throw new Error("캡처 API를 사용할 수 없습니다. Electron 앱에서 실행해주세요.");
      }
      const sourcesList = await window.api.capture.listSources();
      setSources(sourcesList);
    } catch (err) {
      const message = err instanceof Error ? err.message : "소스를 불러올 수 없습니다.";
      setError(message);
      toast.error(message);
    }
  };

  const startCapture = async () => {
    if (!selectedSourceId) {
      toast.error("소스를 선택해주세요.");
      return;
    }

    try {
      setError(null);
      
      // Socket.IO 연결
      const socket = connectTranscribe();
      socketRef.current = socket;

      // MediaStream 가져오기
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: selectedSourceId,
          },
        } as any,
        video: {
          mandatory: {
            chromeMediaSource: "desktop",
            chromeMediaSourceId: selectedSourceId,
          },
        } as any,
      });

      streamRef.current = stream;

      // 오디오 트랙만 분리
      const audioStream = new MediaStream(
        stream.getAudioTracks()
      );

      // MediaRecorder 설정
      const mediaRecorder = new MediaRecorder(audioStream, {
        mimeType: "audio/webm;codecs=opus",
      });

      mediaRecorderRef.current = mediaRecorder;

      // 1초 간격으로 데이터 수집
      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0 && socketRef.current) {
          emitAudioChunk(socketRef.current, event.data, Date.now());
          console.log("오디오 청크 전송:", event.data.size, "bytes");
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error("MediaRecorder 오류:", event);
        toast.error("녹음 중 오류가 발생했습니다.");
      };

      // 1초마다 데이터 수집 시작
      mediaRecorder.start(1000);
      setIsCapturing(true);
      toast.success("캡처 시작됨");

      socket.on("connect", () => {
        console.log("STT 서버 연결됨");
      });

      socket.on("disconnect", () => {
        console.log("STT 서버 연결 끊김");
        toast.warning("서버 연결이 끊겼습니다.");
      });

    } catch (err) {
      const message = err instanceof Error ? err.message : "캡처를 시작할 수 없습니다.";
      setError(message);
      toast.error(message);
      console.error("캡처 오류:", err);
    }
  };

  const stopCapture = () => {
    if (mediaRecorderRef.current) {
      mediaRecorderRef.current.stop();
      mediaRecorderRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }

    setIsCapturing(false);
    toast.info("캡처 중지됨");
  };

  return (
    <main className="flex min-h-screen flex-col p-8">
      <h1 className="text-3xl font-bold mb-6">캡처 설정</h1>

      {error && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          {error}
          <button
            onClick={loadSources}
            className="ml-4 text-red-700 underline"
          >
            재시도
          </button>
        </div>
      )}

      <div className="mb-6">
        <button
          onClick={loadSources}
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
        >
          소스 새로고침
        </button>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {sources.map((source) => (
          <div
            key={source.id}
            onClick={() => setSelectedSourceId(source.id)}
            className={`p-4 border-2 rounded cursor-pointer transition ${
              selectedSourceId === source.id
                ? "border-blue-500 bg-blue-50"
                : "border-gray-300 hover:border-gray-400"
            }`}
          >
            <img
              src={source.thumbnail}
              alt={source.name}
              className="w-full h-auto mb-2 rounded"
            />
            <p className="text-sm font-medium truncate">{source.name}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4">
        {!isCapturing ? (
          <button
            onClick={startCapture}
            disabled={!selectedSourceId}
            className="px-6 py-3 bg-green-500 text-white rounded hover:bg-green-600 disabled:bg-gray-300 disabled:cursor-not-allowed"
          >
            캡처 시작
          </button>
        ) : (
          <button
            onClick={stopCapture}
            className="px-6 py-3 bg-red-500 text-white rounded hover:bg-red-600"
          >
            캡처 중지
          </button>
        )}
      </div>
    </main>
  );
}
