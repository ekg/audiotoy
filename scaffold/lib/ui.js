/**
 * UI Shell: minimal, non-intrusive controls for audio toys.
 *
 * Provides: start/splash overlay, play/pause, volume, info/help,
 * fullscreen, and share/permalink. All controls are mobile-friendly
 * with 44px+ touch targets.
 */

const STYLES = `
  .toy-ui { position: fixed; top: 0; left: 0; right: 0; bottom: 0; pointer-events: none; z-index: 100; font-family: system-ui, -apple-system, sans-serif; }
  .toy-ui * { box-sizing: border-box; }

  /* Start splash — covers everything until user taps */
  .toy-splash {
    position: absolute; inset: 0; display: flex; flex-direction: column;
    align-items: center; justify-content: center; gap: 16px;
    background: rgba(0,0,0,0.85); color: #fff; pointer-events: auto;
    cursor: pointer; transition: opacity 0.3s; z-index: 200;
  }
  .toy-splash.hidden { opacity: 0; pointer-events: none; }
  .toy-splash-title { font-size: 24px; font-weight: 600; }
  .toy-splash-hint { font-size: 16px; opacity: 0.6; }

  /* Control bar — bottom of screen */
  .toy-controls {
    position: absolute; bottom: 0; left: 0; right: 0;
    display: flex; align-items: center; gap: 8px;
    padding: 12px 16px; pointer-events: auto;
    background: linear-gradient(transparent, rgba(0,0,0,0.5));
    opacity: 0.7; transition: opacity 0.2s;
  }
  .toy-controls:hover { opacity: 1; }

  .toy-btn {
    width: 44px; height: 44px; border: none; background: none;
    color: #fff; cursor: pointer; display: flex; align-items: center;
    justify-content: center; border-radius: 8px; padding: 0;
    font-size: 20px; flex-shrink: 0;
  }
  .toy-btn:hover { background: rgba(255,255,255,0.15); }
  .toy-btn:active { background: rgba(255,255,255,0.25); }

  .toy-volume {
    width: 80px; height: 4px; -webkit-appearance: none; appearance: none;
    background: rgba(255,255,255,0.3); border-radius: 2px; outline: none;
    flex-shrink: 0;
  }
  .toy-volume::-webkit-slider-thumb {
    -webkit-appearance: none; width: 16px; height: 16px;
    border-radius: 50%; background: #fff; cursor: pointer;
  }
  .toy-volume::-moz-range-thumb {
    width: 16px; height: 16px; border: none;
    border-radius: 50%; background: #fff; cursor: pointer;
  }

  .toy-spacer { flex: 1; }

  /* Info overlay */
  .toy-info {
    position: absolute; inset: 0; display: none; flex-direction: column;
    align-items: center; justify-content: center; padding: 32px;
    background: rgba(0,0,0,0.9); color: #fff; pointer-events: auto; z-index: 150;
  }
  .toy-info.visible { display: flex; }
  .toy-info-content { max-width: 500px; line-height: 1.6; text-align: center; }
  .toy-info-content h2 { margin: 0 0 12px; }
  .toy-info-content p { margin: 8px 0; opacity: 0.8; font-size: 15px; }
  .toy-info-close { margin-top: 24px; }
`;

// Simple SVG icons (inline, no dependencies)
const ICONS = {
  play: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><polygon points="6,4 20,12 6,20"/></svg>',
  pause: '<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor"><rect x="5" y="4" width="4" height="16"/><rect x="15" y="4" width="4" height="16"/></svg>',
  info: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>',
  fullscreen: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><path d="M8 3H5a2 2 0 0 0-2 2v3m18 0V5a2 2 0 0 0-2-2h-3m0 18h3a2 2 0 0 0 2-2v-3M3 16v3a2 2 0 0 0 2 2h3"/></svg>',
  share: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg>',
};

/**
 * Create the UI shell for an audio toy.
 *
 * @param {Object} options
 * @param {string} options.name - Toy name shown on splash screen
 * @param {string} [options.description] - Toy description for info overlay
 * @param {() => Promise<void>} options.onStart - Called when user taps to start (should resume audio)
 * @param {(playing: boolean) => void} [options.onPlayPause] - Play/pause toggle callback
 * @param {(volume: number) => void} [options.onVolume] - Volume change callback (0-1)
 * @param {Object} [options.permalink] - Permalink config { getState, setState }
 * @returns {Object} UI controller
 */
