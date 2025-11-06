export interface CaptureSource {
  id: string;
  name: string;
  thumbnail: string;
}

export interface AudioChunk {
  blob: number[];
  ts: number;
}

export interface OverlayEvent {
  text: string;
  partial: boolean;
  toxicity?: number;
}

