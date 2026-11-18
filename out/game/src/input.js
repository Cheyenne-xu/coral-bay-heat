// Keyboard and mouse input for Coral Bay Heat. Held keys are read every frame;
// one-shot presses (interact, pause, mute, punch) are queued and taken once.
export const ACTION_INTERACT = 1;
export const ACTION_PAUSE = 2;
export const ACTION_PUNCH = 4;
export const ACTION_MUTE = 8;
export const ACTION_RESTART = 16;

const KEYMAP = {
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  ShiftLeft: 'run', ShiftRight: 'run',
};

export function createInput(canvas) {
  const keys = { up: false, down: false, left: false, right: false, run: false };
  let actions = 0;
  let mouseX = 0;
  let mouseY = 0;
  let mouseDown = false;
  let mouseClicked = false;

  window.addEventListener('keydown', (event) => {
    const name = KEYMAP[event.code];
    if (name) {
      keys[name] = true;
      event.preventDefault();
      return;
    }
    if (event.repeat) return;
    if (event.code === 'KeyE') actions |= ACTION_INTERACT;
    else if (event.code === 'KeyC') actions |= ACTION_INTERACT; // C: continue a saved game from the title screen
    else if (event.code === 'KeyF' || event.code === 'Space') actions |= ACTION_PUNCH;
    else if (event.code === 'KeyP' || event.code === 'Escape') actions |= ACTION_PAUSE;
    else if (event.code === 'KeyM') actions |= ACTION_MUTE;
    else if (event.code === 'Enter') actions |= ACTION_RESTART;
  });
  window.addEventListener('keyup', (event) => {
    const name = KEYMAP[event.code];
    if (name) keys[name] = false;
  });
  window.addEventListener('blur', () => {
    keys.up = keys.down = keys.left = keys.right = keys.run = false;
    mouseDown = false;
  });
  canvas.addEventListener('mousemove', (event) => {
    const rect = canvas.getBoundingClientRect();
    mouseX = event.clientX - rect.left;
    mouseY = event.clientY - rect.top;
  });
  canvas.addEventListener('mousedown', (event) => {
    if (event.button === 0) {
      mouseDown = true;
      mouseClicked = true;
    }
  });
  window.addEventListener('mouseup', () => { mouseDown = false; });
  canvas.addEventListener('contextmenu', (event) => event.preventDefault());

  return {
    keys,
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
    takeClick() {
      const clicked = mouseClicked;
      mouseClicked = false;
      return clicked;
    },
    mouseDown() { return mouseDown; },
    mouse() { return { x: mouseX, y: mouseY }; },
  };
}
