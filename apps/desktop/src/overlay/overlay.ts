export {};
declare global { interface Window { gcg: any } }

const selection = document.getElementById('selection') as HTMLDivElement;
const blurMask = document.getElementById('blurMask') as HTMLDivElement;
const toggleBtn = document.getElementById('toggleMask') as HTMLButtonElement;
const beep = document.getElementById('beep') as HTMLAudioElement;

let startX = 0, startY = 0;
let dragging = false;
let savedRoi: { x: number; y: number; width: number; height: number } | null = null;
let isMasked = false;

function setRect(el: HTMLElement, x: number, y: number, w: number, h: number) {
  el.style.left = x + 'px';
  el.style.top = y + 'px';
  el.style.width = w + 'px';
  el.style.height = h + 'px';
}

window.addEventListener('mousedown', (e) => {
  dragging = true;
  startX = e.clientX;
  startY = e.clientY;
  selection.style.display = 'block';
  setRect(selection, startX, startY, 1, 1);
});

window.addEventListener('mousemove', (e) => {
  if (!dragging) return;
  const x = Math.min(e.clientX, startX);
  const y = Math.min(e.clientY, startY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);
  setRect(selection, x, y, w, h);
});

window.addEventListener('mouseup', (e) => {
  if (!dragging) return;
  dragging = false;
  const x = Math.min(e.clientX, startX);
  const y = Math.min(e.clientY, startY);
  const w = Math.abs(e.clientX - startX);
  const h = Math.abs(e.clientY - startY);
  setRect(selection, x, y, w, h);
  savedRoi = { x, y, width: w, height: h };
  (window as any).gcg.sendRoi(savedRoi);
  selection.style.display = 'none';
});

window.addEventListener('keydown', (e) => { if (e.key === 'Escape') { dragging = false; selection.style.display = 'none'; } });

(window as any).gcg.onContentFlagged(async (_event: any, data?: { text: string; reason?: string }) => {
  if (!savedRoi) return;
  setRect(blurMask, savedRoi.x, savedRoi.y, savedRoi.width, savedRoi.height);
  // 토글 버튼을 ROI 우상단에 배치
  toggleBtn.style.left = (savedRoi.x + savedRoi.width - 64) + 'px';
  toggleBtn.style.top = (savedRoi.y + 8) + 'px';
  
  isMasked = true;
  blurMask.style.display = 'block';
  toggleBtn.style.display = 'inline-block';
  toggleBtn.textContent = '보기';
  
  try { await beep.play(); } catch {}
});

(window as any).gcg.onContentSafe(() => {
  isMasked = false;
  blurMask.style.display = 'none';
  toggleBtn.style.display = 'none';
});

toggleBtn?.addEventListener('click', () => {
  if (!savedRoi) return;
  isMasked = !isMasked;
  blurMask.style.display = isMasked ? 'block' : 'none';
  toggleBtn.textContent = isMasked ? '보기' : '가리기';
});
