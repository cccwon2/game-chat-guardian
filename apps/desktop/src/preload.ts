import { contextBridge, desktopCapturer, ipcRenderer } from "electron";

interface CaptureSource {
  id: string;
  name: string;
  thumbnail: string;
}

// 캡처 소스 목록 가져오기
contextBridge.exposeInMainWorld("api", {
  capture: {
    listSources: async (): Promise<CaptureSource[]> => {
      try {
        const sources = await desktopCapturer.getSources({
          types: ["window", "screen"],
          thumbnailSize: { width: 160, height: 90 },
        });

        return sources.map((source) => ({
          id: source.id,
          name: source.name,
          thumbnail: source.thumbnail.toDataURL(),
        }));
      } catch (error) {
        console.error("소스 가져오기 실패:", error);
        throw error;
      }
    },
  },
  app: {
    setEditMode: (on: boolean) => {
      ipcRenderer.invoke("app:edit:set", on);
    },
    quit: () => {
      ipcRenderer.invoke("app:quit");
    },
    onEditState: (callback: (on: boolean) => void) => {
      ipcRenderer.on("app:edit:state", (event, on: boolean) => {
        callback(on);
      });
    },
  },
});

