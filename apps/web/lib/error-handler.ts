// v3: 권한/오류 UX 표준화
export enum ErrorCode {
  PERMISSION_DENIED = "PERMISSION_DENIED",
  NOT_FOUND = "NOT_FOUND",
  ABORTED = "ABORTED",
  OVERCONSTRAINED = "OVERCONSTRAINED",
  NOT_READABLE = "NOT_READABLE",
  NOT_ALLOWED = "NOT_ALLOWED",
  GENERIC = "GENERIC",
}

export interface ErrorInfo {
  code: ErrorCode;
  message: string;
  action?: "retry" | "openSettings" | "selectSource";
  backoff?: number; // 재시도까지 대기 시간 (ms)
}

export function mapErrorToInfo(error: unknown): ErrorInfo {
  const err = error as Error & { name?: string; constraint?: string };
  const message = err.message || "알 수 없는 오류가 발생했습니다.";

  // DOMException 오류 코드 매핑
  if (err.name === "NotAllowedError" || message.includes("permission")) {
    return {
      code: ErrorCode.PERMISSION_DENIED,
      message: "권한이 거부되었습니다. 시스템 설정에서 권한을 허용해주세요.",
      action: "openSettings",
      backoff: 1000,
    };
  }

  if (err.name === "NotFoundError" || message.includes("not found")) {
    return {
      code: ErrorCode.NOT_FOUND,
      message: "요청한 미디어 장치를 찾을 수 없습니다.",
      action: "selectSource",
      backoff: 1000,
    };
  }

  if (err.name === "AbortError" || message.includes("abort")) {
    return {
      code: ErrorCode.ABORTED,
      message: "작업이 취소되었습니다.",
      action: "retry",
      backoff: 1000,
    };
  }

  if (err.name === "OverconstrainedError" || message.includes("constraint")) {
    return {
      code: ErrorCode.OVERCONSTRAINED,
      message: "요청한 미디어 제약 조건을 충족할 수 없습니다.",
      action: "selectSource",
      backoff: 1000,
    };
  }

  if (err.name === "NotReadableError" || message.includes("not readable")) {
    return {
      code: ErrorCode.NOT_READABLE,
      message: "미디어 장치를 읽을 수 없습니다. 다른 애플리케이션에서 사용 중일 수 있습니다.",
      action: "retry",
      backoff: 3000,
    };
  }

  if (err.name === "NotAllowedError") {
    return {
      code: ErrorCode.NOT_ALLOWED,
      message: "접근이 허용되지 않았습니다.",
      action: "openSettings",
      backoff: 1000,
    };
  }

  return {
    code: ErrorCode.GENERIC,
    message,
    action: "retry",
    backoff: 1000,
  };
}

export function calculateBackoff(attempt: number): number {
  // 백오프: 1s, 3s, 7s
  const backoffs = [1000, 3000, 7000];
  return backoffs[Math.min(attempt, backoffs.length - 1)] || backoffs[backoffs.length - 1];
}

