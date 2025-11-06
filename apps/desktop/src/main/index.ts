import { app, BrowserWindow, Tray, Menu, ipcMain, nativeImage } from 'electron';
import path from 'node:path';
import { captureRoi } from './capture';
import { initOcrModel, extractText } from './ocr';
import { initStt, transcribeAudio, stopStt } from './stt';
import { loadRules, judgeText } from './classifier';
import { logEvent } from './storage';
import { transitionTo } from './fsm';

let tray: Tray | null = null;
let mainWin: BrowserWindow | null = null;
let overlayWin: BrowserWindow | null = null;
let roi: { x: number; y: number; width: number; height: number } | null = null;
let captureInterval: NodeJS.Timeout | null = null;
let sttInterval: NodeJS.Timeout | null = null;
const CAPTURE_INTERVAL_MS = 1000; // 1초마다 캡처
const STT_INTERVAL_MS = 2000; // 2초마다 STT

function createMainWindow() {
  mainWin = new BrowserWindow({
    width: 900,
    height: 600,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
}

function createOverlay() {
  overlayWin = new BrowserWindow({
    width: 800,
    height: 600,
    transparent: true,
    frame: false,
    alwaysOnTop: true,
    fullscreen: true,
    skipTaskbar: true,
    focusable: true,
    hasShadow: false,
    resizable: false,
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });
  overlayWin.setAlwaysOnTop(true, 'screen-saver');
  // 개발 단계: src의 HTML을 직접 로드 (스크립트는 dist 경로를 참조)
  overlayWin.loadFile(path.join(process.cwd(), 'src/overlay/index.html'));
}

function createTray() {
  const iconPath = path.join(process.cwd(), 'assets', 'icon.png');
  let icon = nativeImage.createFromPath(iconPath);
  if (icon.isEmpty()) {
    icon = nativeImage.createEmpty();
  }
  tray = new Tray(icon);
  const menu = Menu.buildFromTemplate([
    { label: '?ㅼ젙 ?닿린', click: () => { mainWin?.show(); } },
    { type: 'separator' },
    { label: '醫낅즺', click: () => { app.quit(); } }
  ]);
  tray.setToolTip('Game Chat Guardian');
  tray.setContextMenu(menu);
}

app.whenReady().then(async () => {
  createMainWindow();
  createOverlay();
  createTray();

  // 모듈 초기화
  await loadRules();
  await initOcrModel();
  await initStt();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  // background tray app - do not quit on window close
});

app.on('before-quit', () => {
  if (captureInterval) {
    clearInterval(captureInterval);
  }
  if (sttInterval) {
    clearInterval(sttInterval);
  }
  stopStt();
});

ipcMain.on('ROI_SELECTED', (_, nextRoi) => {
  roi = nextRoi;
  if (overlayWin) {
    overlayWin.setIgnoreMouseEvents(true, { forward: true });
    overlayWin.setFocusable(false);
  }
  
  // ROI 선택 후 캡처 루프 시작
  startCaptureLoop();
  startSttLoop();
});

function startCaptureLoop() {
  if (captureInterval) {
    clearInterval(captureInterval);
  }
  
  captureInterval = setInterval(async () => {
    if (!roi) return;
    
    try {
      transitionTo('capturing');
      const capture = await captureRoi();
      
      if (!capture) {
        transitionTo('idle');
        return;
      }
      
      transitionTo('recognizing');
      const ocrText = await extractText(capture);
      
      if (ocrText) {
        transitionTo('classifying');
        const judgment = judgeText(ocrText);
        
        if (judgment.result === 'HARMFUL') {
          logEvent(judgment);
          if (overlayWin) {
            overlayWin.webContents.send('CONTENT_FLAGGED', { text: ocrText, reason: judgment.reason });
          }
          transitionTo('masking');
          setTimeout(() => transitionTo('idle'), 5000);
        } else {
          transitionTo('idle');
        }
      } else {
        transitionTo('idle');
      }
    } catch (error) {
      console.error('Capture loop error:', error);
      transitionTo('error', String(error));
      setTimeout(() => transitionTo('idle'), 2000);
    }
  }, CAPTURE_INTERVAL_MS);
}

function startSttLoop() {
  if (sttInterval) {
    clearInterval(sttInterval);
  }
  
  sttInterval = setInterval(async () => {
    if (!roi) return;
    
    try {
      transitionTo('recognizing');
      const sttText = await transcribeAudio();
      
      if (sttText) {
        transitionTo('classifying');
        const judgment = judgeText(sttText);
        
        if (judgment.result === 'HARMFUL') {
          logEvent(judgment);
          if (overlayWin) {
            overlayWin.webContents.send('CONTENT_FLAGGED', { text: sttText, reason: judgment.reason });
          }
          transitionTo('masking');
          setTimeout(() => transitionTo('idle'), 5000);
        } else {
          transitionTo('idle');
        }
      } else {
        transitionTo('idle');
      }
    } catch (error) {
      console.error('STT loop error:', error);
      transitionTo('error', String(error));
      setTimeout(() => transitionTo('idle'), 2000);
    }
  }, STT_INTERVAL_MS);
}

ipcMain.on('CONTENT_FLAGGED', () => {
  if (overlayWin) {
    overlayWin.webContents.send('CONTENT_FLAGGED');
  }
});

export function getRoi() {
  return roi;
}
