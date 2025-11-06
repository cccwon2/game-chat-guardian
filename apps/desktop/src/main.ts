import { app, BrowserWindow, globalShortcut, ipcMain, Tray, Menu, nativeImage } from "electron";
import * as path from "path";
import * as http from "http";
import * as os from "os";

let overlayWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let editMode = false;

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
    hasShadow: false, // v3: 그림자 제거 (헤드리스 모드)
    skipTaskbar: true, // v3: 기본은 작업표시줄 숨김
    focusable: false, // v3: 기본은 포커스 불가 (클릭스루)
    resizable: isDev, // 개발 모드에서만 리사이즈 가능
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      sandbox: true,
      preload: path.join(__dirname, "preload.js"),
      backgroundThrottling: false,
    },
    show: false, // v3: 기본은 숨김 (트레이에서만 제어)
  });
  
  // v3: 기본은 숨김 (트레이 메뉴나 더블클릭으로만 표시)
  // 개발 모드에서도 기본은 숨김 (테스트용)
  // if (isDev) {
  //   overlayWindow.show();
  //   overlayWindow.focus();
  //   overlayWindow.setVisibleOnAllWorkspaces(true);
  // }

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

  // v3: 기본은 클릭스루 활성화 (헤드리스 모드)
  overlayWindow.setIgnoreMouseEvents(true, { forward: true });

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

// Edit Mode 설정 함수 (v3: 이동/종료 모드)
function setEditMode(on: boolean) {
  editMode = on;
  if (!overlayWindow) return;

  // v3: 클릭스루 해제/설정
  overlayWindow.setIgnoreMouseEvents(!on, { forward: !on });
  // v3: 포커스 가능 여부 설정
  overlayWindow.setFocusable(on);
  
  if (on) {
    // Edit Mode 진입: 창 표시, 작업표시줄 노출, 포커스
    if (!overlayWindow.isVisible()) {
      overlayWindow.show();
    }
    overlayWindow.setSkipTaskbar(false); // 편집 모드에서는 작업표시줄에 표시
    overlayWindow.focus();
  } else {
    // Edit Mode 종료: 클릭스루 복귀, 작업표시줄 숨김
    overlayWindow.setSkipTaskbar(true); // 편집 모드 종료 시 작업표시줄 숨김
    // 창은 숨기지 않음 (트레이에서 제어)
  }

  // 렌더러에 상태 전송
  overlayWindow.webContents.send("app:edit:state", on);
  
  updateTrayMenu();
  console.log(`Edit Mode: ${on ? "ON" : "OFF"}`);
}

// 트레이 메뉴 업데이트
function updateTrayMenu() {
  if (!tray || !overlayWindow) return;

  const menu = Menu.buildFromTemplate([
    {
      label: "Show Overlay",
      click: () => {
        if (overlayWindow) {
          overlayWindow.show();
          overlayWindow.setSkipTaskbar(false);
          overlayWindow.focus();
        }
      },
    },
    {
      label: editMode ? "Exit Edit Mode" : "Enter Edit Mode",
      click: () => setEditMode(!editMode),
    },
    { type: "separator" },
    {
      label: "Hide from Taskbar",
      click: () => {
        if (overlayWindow) {
          overlayWindow.setSkipTaskbar(true);
        }
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => app.quit(),
    },
  ]);

  tray.setContextMenu(menu);
}

// 트레이 생성
function createTray() {
  // 트레이 아이콘 생성 (개발/프로덕션 분기)
  let icon: Electron.NativeImage;
  
  if (app.isPackaged) {
    const iconPath = path.join(process.resourcesPath, "assets", "tray-icon.png");
    try {
      icon = nativeImage.createFromPath(iconPath);
      if (icon.isEmpty()) {
        throw new Error("아이콘 파일을 찾을 수 없습니다");
      }
    } catch (error) {
      // 아이콘 파일이 없으면 기본 아이콘 생성
      icon = nativeImage.createFromDataURL(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
      );
    }
  } else {
    // 개발 모드에서는 기본 아이콘 생성 (1x1 투명 이미지로 시작)
    icon = nativeImage.createFromDataURL(
      "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg=="
    );
    // 16x16 크기로 리사이즈
    icon = icon.resize({ width: 16, height: 16 });
  }

  try {
    tray = new Tray(icon);
    tray.setToolTip("Game Chat Guardian - OCR Toxicity Overlay");
    
    // 트레이 더블클릭
    tray.on("double-click", () => {
      if (!overlayWindow) return;
      if (!overlayWindow.isVisible()) {
        overlayWindow.show();
      }
      overlayWindow.setSkipTaskbar(false);
      overlayWindow.focus();
    });

    updateTrayMenu();
    console.log("트레이 아이콘 생성 완료");
  } catch (error) {
    console.error("트레이 생성 실패:", error);
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
  const retG = globalShortcut.register("CommandOrControl+Shift+G", () => {
    console.log("글로벌 단축키 감지: Ctrl+Shift+G");
    toggleOverlay();
  });

  const retE = globalShortcut.register("CommandOrControl+Shift+E", () => {
    console.log("글로벌 단축키 감지: Ctrl+Shift+E (Edit Mode)");
    setEditMode(!editMode);
  });

  const retQ = globalShortcut.register("CommandOrControl+Shift+Q", () => {
    console.log("글로벌 단축키 감지: Ctrl+Shift+Q (Quit)");
    app.quit();
  });

  if (!retG) {
    console.error("글로벌 단축키 등록 실패: Ctrl+Shift+G");
  } else {
    console.log("글로벌 단축키 등록 성공: Ctrl+Shift+G");
  }

  if (!retE) {
    console.error("글로벌 단축키 등록 실패: Ctrl+Shift+E");
  } else {
    console.log("글로벌 단축키 등록 성공: Ctrl+Shift+E");
  }

  if (!retQ) {
    console.error("글로벌 단축키 등록 실패: Ctrl+Shift+Q");
  } else {
    console.log("글로벌 단축키 등록 성공: Ctrl+Shift+Q");
  }

  // IPC 핸들러 등록
  ipcMain.handle("app:edit:set", (event, on: boolean) => {
    setEditMode(on);
  });

  ipcMain.handle("app:quit", () => {
    app.quit();
  });

  // 트레이 생성
  createTray();

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
  // Windows에서는 트레이가 있으면 앱이 계속 실행되도록
  if (process.platform !== "darwin" && tray) {
    // 트레이가 있으면 앱 종료하지 않음
    return;
  }
  if (process.platform !== "darwin") {
    console.log("앱 종료 중...");
    app.quit();
  }
});

app.on("will-quit", () => {
  globalShortcut.unregisterAll();
});
