"use client";

import { useEffect, useState } from "react";
import { connectTranscribe } from "@/lib/socket";
import { Toaster } from "sonner";

export default function OverlayPage() {
  const [toxicity, setToxicity] = useState<number | null>(null);
  const [text, setText] = useState<string>("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    console.log("OverlayPage 컴포넌트 마운트됨");
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    console.log("Socket 연결 시도 중...");
    let socket: ReturnType<typeof connectTranscribe> | null = null;

    try {
      socket = connectTranscribe();

      socket.on("overlay", (data: { text: string; partial: boolean }) => {
        console.log("overlay 이벤트 수신:", data);
        setText(data.text);
        // Mock toxicity 계산 (실제로는 서버에서 전송)
        if (!data.partial && data.text) {
          const mockScore = Math.random() * 0.5 + 0.5;
          setToxicity(mockScore);
        }
      });

      socket.on("connect", () => {
        console.log("STT 연결됨");
      });

      socket.on("disconnect", () => {
        console.log("STT 연결 끊김");
      });

      socket.on("connect_error", (error) => {
        console.error("STT 연결 오류:", error);
        // 서버가 실행되지 않은 경우에도 앱이 계속 작동하도록
        console.warn("STT 서버 연결 실패. 서버가 실행 중인지 확인하세요.");
        console.warn("STT 서버 시작: pnpm dev:stt");
      });
    } catch (error) {
      console.error("Socket 초기화 오류:", error);
    }

    return () => {
      if (socket) {
        socket.disconnect();
      }
    };
  }, [mounted]);

  if (!mounted) {
    return (
      <div style={{ 
        position: 'fixed', 
        top: '16px', 
        right: '16px', 
        padding: '8px 16px',
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        color: 'white',
        borderRadius: '8px',
        fontSize: '14px',
        zIndex: 9999
      }}>
        로딩 중...
      </div>
    );
  }

  return (
    <>
      <div style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        pointerEvents: 'none',
        zIndex: 9999
      }}>
        <div style={{
          backgroundColor: 'rgba(0, 0, 0, 0.8)',
          backdropFilter: 'blur(4px)',
          color: 'white',
          padding: '8px 16px',
          borderRadius: '8px',
          boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
          border: '1px solid rgba(255, 255, 255, 0.2)',
          minWidth: '200px'
        }}>
          {toxicity !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                Toxicity: {toxicity.toFixed(2)}
              </span>
              {toxicity > 0.7 && (
                <span style={{ color: '#fbbf24' }}>⚠ 경고</span>
              )}
            </div>
          )}
          {text && (
            <div style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px', maxWidth: '300px' }}>
              {text}
            </div>
          )}
          {!text && !toxicity && (
            <div style={{ fontSize: '14px' }}>대기 중...</div>
          )}
        </div>
      </div>
      <Toaster position="top-right" />
    </>
  );
}
