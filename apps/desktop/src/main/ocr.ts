import * as ort from 'onnxruntime-node';
import { readFileSync } from 'fs';
import { join } from 'path';
import { CaptureResult } from './capture';

let session: ort.InferenceSession | null = null;
const MODEL_PATH = join(process.cwd(), 'models', 'paddleocr.onnx');

export async function initOcrModel(): Promise<boolean> {
  try {
    // 모델 파일이 없으면 스텁 모드로 동작
    // 실제 모델은 나중에 추가
    console.log('OCR model initialization (stub mode)');
    return true;
  } catch (error) {
    console.error('OCR model init error:', error);
    return false;
  }
}

export async function extractText(capture: CaptureResult | null): Promise<string> {
  if (!capture) {
    return '';
  }

  try {
    // 스텁: 실제 ONNX 추론 대신 더미 텍스트 반환
    // TODO: 실제 PaddleOCR ONNX 모델 로드 및 추론 구현
    if (!session) {
      // 모델이 없으면 스텁 모드
      return '';
    }

    // 실제 구현 시:
    // 1. capture.imageData를 전처리 (resize, normalize 등)
    // 2. ONNX 세션에 입력 텐서 전달
    // 3. 추론 결과를 텍스트로 변환
    
    return '';
  } catch (error) {
    console.error('OCR extraction error:', error);
    return '';
  }
}

