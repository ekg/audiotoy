/**
 * Visual layer: canvas setup, responsive sizing, animation loop.
 *
 * Supports Canvas 2D and WebGL rendering modes.
 * The animation loop is synchronized with requestAnimationFrame
 * and provides audio time for visual-audio synchronization.
 */

/**
 * Create and configure the visual rendering layer.
 *
 * @param {HTMLElement} container - Parent element for the canvas
 * @param {Object} [options]
 * @param {'canvas2d'|'webgl'|'none'} [options.mode='canvas2d'] - Rendering mode
 * @param {string} [options.background='#000'] - Background color
 * @param {boolean} [options.antialias=true] - WebGL antialiasing
 * @param {number} [options.pixelRatio] - Override device pixel ratio (default: auto)
 * @returns {Object} Visual layer with canvas, context, and loop control
 */
export function createVisualLayer(container, options = {}) {
  const mode = options.mode || 'canvas2d';
  const background = options.background || '#000';
  const antialias = options.antialias !== false;
  const pixelRatio = options.pixelRatio || Math.min(window.devicePixelRatio || 1, 2);

  if (mode === 'none') {
    return {
      canvas: null,
      ctx2d: null,
      gl: null,
      start() {},
      stop() {},
      resize() {},
      destroy() {},
    };
  }

  // Create canvas
  const canvas = document.createElement('canvas');
  canvas.style.display = 'block';
  canvas.style.width = '100%';
  canvas.style.height = '100%';
  canvas.style.background = background;
  canvas.style.touchAction = 'none';
  canvas.style.userSelect = 'none';
  canvas.style.webkitUserSelect = 'none';
  container.appendChild(canvas);

  // Get rendering context
  let ctx2d = null;
  let gl = null;

  if (mode === 'webgl') {
    gl = canvas.getContext('webgl2', { antialias, alpha: false })
      || canvas.getContext('webgl', { antialias, alpha: false });
    if (gl) {
      gl.clearColor(0, 0, 0, 1);
    }
  } else {
    ctx2d = canvas.getContext('2d');
  }

  let width = 0;
  let height = 0;
  let animId = null;
  let renderCallback = null;
  let running = false;

  /** Resize canvas to match container, accounting for pixel ratio */
  function resize() {
    const rect = container.getBoundingClientRect();
    width = rect.width;
    height = rect.height;
    canvas.width = Math.floor(width * pixelRatio);
    canvas.height = Math.floor(height * pixelRatio);

    if (ctx2d) {
      ctx2d.scale(pixelRatio, pixelRatio);
    }
    if (gl) {
      gl.viewport(0, 0, canvas.width, canvas.height);
    }
  }

  // Observe container size changes
  const resizeObserver = new ResizeObserver(() => {
    resize();
  });
  resizeObserver.observe(container);

  // Initial sizing
  resize();

  /** Animation loop with audio time sync */
  function loop(timestamp) {
    if (!running) return;
    if (renderCallback) {
      renderCallback(timestamp, { canvas, ctx2d, gl, width, height, pixelRatio });
    }
    animId = requestAnimationFrame(loop);
  }

  return {
    canvas,
    ctx2d,
    gl,
    get width() { return width; },
    get height() { return height; },
    get pixelRatio() { return pixelRatio; },

    /** Set the render function: (timestamp, { canvas, ctx2d, gl, width, height }) => void */
    onRender(fn) {
      renderCallback = fn;
    },

    /** Start the animation loop */
    start() {
      if (running) return;
      running = true;
      animId = requestAnimationFrame(loop);
    },

    /** Stop the animation loop */
    stop() {
      running = false;
      if (animId !== null) {
        cancelAnimationFrame(animId);
        animId = null;
      }
    },

    resize,

    destroy() {
      this.stop();
      resizeObserver.disconnect();
      canvas.remove();
    },
  };
}
