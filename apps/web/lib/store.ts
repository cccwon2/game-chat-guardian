import { create } from "zustand";

export interface OCRLine {
  text: string;
  bbox: { x: number; y: number; width: number; height: number };
}

export interface ROI {
  x: number;
  y: number;
  width: number;
  height: number;
}

interface OverlayStore {
  roi: ROI | null;
  ocrLines: OCRLine[];
  blurIndices: Set<number>;
  toxicityScore: number | null;
  isBlurActive: boolean;
  setROI: (roi: ROI | null) => void;
  setOCRLines: (lines: OCRLine[]) => void;
  setBlurIndices: (indices: number[]) => void;
  setToxicityScore: (score: number | null) => void;
  setBlurActive: (active: boolean) => void;
}

export const useOverlayStore = create<OverlayStore>((set) => ({
  roi: null,
  ocrLines: [],
  blurIndices: new Set(),
  toxicityScore: null,
  isBlurActive: false,
  setROI: (roi) => set({ roi }),
  setOCRLines: (lines) => set({ ocrLines: lines }),
  setBlurIndices: (indices) => set({ blurIndices: new Set(indices) }),
  setToxicityScore: (score) => set({ toxicityScore: score }),
  setBlurActive: (active) => set({ isBlurActive: active }),
}));
