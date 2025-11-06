import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { app } from 'electron';

interface Rules {
  badwords: string[];
  whitelist: string[];
}

let rules: Rules = { badwords: [], whitelist: [] };

export async function loadRules(): Promise<Rules> {
  const rulesPath = join(app.getPath('userData'), 'rules.json');
  
  if (existsSync(rulesPath)) {
    try {
      const content = readFileSync(rulesPath, 'utf-8');
      rules = JSON.parse(content);
    } catch (error) {
      console.error('Failed to load rules:', error);
      rules = { badwords: [], whitelist: [] };
    }
  } else {
    // 기본 규칙 생성
    rules = {
      badwords: ['욕설', '비방', '혐오'],
      whitelist: ['게임', '채팅', '가드']
    };
    saveRules(rules);
  }
  
  return rules;
}

export function saveRules(newRules: Rules) {
  const rulesPath = join(app.getPath('userData'), 'rules.json');
  writeFileSync(rulesPath, JSON.stringify(newRules, null, 2), 'utf-8');
  rules = newRules;
}

function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s가-힣]/g, '')
    .replace(/\s+/g, '')
    .trim();
}

export type Judgment = 'SAFE' | 'HARMFUL';

export interface JudgmentResult {
  result: Judgment;
  reason?: string;
  text: string;
}

export function judgeText(text: string): JudgmentResult {
  const normalized = normalizeText(text);
  
  // 화이트리스트 체크
  for (const word of rules.whitelist) {
    if (normalized.includes(normalizeText(word))) {
      return { result: 'SAFE', text, reason: `화이트리스트: ${word}` };
    }
  }
  
  // 금칙어 체크
  for (const word of rules.badwords) {
    if (normalized.includes(normalizeText(word))) {
      return { result: 'HARMFUL', text, reason: `금칙어: ${word}` };
    }
  }
  
  // TODO: ONNX 분류기 추론 (KOELECTRA 등)
  
  return { result: 'SAFE', text };
}