export function createUI(options) {
  // Inject styles
  if (!document.getElementById('toy-ui-styles')) {
    const style = document.createElement('style');
    style.id = 'toy-ui-styles';
    style.textContent = STYLES;
    document.head.appendChild(style);
  }

  const root = document.createElement('div');
  root.className = 'toy-ui';

  // --- Splash screen ---
  const splash = document.createElement('div');
  splash.className = 'toy-splash';
  splash.innerHTML = `
    <div class="toy-splash-title">${escapeHtml(options.name)}</div>
    <div class="toy-splash-hint">tap to start</div>
  `;
  root.appendChild(splash);

  let started = false;

  async function handleStart() {
    if (started) return;
    started = true;
    splash.classList.add('hidden');
    if (options.onStart) await options.onStart();
  }

  splash.addEventListener('click', handleStart);
  splash.addEventListener('touchend', (e) => {
    e.preventDefault();
    handleStart();
  });

  // --- Control bar ---
  const controls = document.createElement('div');
  controls.className = 'toy-controls';

  let playing = true;

  // Play/pause button
  const playBtn = document.createElement('button');
  playBtn.className = 'toy-btn';
  playBtn.innerHTML = ICONS.pause;
  playBtn.title = 'Play/Pause';
  playBtn.addEventListener('click', () => {
    playing = !playing;
    playBtn.innerHTML = playing ? ICONS.pause : ICONS.play;
    if (options.onPlayPause) options.onPlayPause(playing);
  });
  controls.appendChild(playBtn);

  // Volume slider
  const volume = document.createElement('input');
  volume.type = 'range';
  volume.className = 'toy-volume';
  volume.min = '0';
  volume.max = '1';
  volume.step = '0.01';
  volume.value = '0.75';
  volume.addEventListener('input', () => {
    if (options.onVolume) options.onVolume(parseFloat(volume.value));
  });
  controls.appendChild(volume);

  // Spacer
  const spacer = document.createElement('div');
  spacer.className = 'toy-spacer';
  controls.appendChild(spacer);

  // Share/permalink button
  if (options.permalink) {
    const shareBtn = document.createElement('button');
    shareBtn.className = 'toy-btn';
    shareBtn.innerHTML = ICONS.share;
    shareBtn.title = 'Share';
    shareBtn.addEventListener('click', () => {
      const state = options.permalink.getState();
      const params = new URLSearchParams(state);
      const url = `${window.location.origin}${window.location.pathname}?${params}`;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(url);
      }
    });
    controls.appendChild(shareBtn);
  }

  // Fullscreen button
  const fsBtn = document.createElement('button');
  fsBtn.className = 'toy-btn';
  fsBtn.innerHTML = ICONS.fullscreen;
  fsBtn.title = 'Fullscreen';
  fsBtn.addEventListener('click', () => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen().catch(() => {});
    } else {
      document.exitFullscreen();
    }
  });
  controls.appendChild(fsBtn);

  // Info button
  const infoBtn = document.createElement('button');
  infoBtn.className = 'toy-btn';
  infoBtn.innerHTML = ICONS.info;
  infoBtn.title = 'Info';
  controls.appendChild(infoBtn);

  root.appendChild(controls);

  // --- Info overlay ---
  const info = document.createElement('div');
  info.className = 'toy-info';
  info.innerHTML = `
    <div class="toy-info-content">
      <h2>${escapeHtml(options.name)}</h2>
      <p>${escapeHtml(options.description || '')}</p>
    </div>
    <button class="toy-btn toy-info-close">&times;</button>
  `;
  root.appendChild(info);

  infoBtn.addEventListener('click', () => info.classList.add('visible'));
  info.querySelector('.toy-info-close').addEventListener('click', () => info.classList.remove('visible'));
  info.addEventListener('click', (e) => {
    if (e.target === info) info.classList.remove('visible');
  });

  // Restore state from URL if permalink configured
  if (options.permalink && window.location.search) {
    const params = Object.fromEntries(new URLSearchParams(window.location.search));
    if (Object.keys(params).length > 0 && options.permalink.setState) {
      options.permalink.setState(params);
    }
  }

  document.body.appendChild(root);

  return {
    root,
    get started() { return started; },
    get playing() { return playing; },

    /** Set volume slider value programmatically */
    setVolume(v) {
      volume.value = String(v);
    },

    /** Show an info message */
    showInfo() { info.classList.add('visible'); },

    /** Hide the info overlay */
    hideInfo() { info.classList.remove('visible'); },

    /** Remove the splash screen immediately (useful if autostarting) */
    dismissSplash() {
      started = true;
      splash.classList.add('hidden');
    },

    destroy() {
      root.remove();
    },
  };
}

function escapeHtml(s) {
  const el = document.createElement('span');
  el.textContent = s;
  return el.innerHTML;
}
