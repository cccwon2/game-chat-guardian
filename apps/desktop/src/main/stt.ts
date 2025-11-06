import { spawn } from 'child_process';
import { join } from 'path';

let sttWorker: any = null;

export async function initStt(): Promise<boolean> {
  try {
    // Python 워커를 통한 STT 초기화 (스텁)
    // 실제 구현 시: Python 스크립트로 WASAPI 캡처 + VAD + faster-whisper
    const pythonScript = join(process.cwd(), 'workers', 'stt_worker.py');
    console.log('STT initialization (stub mode)');
    return true;
  } catch (error) {
    console.error('STT init error:', error);
    return false;
  }
}

export async function transcribeAudio(): Promise<string> {
  try {
    // 스텁: 실제 오디오 캡처 및 STT 대신 빈 문자열 반환
    // TODO: WASAPI 루프백 캡처 + VAD + faster-whisper 통합
    
    return '';
  } catch (error) {
    console.error('STT transcription error:', error);
    return '';
  }
}

export function stopStt() {
  if (sttWorker) {
    sttWorker.kill();
    sttWorker = null;
  }
}

