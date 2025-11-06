export interface ElectronAPI {
  capture: {
    listSources: () => Promise<CaptureSource[]>;
  };
}

export interface CaptureSource {
  id: string;
  name: string;
  thumbnail: string;
}

declare global {
  interface Window {
    api?: ElectronAPI;
  }
}

