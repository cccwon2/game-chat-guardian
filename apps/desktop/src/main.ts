import { app, BrowserWindow, globalShortcut } from "electron";
import * as path from "path";
import * as http from "http";
import * as os from "os";

let overlayWindow: BrowserWindow | null = null;

// 개발 환경에서 사용자 데이터 디렉토리 설정 (캐시 에러 방지)
// 앱이 준비되기 전에 경로를 설정해야 함
// app.setPath는 app.whenReady() 전에 호출되어야 함
if (!app.isPackaged) {
  const userDataPath = path.join(os.tmpdir(), "game-chat-guardian-dev");
  try {
    app.setPath("userData", userDataPath);
    console.log("사용자 데이터 경로 설정:", userDataPath);
  } catch (error) {
    // 앱이 이미 시작된 경우 경고만 출력
    console.warn("사용자 데이터 경로 설정 실패 (정상일 수 있음):", error);
  }
}

// 서버가 준비될 때까지 대기하는 함수
async function waitForServer(url: string, maxRetries = 60, delay = 1000): Promise<boolean> {
  const urlObj = new URL(url);
  const hostname = urlObj.hostname;
  const port = parseInt(urlObj.port || "3000", 10);

  console.log(`서버 대기 시작: ${hostname}:${port} (최대 ${maxRetries}초)`);

  for (let i = 0; i < maxRetries; i++) {
    try {
      const success = await new Promise<boolean>((resolve) => {
        const req = http.request(
          {
            hostname,
            port,
            path: "/",
            method: "HEAD",
            timeout: 2000,
          },
          (res) => {
            console.log(`서버 응답 확인: ${res.statusCode}`);
            resolve(true);
          }
        );

        req.on("error", (error) => {
          if (i % 5 === 0) { // 5초마다 한 번씩만 로그
            console.log(`서버 연결 시도 ${i + 1}/${maxRetries}...`);
          }
          resolve(false);
        });

        req.on("timeout", () => {
          req.destroy();
          resolve(false);
        });

        req.end();
      });

      if (success) {
        console.log(`서버 준비 완료! (${i + 1}초 소요)`);
        return true;
      }
    } catch (error) {
      // 에러는 무시하고 계속 시도
    }

    if (i < maxRetries - 1) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  console.warn(`서버 대기 시간 초과 (${maxRetries}초)`);
  return false;
}

function createOverlayWindow() {
  const overlayUrl =
    process.env.OVERLAY_URL || "http://localhost:3000/overlay";

  console.log("오버레이 창 생성 중...", overlayUrl);

  // 개발 모드에서는 투명도 낮춤 (더 잘 보이도록)
  const isDev = process.env.NODE_ENV === "development" || !app.isPackaged;
  
  overlayWindow = new BrowserWindow({
    width: 400,
    height: 200,
    x: 100,
    y: 100,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    hasShadow: isDev, // 개발 모드에서만 그림자 표시
    skipTaskbar: true,
    resizable: isDev, // 개발 모드에서만 리사이즈 가능
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
    show: isDev, // 개발 모드에서는 즉시 표시, 프로덕션에서는 ready-to-show에서 표시
  });
  
  // 개발 모드에서 창이 즉시 보이도록 강제
  if (isDev) {
    overlayWindow.show();
    overlayWindow.focus();
    overlayWindow.setVisibleOnAllWorkspaces(true); // 모든 작업 공간에 표시
  }

  // 서버가 준비될 때까지 대기 후 로드
  waitForServer(overlayUrl)
    .then((ready) => {
      if (ready) {
        console.log("서버 준비됨, 페이지 로드 중...");
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.loadURL(overlayUrl);
          overlayWindow.show();
        }
      } else {
        console.warn("서버가 준비되지 않았습니다. 페이지 로드 시도...");
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.loadURL(overlayUrl);
          overlayWindow.show();
        }
      }
    })
    .catch((error) => {
      console.error("서버 대기 중 오류:", error);
      if (overlayWindow && !overlayWindow.isDestroyed()) {
        overlayWindow.loadURL(overlayUrl);
        overlayWindow.show();
      }
    });

  // 최대 60초 후 무조건 창 표시 (서버가 없어도)
  const timeout = setTimeout(() => {
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      console.log("타임아웃: 서버 대기 없이 창 표시");
      overlayWindow.loadURL(overlayUrl);
      overlayWindow.show();
    }
  }, 60000); // 60초

  // 개발 모드에서는 클릭스루 비활성화 (창을 볼 수 있도록)
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    // 개발 모드에서는 클릭스루 비활성화
    overlayWindow.setIgnoreMouseEvents(false);
  } else {
    // 프로덕션에서는 클릭스루 활성화
    overlayWindow.setIgnoreMouseEvents(true, { forward: true });
  }

  // 창이 준비되면 표시
  overlayWindow.once("ready-to-show", () => {
    console.log("창 준비됨, 표시 중...");
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.setVisibleOnAllWorkspaces(true); // 모든 작업 공간에 표시
      console.log(`창 위치: x=${overlayWindow.getPosition()[0]}, y=${overlayWindow.getPosition()[1]}`);
      console.log(`창 크기: ${overlayWindow.getSize()[0]}x${overlayWindow.getSize()[1]}`);
      console.log(`창 표시 여부: ${overlayWindow.isVisible()}`);
    }
  });

  // 에러 핸들링
  overlayWindow.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error(`페이지 로드 실패: ${errorCode} - ${errorDescription}`);
    
    // ERR_CONNECTION_REFUSED인 경우 서버가 준비될 때까지 다시 대기
    if (errorCode === -102 || errorDescription.includes("ERR_CONNECTION_REFUSED")) {
      console.log("서버 연결 실패, 재시도 대기 중...");
      waitForServer(overlayUrl, 30, 1000).then((ready) => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          if (ready) {
            console.log("서버 준비됨, 재시도 중...");
            overlayWindow.loadURL(overlayUrl);
          } else {
            console.warn("서버가 준비되지 않았지만 재시도...");
            overlayWindow.loadURL(overlayUrl);
          }
        }
      });
    } else {
      // 다른 에러는 3초 후 재시도
      setTimeout(() => {
        if (overlayWindow && !overlayWindow.isDestroyed()) {
          overlayWindow.loadURL(overlayUrl);
        }
      }, 3000);
    }
  });

  // 로드 완료 이벤트
  overlayWindow.webContents.on("did-finish-load", () => {
    console.log("페이지 로드 완료");
    if (overlayWindow && !overlayWindow.isDestroyed()) {
      overlayWindow.show();
      overlayWindow.focus();
      overlayWindow.setVisibleOnAllWorkspaces(true); // 모든 작업 공간에 표시
      console.log(`창 위치: x=${overlayWindow.getPosition()[0]}, y=${overlayWindow.getPosition()[1]}`);
      console.log(`창 크기: ${overlayWindow.getSize()[0]}x${overlayWindow.getSize()[1]}`);
      console.log(`창 표시 여부: ${overlayWindow.isVisible()}`);
    }
  });

  overlayWindow.on("closed", () => {
    overlayWindow = null;
  });

  // 개발 모드에서만 DevTools 열기 (선택사항)
  // DevTools 에러가 발생할 수 있으므로 주석 처리
  // 필요시 F12 키로 수동으로 열 수 있습니다
  if (process.env.NODE_ENV === "development" || !app.isPackaged) {
    // DevTools 자동 열기 비활성화 (에러 방지)
    // overlayWindow.webContents.once("did-finish-load", () => {
    //   overlayWindow?.webContents.openDevTools();
    // });
    
    // DevTools 콘솔 에러 무시
    overlayWindow.webContents.on("console-message", (event, level, message) => {
      // DevTools 내부 에러는 무시
      if (message.includes("devtools://") && message.includes("Failed to fetch")) {
        return;
      }
      console.log(`[Renderer ${level}]:`, message);
    });
    
    // F12 키로 DevTools 열기
    overlayWindow.webContents.on("before-input-event", (event, input) => {
      if (input.key === "F12") {
        overlayWindow?.webContents.toggleDevTools();
      }
    });
  }
}

