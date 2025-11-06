export type AppState = 'idle' | 'capturing' | 'recognizing' | 'classifying' | 'masking' | 'error';

// 간단한 상태 관리 (메인 프로세스용)
let currentState: AppState = 'idle';
let currentError: string | null = null;

// FSM 전이 헬퍼
export function transitionTo(state: AppState, error?: string) {
  if (error) {
    currentError = error;
    currentState = 'error';
    console.log(`[FSM] Error: ${error}`);
  } else {
    currentError = null;
    currentState = state;
    console.log(`[FSM] State: ${state}`);
  }
}

export function getState(): AppState {
  return currentState;
}

export function getError(): string | null {
  return currentError;
}

