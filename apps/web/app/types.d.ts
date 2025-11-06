export interface ElectronAPI {
  capture: {
    listSources: () => Promise<CaptureSource[]>;
  };
  app: {
    setEditMode: (on: boolean) => void;
    quit: () => void;
    onEditState: (callback: (on: boolean) => void) => void;
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

