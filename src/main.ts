import './styles.css';
import atlasUrl from './assets/meimei.webp';
import { isTauri } from '@tauri-apps/api/core';
import { getCurrentWindow } from '@tauri-apps/api/window';
import { listen } from '@tauri-apps/api/event';
import { ask, message } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { check } from '@tauri-apps/plugin-updater';
import { Animator, CELL_HEIGHT, CELL_WIDTH, isAction } from './animation';

const canvas = document.querySelector<HTMLCanvasElement>('#pet')!;
const context = canvas.getContext('2d', { willReadFrequently: true })!;

const sprite = new Image();
sprite.src = atlasUrl;
const animator = new Animator();
const windowHandle = isTauri() ? getCurrentWindow() : null;

let lastRow = -1;
let lastColumn = -1;
let pointerDown: { x: number; y: number } | null = null;
let dragging = false;
let lastWindowX: number | null = null;
let dragIdleTimer: number | undefined;
let updateBusy = false;

function settleDrag(): void {
  window.clearTimeout(dragIdleTimer);
  dragIdleTimer = window.setTimeout(() => {
    pointerDown = null;
    dragging = false;
    lastWindowX = null;
    animator.play('idle');
  }, 300);
}

if (windowHandle) {
  void windowHandle.onMoved(({ payload }) => {
    if (!dragging) return;
    if (lastWindowX !== null && payload.x !== lastWindowX) {
      animator.play(payload.x < lastWindowX ? 'run-left' : 'run-right');
    }
    lastWindowX = payload.x;
    settleDrag();
  });
}

function draw(now: number): void {
  if (sprite.complete && sprite.naturalWidth === CELL_WIDTH * 8 &&
      (sprite.naturalHeight === CELL_HEIGHT * 9 || sprite.naturalHeight === CELL_HEIGHT * 11)) {
    const { row, column } = animator.frame(now);
    if (row !== lastRow || column !== lastColumn) {
      context.clearRect(0, 0, CELL_WIDTH, CELL_HEIGHT);
      context.drawImage(sprite, column * CELL_WIDTH, row * CELL_HEIGHT,
        CELL_WIDTH, CELL_HEIGHT, 0, 0, CELL_WIDTH, CELL_HEIGHT);
      lastRow = row;
      lastColumn = column;
    }
  }
  requestAnimationFrame(draw);
}
requestAnimationFrame(draw);

sprite.onerror = () => { void message('Meimei 的动画素材无法加载。请重新安装程序。', { title: 'Meimei', kind: 'error' }); };

function opaqueAt(x: number, y: number): boolean {
  const px = Math.floor(x * CELL_WIDTH / canvas.clientWidth);
  const py = Math.floor(y * CELL_HEIGHT / canvas.clientHeight);
  if (px < 0 || py < 0 || px >= CELL_WIDTH || py >= CELL_HEIGHT) return false;
  return context.getImageData(px, py, 1, 1).data[3] > 24;
}

canvas.addEventListener('pointerdown', (event) => {
  if (event.button !== 0 || !opaqueAt(event.offsetX, event.offsetY)) return;
  pointerDown = { x: event.screenX, y: event.screenY };
  dragging = false;
  canvas.setPointerCapture(event.pointerId);
});

canvas.addEventListener('pointermove', (event) => {
  if (!pointerDown || dragging) return;
  const dx = event.screenX - pointerDown.x;
  const dy = event.screenY - pointerDown.y;
  if (Math.hypot(dx, dy) < 5) return;
  dragging = true;
  animator.play(dx < 0 ? 'run-left' : 'run-right');
  if (windowHandle) {
    settleDrag();
    void windowHandle.startDragging().catch(() => {
      window.clearTimeout(dragIdleTimer);
      pointerDown = null;
      dragging = false;
      animator.play('idle');
    });
  }
});

canvas.addEventListener('pointerup', () => {
  if (pointerDown && !dragging) animator.play('wave');
  pointerDown = null;
  if (dragging) {
    window.clearTimeout(dragIdleTimer);
    dragging = false;
    animator.play('idle');
  }
});
canvas.addEventListener('pointercancel', () => {
  window.clearTimeout(dragIdleTimer);
  pointerDown = null;
  dragging = false;
  animator.play('idle');
});

async function checkForUpdate(manual: boolean): Promise<void> {
  if (updateBusy) return;
  updateBusy = true;
  try {
    const update = await check();
    if (!update) {
      if (manual) await message('已经是最新版。', { title: 'Meimei', kind: 'info' });
      return;
    }
    const approved = await ask(`发现 Meimei ${update.version}。现在下载安装吗？`,
      { title: 'Meimei 更新', kind: 'info', okLabel: '安装', cancelLabel: '稍后' });
    if (!approved) return;
    await update.downloadAndInstall();
    await relaunch();
  } catch (error) {
    console.error('Update check failed', error);
    if (manual) await message(`检查或安装更新失败：${String(error)}`, { title: 'Meimei', kind: 'error' });
  } finally {
    updateBusy = false;
  }
}

if (isTauri()) {
  void listen<string>('pet-action', (event) => {
    const action = event.payload;
    if (isAction(action)) animator.play(action);
    else if (action === 'check-update') void checkForUpdate(true);
  });

  // A missing first release must never prevent the pet from opening.
  window.setTimeout(() => { void checkForUpdate(false); }, 4000);
}
