import { appendFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';
import { JudgmentResult } from './classifier';

export interface EventLog {
  timestamp: string;
  text: string;
  judgment: string;
  reason?: string;
}

export function logEvent(result: JudgmentResult) {
  if (result.result !== 'HARMFUL') {
    return; // HARMFUL만 로깅
  }

  const logPath = join(app.getPath('userData'), 'events.jsonl');
  const event: EventLog = {
    timestamp: new Date().toISOString(),
    text: result.text,
    judgment: result.result,
    reason: result.reason
  };

  try {
    const logDir = app.getPath('userData');
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    
    appendFileSync(logPath, JSON.stringify(event) + '\n', 'utf-8');
  } catch (error) {
    console.error('Failed to log event:', error);
  }
}

