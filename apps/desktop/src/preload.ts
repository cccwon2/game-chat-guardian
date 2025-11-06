import { contextBridge, desktopCapturer } from "electron";

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
});

