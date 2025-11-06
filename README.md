# Game Chat Guardian

게임 내 텍스트 채팅과 음성(마이크/시스템)을 실시간으로 감지합니다. 유해 표현(욕설, 혐오 발언 등)이 발견되면 사용자에게 비프음이나 TTS로 경고를 주는 Windows 앱입니다.

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
- pnpm ≥ 8

### 설치

```bash
# 의존성 설치
pnpm install
```

### 개발 모드

```bash
# Next.js + Electron 동시 실행
pnpm dev

# STT 서버만 실행
pnpm dev:stt
```

개발 모드는 다음을 실행합니다:
- Next.js 웹 앱 (http://localhost:3000)
- Electron 앱 (오버레이 창 포함)
- STT 서버는 별도로 실행 (pnpm dev:stt)

### 빌드

```bash
# 웹 앱 빌드
pnpm build:web

# Electron 앱 빌드
pnpm build:desktop

# 전체 빌드
pnpm build
```

## 📖 주요 기능

### P1: 오버레이 창

- 투명하고 항상 위에 표시되는 HUD 창
- `Ctrl+Shift+G` 단축키로 표시/숨김 토글
- 클릭스루 기능 (마우스 클릭이 아래 앱으로 전달됨)
- Next.js `/overlay` 라우트에서 렌더링

### P2: 화면/오디오 캡처

- `/settings/capture` 페이지에서 소스 선택
- DesktopCapturer로 화면/윈도우 캡처
- 오디오 트랙만 분리하여 1초 단위 청크로 전송
- Socket.IO를 통한 실시간 스트리밍

### P3: STT 스트리밍

- Socket.IO 네임스페이스 `/transcribe` 사용
- 2~3초 버퍼링 후 STT 수행
- Mock STT (실제 Faster-Whisper로 교체 가능)
- HUD에 실시간 텍스트 표시

## 🔒 보안

- Electron 보안 설정:
  - `nodeIntegration=false`
  - `contextIsolation=true`
  - `sandbox=true`
- Preload에서 최소 API만 노출
- IPC 채널 접두사: `app:*`

## 🛠️ 기술 스택

- **Frontend**: Next.js 14, React 18, TypeScript, Tailwind CSS
- **Desktop**: Electron 28
- **Backend**: Express, Socket.IO 4.8
- **Package Manager**: pnpm workspace
