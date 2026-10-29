export const CELL_WIDTH = 192;
export const CELL_HEIGHT = 208;
export const COLUMNS = 8;

export const ACTIONS = {
  idle: { row: 0, frames: 6, fps: 5, loop: true },
  'run-right': { row: 1, frames: 8, fps: 11, loop: true },
  'run-left': { row: 2, frames: 8, fps: 11, loop: true },
  wave: { row: 3, frames: 4, fps: 7, loop: false },
  jump: { row: 4, frames: 5, fps: 8, loop: false },
  failed: { row: 5, frames: 8, fps: 7, loop: false },
  waiting: { row: 6, frames: 6, fps: 5, loop: true },
  working: { row: 7, frames: 6, fps: 6, loop: true },
  review: { row: 8, frames: 6, fps: 6, loop: true },
} as const;

export type Action = keyof typeof ACTIONS;

export function isAction(value: string): value is Action {
  return Object.prototype.hasOwnProperty.call(ACTIONS, value);
}

export class Animator {
  private action: Action = 'idle';
  private startedAt = performance.now();

  get current(): Action { return this.action; }

  play(action: Action, now = performance.now()): void {
    this.action = action;
    this.startedAt = now;
  }

  frame(now = performance.now()): { row: number; column: number } {
    const spec = ACTIONS[this.action];
    const elapsed = Math.max(0, now - this.startedAt);
    const step = Math.floor(elapsed * spec.fps / 1000);
    if (!spec.loop && step >= spec.frames) {
      this.play('idle', now);
      return { row: 0, column: 0 };
    }
    return { row: spec.row, column: step % spec.frames };
  }
}
