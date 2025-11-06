"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import { connectTranscribe, connectModeration } from "@/lib/socket";
import { useOverlayStore } from "@/lib/store";
import { initializeOCR, recognizeText, terminateOCR } from "@/lib/ocr";
import { Toaster } from "sonner";

interface Point {
  x: number;
  y: number;
}

export default function OverlayPage() {
  const [mounted, setMounted] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [isSelecting, setIsSelecting] = useState(false);
  const [startPoint, setStartPoint] = useState<Point | null>(null);
  const [endPoint, setEndPoint] = useState<Point | null>(null);
  const [text, setText] = useState<string>("");
  const [beepEnabled, setBeepEnabled] = useState(true);
  const [volume, setVolume] = useState(5); // 0-10
  
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sourceCanvasRef = useRef<HTMLCanvasElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const ocrTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const frameRequestRef = useRef<number | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  
  const { roi, ocrLines, blurIndices, toxicityScore, isBlurActive, setROI, setOCRLines, setBlurIndices, setToxicityScore, setBlurActive } = useOverlayStore();
  
  const moderationSocketRef = useRef<ReturnType<typeof connectModeration> | null>(null);
  const sttSocketRef = useRef<ReturnType<typeof connectTranscribe> | null>(null);

  // 히스테리시스 설정
  const ON_THRESHOLD = 0.7;
  const OFF_THRESHOLD = 0.4;

  useEffect(() => {
    console.log("OverlayPage 컴포넌트 마운트됨");
    setMounted(true);

    // Edit Mode 상태 리스너
    if (window.api?.app?.onEditState) {
      window.api.app.onEditState((on: boolean) => {
        setEditMode(on);
      });
    }

    // OCR 초기화
    initializeOCR().catch(console.error);

    return () => {
      terminateOCR().catch(console.error);
      if (ocrTimeoutRef.current) {
        clearTimeout(ocrTimeoutRef.current);
      }
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, []);

  // 비프음 재생 함수
  const playBeep = useCallback((vol: number) => {
    try {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
      }
      
      const ctx = audioContextRef.current;
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();
      
      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);
      
      oscillator.frequency.value = 800; // 800Hz
      oscillator.type = "sine";
      
      const volumeValue = vol / 10; // 0-1 범위로 변환
      gainNode.gain.setValueAtTime(volumeValue, ctx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.2);
      
      oscillator.start(ctx.currentTime);
      oscillator.stop(ctx.currentTime + 0.2);
    } catch (error) {
      console.error("[Beep] 재생 오류:", error);
    }
  }, []);

  // Moderation Socket 연결
  useEffect(() => {
    if (!mounted) return;

    const socket = connectModeration();

    socket.on("tox_lines", (data: { indices: number[]; score: number }) => {
      console.log("[Moderation] tox_lines 수신:", data);
      setBlurIndices(data.indices);
      setToxicityScore(data.score);

      // 히스테리시스 적용 (함수형 업데이트 사용)
      setBlurActive((prevIsBlurActive) => {
        const shouldActivate = data.score >= ON_THRESHOLD && !prevIsBlurActive;
        const shouldDeactivate = data.score < OFF_THRESHOLD && prevIsBlurActive;

        if (shouldActivate) {
          console.log("[Moderation] 블러 활성화 (히스테리시스 ON)");
          return true;
        } else if (shouldDeactivate) {
          console.log("[Moderation] 블러 비활성화 (히스테리시스 OFF)");
          return false;
        }

        return prevIsBlurActive;
      });
    });

    moderationSocketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [mounted]);

  // STT Socket 연결
  useEffect(() => {
    if (!mounted) return;

    const socket = connectTranscribe();

    socket.on("overlay", (data: { text: string; partial: boolean }) => {
      console.log("overlay 이벤트 수신:", data);
      setText(data.text);
    });

    sttSocketRef.current = socket;

    return () => {
      socket.disconnect();
    };
  }, [mounted]);

  // ROI 선택 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (!editMode) return;
    setIsSelecting(true);
    setStartPoint({ x: e.clientX, y: e.clientY });
    setEndPoint({ x: e.clientX, y: e.clientY });
  }, [editMode]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isSelecting || !startPoint) return;
    setEndPoint({ x: e.clientX, y: e.clientY });
  }, [isSelecting, startPoint]);

  const handleMouseUp = useCallback(() => {
    if (!isSelecting || !startPoint || !endPoint) return;
    
    const x = Math.min(startPoint.x, endPoint.x);
    const y = Math.min(startPoint.y, endPoint.y);
    const width = Math.abs(endPoint.x - startPoint.x);
    const height = Math.abs(endPoint.y - startPoint.y);

    if (width > 10 && height > 10) {
      setROI({ x, y, width, height });
      console.log("[ROI] 영역 선택:", { x, y, width, height });
    }

    setIsSelecting(false);
    setStartPoint(null);
    setEndPoint(null);
  }, [isSelecting, startPoint, endPoint, setROI]);

  // 화면 캡처 및 OCR
  const captureAndOCR = useCallback(async () => {
    if (!roi || !canvasRef.current || !sourceCanvasRef.current) return;

    try {
      // 화면 캡처 (Electron에서는 desktopCapturer 사용)
      // 여기서는 간단히 canvas로 시뮬레이션
      const canvas = sourceCanvasRef.current;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // ROI 영역만 캡처 (실제로는 화면 캡처 필요)
      canvas.width = roi.width;
      canvas.height = roi.height;
      
      // Mock: 간단한 텍스트 그리기 (실제로는 화면 캡처)
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.fillStyle = "black";
      ctx.font = "16px Arial";
      ctx.fillText("Test Text", 10, 30);

      // OCR 수행
      const lines = await recognizeText(canvas);
      setOCRLines(lines);

      // Moderation 서버로 전송
      if (moderationSocketRef.current?.connected && lines.length > 0) {
        moderationSocketRef.current.emit("ocr_lines", {
          lines: lines.map((line) => ({
            text: line.text,
            bbox: line.bbox,
          })),
        });
      }
    } catch (error) {
      console.error("[OCR] 캡처/인식 오류:", error);
    }
  }, [roi, setOCRLines]);

  // OCR 주기적 실행 (디바운스 300-500ms)
  useEffect(() => {
    if (!roi || !mounted) return;

    // 기존 타이머 취소
    if (ocrTimeoutRef.current) {
      clearTimeout(ocrTimeoutRef.current);
    }

    // 디바운스: 400ms
    ocrTimeoutRef.current = setTimeout(() => {
      captureAndOCR();
    }, 400);

    return () => {
      if (ocrTimeoutRef.current) {
        clearTimeout(ocrTimeoutRef.current);
      }
    };
  }, [roi, mounted, captureAndOCR]);

  // 블러 렌더링
  useEffect(() => {
    if (!canvasRef.current || !sourceCanvasRef.current || !roi) return;

    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const sourceCanvas = sourceCanvasRef.current;
    
    if (!ctx) return;

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const renderFrame = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      if (isBlurActive && blurIndices.size > 0) {
        ocrLines.forEach((line, index) => {
          if (blurIndices.has(index)) {
            // 모자이크 처리 (8px 타일)
            const tileSize = 8;
            const { x, y, width, height } = line.bbox;
            
            for (let py = 0; py < height; py += tileSize) {
              for (let px = 0; px < width; px += tileSize) {
                const tileX = x + px;
                const tileY = y + py;
                const tileW = Math.min(tileSize, width - px);
                const tileH = Math.min(tileSize, height - py);
                
                // 타일 색상 (모자이크 효과)
                ctx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.8)`;
                ctx.fillRect(tileX, tileY, tileW, tileH);
              }
            }
          }
        });
      }

      frameRequestRef.current = requestAnimationFrame(renderFrame);
    };

    renderFrame();

    return () => {
      if (frameRequestRef.current) {
        cancelAnimationFrame(frameRequestRef.current);
      }
    };
  }, [isBlurActive, blurIndices, ocrLines, roi]);

  // 블러 활성화 시 비프음 재생
  useEffect(() => {
    if (isBlurActive && beepEnabled) {
      playBeep(volume);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isBlurActive]);

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

  // ROI 선택 영역 계산
  const selectionRect = startPoint && endPoint ? {
    x: Math.min(startPoint.x, endPoint.x),
    y: Math.min(startPoint.y, endPoint.y),
    width: Math.abs(endPoint.x - startPoint.x),
    height: Math.abs(endPoint.y - startPoint.y),
  } : null;

  return (
    <>
      {/* 숨겨진 캔버스들 */}
      <canvas ref={sourceCanvasRef} style={{ display: 'none' }} />
      <canvas ref={canvasRef} style={{ 
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        pointerEvents: 'none',
        zIndex: 9998,
      }} />

      {/* ROI 선택 영역 */}
      {editMode && (isSelecting || selectionRect) && (
        <div
          style={{
            position: 'fixed',
            left: selectionRect?.x || 0,
            top: selectionRect?.y || 0,
            width: selectionRect?.width || 0,
            height: selectionRect?.height || 0,
            border: '2px dashed #3b82f6',
            backgroundColor: 'rgba(59, 130, 246, 0.1)',
            pointerEvents: 'none',
            zIndex: 9999,
          }}
        />
      )}

      {/* 전체 영역 (ROI 선택용) */}
      {editMode && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            pointerEvents: 'auto',
            cursor: isSelecting ? 'crosshair' : 'default',
            zIndex: 9997,
          }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
        />
      )}

      {/* Edit Mode 핸들바 */}
      {editMode && (
        <div
          style={{
            position: 'fixed',
            top: '12px',
            left: '12px',
            pointerEvents: 'auto',
            WebkitAppRegion: 'drag' as any,
            zIndex: 10000,
          }}
        >
          <div
            style={{
              backgroundColor: 'rgba(39, 39, 42, 0.9)',
              backdropFilter: 'blur(8px)',
              borderRadius: '8px',
              padding: '8px 12px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              boxShadow: '0 4px 6px rgba(0, 0, 0, 0.3)',
            }}
          >
            <span style={{ color: 'rgba(255, 255, 255, 0.8)', fontSize: '14px' }}>
              Overlay (Edit Mode)
            </span>
            {roi && (
              <span style={{ color: 'rgba(255, 255, 255, 0.6)', fontSize: '12px' }}>
                ROI: {roi.width}x{roi.height}
              </span>
            )}
            <button
              onClick={() => window.api?.app?.setEditMode(false)}
              style={{
                WebkitAppRegion: 'no-drag' as any,
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: '#3f3f46',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#52525b';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#3f3f46';
              }}
            >
              Done
            </button>
            <button
              onClick={() => window.api?.app?.quit()}
              style={{
                WebkitAppRegion: 'no-drag' as any,
                padding: '4px 8px',
                borderRadius: '4px',
                backgroundColor: '#dc2626',
                color: 'white',
                border: 'none',
                cursor: 'pointer',
                fontSize: '12px',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = '#ef4444';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = '#dc2626';
              }}
              title="Ctrl+Shift+Q"
            >
              Quit
            </button>
          </div>
        </div>
      )}

      {/* 오버레이 배지 */}
      <div style={{
        position: 'fixed',
        top: '16px',
        right: '16px',
        pointerEvents: 'auto',
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
          {toxicityScore !== null && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600' }}>
                Toxicity: {toxicityScore.toFixed(2)}
              </span>
              {toxicityScore > ON_THRESHOLD && (
                <span style={{ color: '#fbbf24' }}>⚠ 경고</span>
              )}
            </div>
          )}
          {isBlurActive && (
            <div style={{ fontSize: '12px', color: '#ef4444', marginBottom: '4px' }}>
              🔒 블러 활성화됨
            </div>
          )}
          {text && (
            <div style={{ fontSize: '12px', color: '#d1d5db', marginTop: '4px', maxWidth: '300px' }}>
              {text}
            </div>
          )}
          {!text && !toxicityScore && (
            <div style={{ fontSize: '14px' }}>대기 중...</div>
          )}
          {roi && (
            <div style={{ fontSize: '10px', color: '#9ca3af', marginTop: '4px' }}>
              ROI: {Math.round(roi.width)}x{Math.round(roi.height)}
            </div>
          )}
          
          {/* 비프/볼륨 컨트롤 */}
          <div style={{ marginTop: '8px', paddingTop: '8px', borderTop: '1px solid rgba(255, 255, 255, 0.1)' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <button
                onClick={() => {
                  setBeepEnabled(!beepEnabled);
                  if (!beepEnabled) {
                    playBeep(volume);
                  }
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '4px',
                  backgroundColor: beepEnabled ? '#3b82f6' : '#6b7280',
                  color: 'white',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: '11px',
                  minWidth: '50px',
                }}
              >
                {beepEnabled ? '🔊 ON' : '🔇 OFF'}
              </button>
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)' }}>볼륨:</span>
              <input
                type="range"
                min="0"
                max="10"
                value={volume}
                onChange={(e) => {
                  const newVol = parseInt(e.target.value);
                  setVolume(newVol);
                  if (beepEnabled) {
                    playBeep(newVol);
                  }
                }}
                style={{ width: '60px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '11px', color: 'rgba(255, 255, 255, 0.7)', minWidth: '20px' }}>
                {volume}
              </span>
            </div>
          </div>
        </div>
      </div>
      <Toaster position="top-right" />
    </>
  );
}
