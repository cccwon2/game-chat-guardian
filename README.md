# Game Chat Guardian

게임 내 텍스트 채팅과 음성(마이크/시스템)을 실시간으로 감지합니다. 유해 표현(욕설, 혐오 발언 등)이 발견되면 사용자에게 비프음이나 TTS로 경고를 주는 Windows 앱입니다.

## 🎯 설계 철학 (Architecture Philosophy)

> **Headless + Tray-first + Context Overlay + Robust Errors + Preload Boundary**

### 핵심 원칙

1. **헤드리스 실행 (Headless)**
   - 앱은 기본적으로 **헤드리스(트레이 전용)**로 실행됩니다
   - 메인 창 없음: 작업표시줄에 표시되지 않음 (`skipTaskbar:true`)
   - 트레이 아이콘 더블클릭 시에만 오버레이 창이 작업표시줄에 표시됨

2. **트레이 우선 (Tray-first)**
   - 시스템 트레이에 항상 표시
   - 트레이 메뉴로 모든 기능 제어 (Show/Hide, Edit Mode, Quit)
   - 네이티브 유틸리티 앱처럼 동작

3. **컨텍스트 오버레이 (Context Overlay)**
   - ROI 선택, HUD, 블러 처리는 모두 **투명 오버레이**에서 처리
   - 클릭스루 기능: 기본 상태에서는 마우스 이벤트가 아래 앱으로 전달됨
   - Edit Mode에서만 클릭스루 해제 (창 이동/조정 가능)

4. **강력한 오류 처리 (Robust Errors)**
   - 모든 권한/오류는 **Toast 알림**으로 표시
   - 즉시 재시도 버튼 제공
   - 재시도 시도 횟수/백오프 적용 (1s, 3s, 7s)

5. **Preload API 경계 (Preload Boundary)**
   - `nodeIntegration:false`, `contextIsolation:true`, `sandbox:true`
   - UI는 `window.api.*`로만 시스템 기능 접근
   - Zod로 런타임 타입 검증
   - 명시적 API 화이트리스트만 노출

## 🏗️ 프로젝트 구조

```
apps/
  web/            # Next.js 14 (App Router, TypeScript, Tailwind)
  desktop/        # Electron main + preload + builder 설정
services/
  stt/            # STT 마이크로서비스 (Express + Socket.IO)
packages/
  shared/         # 공용 타입/유틸
```

## 🚀 시작하기

### 필수 요구사항

- Node.js ≥ 20
- npm 또는 pnpm

### 설치

```bash
# 데스크톱 앱 디렉터리로 이동
cd apps/desktop

# 의존성 설치
npm install
```

### 개발 모드

```bash
# TypeScript 컴파일
npm run build

# Electron 앱 실행
npm run dev
```

### 빌드

```bash
# TypeScript 컴파일
npm run build

# Electron 앱 실행
npm start
```

## 📖 주요 기능

### ✅ 구현 완료

#### 1. 트레이 앱
- 시스템 트레이 아이콘 등록
- 컨텍스트 메뉴 (설정 열기, 종료)
- 헤드리스 백그라운드 실행

#### 2. 오버레이 창 및 ROI 선택
- 투명하고 항상 위에 표시되는 오버레이 창
- 마우스 드래그로 ROI(관심 영역) 선택
- ROI 선택 후 자동으로 클릭스루 모드 전환

#### 3. 화면 캡처 및 OCR (골격)
- `desktopCapturer`를 사용한 화면 캡처
- ROI 영역만 크롭하여 이미지 추출
- ONNX 런타임 통합 (PaddleOCR 모델 로드 준비)
- 주기적 캡처 루프 (1초 간격)

#### 4. 오디오 캡처 및 STT (골격)
- WASAPI 루프백 캡처 준비
- VAD 및 faster-whisper 통합 준비
- Python 워커 호출 구조 준비

#### 5. 유해 표현 판단
- 금칙어 사전 매칭
- 화이트리스트 기반 오탐 방지
- 텍스트 정규화 (소문자화, 특수문자 제거)
- ONNX 분류기 통합 준비 (KOELECTRA 등)

#### 6. 마스킹 및 경고
- ROI 영역에 시각적 마스킹(블라인드) 표시
- 우상단 토글 버튼으로 보기/가리기 전환 가능
- SAFE 판정 수신 시 자동 해제, 경고음 재생

#### 7. 상태 관리 (FSM)
- 상태 머신 구현 (idle, capturing, recognizing, classifying, masking, error)
- 상태 전이 로깅

#### 8. 로컬 저장소
- `rules.json`: 금칙어/화이트리스트 저장
- `events.jsonl`: 유해 표현 감지 이벤트 로깅
- `app.getPath('userData')` 경로에 저장

### 🚧 향후 구현 예정

- 실제 PaddleOCR ONNX 모델 통합
- WASAPI 루프백 캡처 + VAD + faster-whisper 통합
- ONNX 기반 분류기 (KOELECTRA 등) 통합
- 설정 UI (메인 창)
- 성능 최적화 및 CPU 사용량 모니터링

## 🔒 보안

- Electron 보안 설정:
  - `nodeIntegration=false`
  - `contextIsolation=true`
  - `sandbox=true`
- Preload에서 최소 API만 노출
- IPC 채널 접두사: `app:*`

## 🛠️ 기술 스택

- **Desktop**: Electron 28, TypeScript
- **OCR**: ONNX Runtime (Node.js 바인딩), PaddleOCR 준비
- **STT**: faster-whisper 준비 (Python 워커)
- **상태 관리**: 간단한 FSM (메인 프로세스)
- **Package Manager**: npm

## 📁 프로젝트 구조

```
apps/desktop/
  src/
    main/
      index.ts        # 메인 프로세스 (트레이, 오버레이, IPC)
      capture.ts      # 화면 캡처 모듈
      ocr.ts          # OCR 모듈 (ONNX)
      stt.ts          # STT 모듈 (WASAPI + faster-whisper)
      classifier.ts   # 유해 표현 판단 로직
      storage.ts      # 로컬 저장소 (rules.json, events.jsonl)
      fsm.ts          # 상태 머신
    preload/
      index.ts        # Preload 스크립트 (contextBridge)
    overlay/
      index.html      # 오버레이 HTML
      overlay.ts      # 오버레이 렌더러 스크립트
  assets/
    beep.wav          # 경고음
  dist/               # TypeScript 컴파일 결과
```

## 📝 설정 파일

### rules.json
금칙어 및 화이트리스트를 관리하는 파일입니다. `app.getPath('userData')` 경로에 저장됩니다.

```json
{
  "badwords": ["욕설", "비방", "혐오"],
  "whitelist": ["게임", "채팅", "가드"]
}
```

### events.jsonl
유해 표현 감지 이벤트를 한 줄씩 기록하는 로그 파일입니다.

```jsonl
{"timestamp":"2024-01-01T00:00:00.000Z","text":"유해 텍스트","judgment":"HARMFUL","reason":"금칙어: 욕설"}
```
