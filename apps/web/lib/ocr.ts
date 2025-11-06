import { createWorker } from "tesseract.js";
import type { OCRLine } from "./store";

let worker: any = null;
let isInitialized = false;

export async function initializeOCR() {
  if (isInitialized && worker) {
    return worker;
  }

  try {
    console.log("[OCR] 워커 초기화 중...");
    worker = await createWorker("eng+kor", 1, {
      logger: (m) => {
        if (m.status === "recognizing text") {
          console.log(`[OCR] 진행률: ${Math.round(m.progress * 100)}%`);
        }
      },
    });
    isInitialized = true;
    console.log("[OCR] 워커 초기화 완료");
    return worker;
  } catch (error) {
    console.error("[OCR] 워커 초기화 실패:", error);
    throw error;
  }
}

export async function recognizeText(
  imageData: string | HTMLImageElement | HTMLCanvasElement
): Promise<OCRLine[]> {
  if (!worker) {
    await initializeOCR();
  }

  try {
    const { data } = await worker.recognize(imageData);
    const lines: OCRLine[] = [];

    // 라인별로 파싱
    if (data.words) {
      const linesMap = new Map<number, { words: any[]; bbox: any }>();

      data.words.forEach((word: any) => {
        const lineNumber = word.line?.line_number ?? 0;
        if (!linesMap.has(lineNumber)) {
          linesMap.set(lineNumber, {
            words: [],
            bbox: {
              x0: word.bbox.x0,
              y0: word.bbox.y0,
              x1: word.bbox.x1,
              y1: word.bbox.y1,
            },
          });
        }

        const line = linesMap.get(lineNumber)!;
        line.words.push(word);
        line.bbox.x0 = Math.min(line.bbox.x0, word.bbox.x0);
        line.bbox.y0 = Math.min(line.bbox.y0, word.bbox.y0);
        line.bbox.x1 = Math.max(line.bbox.x1, word.bbox.x1);
        line.bbox.y1 = Math.max(line.bbox.y1, word.bbox.y1);
      });

      linesMap.forEach((line) => {
        const text = line.words.map((w) => w.text).join(" ");
        lines.push({
          text,
          bbox: {
            x: line.bbox.x0,
            y: line.bbox.y0,
            width: line.bbox.x1 - line.bbox.x0,
            height: line.bbox.y1 - line.bbox.y0,
          },
        });
      });
    }

    return lines;
  } catch (error) {
    console.error("[OCR] 인식 실패:", error);
    return [];
  }
}

export async function terminateOCR() {
  if (worker) {
    await worker.terminate();
    worker = null;
    isInitialized = false;
    console.log("[OCR] 워커 종료");
  }
}