function toggleOverlay() {
  if (!overlayWindow) {
    createOverlayWindow();
  } else {
    if (overlayWindow.isVisible()) {
      overlayWindow.hide();
    } else {
      overlayWindow.show();
    }
  }
}

// 앱 시작 로그
console.log("Electron 앱 시작 중...");
console.log("Node 버전:", process.versions.node);
console.log("Electron 버전:", process.versions.electron);

app.whenReady().then(() => {
  console.log("Electron 앱 준비 완료!");
  
  // 오버레이 창 생성
  console.log("오버레이 창 생성 시작...");
  createOverlayWindow();

  // 글로벌 단축키 등록
  const ret = globalShortcut.register("CommandOrControl+Shift+G", () => {
    console.log("글로벌 단축키 감지: Ctrl+Shift+G");
    toggleOverlay();
  });

  if (!ret) {
    console.error("글로벌 단축키 등록 실패");
  } else {
    console.log("글로벌 단축키 등록 성공: Ctrl+Shift+G");
  }

  app.on("activate", () => {
    console.log("앱 활성화 이벤트");
    if (BrowserWindow.getAllWindows().length === 0) {
      createOverlayWindow();
    }
  });
}).catch((error) => {
  console.error("앱 준비 중 오류:", error);
});

app.on("window-all-closed", () => {
  console.log("모든 창이 닫혔습니다.");
  if (process.platform !== "darwin") {
    console.log("앱 종료 중...");
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
