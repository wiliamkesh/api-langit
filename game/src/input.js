// Api Langit — keyboard input.
// Axes are -1..1 and read every frame; one-shot actions (camera, pause,
// start) fire once per key press. Mouse is not needed to fly, but a click
// on the start screen also starts the game.

export function createInput() {
  const down = new Set();
  const pressed = new Set();

  function key(e) {
    // Space and arrows scroll the page by default; the game owns them.
    if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
      e.preventDefault();
    }
    return e.code;
  }
  window.addEventListener('keydown', (e) => {
    const code = key(e);
    if (!e.repeat) pressed.add(code);
    down.add(code);
  });
  window.addEventListener('keyup', (e) => down.delete(key(e)));
  window.addEventListener('blur', () => {
    down.clear();
    pressed.clear();
  });

  let startClicked = false;
  window.addEventListener('mousedown', () => { startClicked = true; });

  function axis(neg, pos) {
    let v = 0;
    if (down.has(neg)) v -= 1;
    if (down.has(pos)) v += 1;
    return v;
  }

  return {
    // Read the current frame's input. Edge flags are consumed on read.
    poll() {
      const state = {
        // +1 = climb, -1 = descend.
        pitch: axis('KeyS', 'KeyW') + axis('ArrowDown', 'ArrowUp'),
        // +1 = bank right, -1 = bank left.
        roll: axis('KeyA', 'KeyD') + axis('ArrowLeft', 'ArrowRight'),
        // +1 = rudder right, -1 = rudder left.
        yaw: axis('KeyQ', 'KeyE'),
        // +1 = throttle up, -1 = throttle down.
        throttleDelta: (down.has('ShiftLeft') || down.has('ShiftRight') || down.has('KeyR') ? 1 : 0)
          + (down.has('ControlLeft') || down.has('ControlRight') || down.has('KeyF') ? -1 : 0),
        drop: down.has('Space'),
        toggleCamera: pressed.has('KeyC'),
        togglePause: pressed.has('KeyP') || pressed.has('Escape'),
        start: pressed.has('Enter') || startClicked,
        restart: pressed.has('KeyR') && pressed.has('ShiftLeft'),
      };
      // Clamp the combined axes (W + ArrowUp together still means +1).
      state.pitch = Math.max(-1, Math.min(1, state.pitch));
      state.roll = Math.max(-1, Math.min(1, state.roll));
      state.yaw = Math.max(-1, Math.min(1, state.yaw));
      pressed.clear();
      startClicked = false;
      return state;
    },
  };
}
