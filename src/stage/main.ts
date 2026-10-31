import './stage.css';
import { Director } from '../core/director';
import { scheduleState } from '../core/schedule';
import { createBus } from '../shared/bus';
import { strings } from '../shared/i18n';
import { activeProfile, loadSettings } from '../shared/settings';
import type { ShowSettings, StageStatus } from '../shared/types';
import { loadTheme, themeBase } from '../shared/theme';
import { registerServiceWorker } from '../shared/offline';
import { CameraSensor } from './camera';
import { GlbCharacter } from './characters/glbCharacter';
import { TestTomte } from './characters/testTomte';
import type { Character } from './characters/types';
import { computeLayout } from './projection';
import { ShowScene } from './scene';

const content = document.getElementById('content') as HTMLDivElement;
const mirror = document.getElementById('mirror') as HTMLDivElement;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const pattern = document.getElementById('pattern') as HTMLDivElement;
const hint = document.getElementById('hint') as HTMLDivElement;

let settings: ShowSettings;
const scene = new ShowScene(canvas);
let character: Character = new TestTomte();
let shownStyle = 'test';
let styleError: string | undefined;
let wantedStyle = '';
scene.add(character.object);

const director = new Director({
  onChange: (state) => {
    character.setState(state);
    updateBlackout();
    sendStatus();
  },
});

// Schemat: showen vaknar och somnar på bestämda tider. Utanför tiden är fönstret svart och kameran vilar.
// Schemat agerar bara när tiden passerar en gräns, så en knapptryckning i panelen gäller till nästa gräns.
let scheduleOn: boolean | null = null;
let blackout = false;
let blackoutSince = 0;

function applySchedule(): void {
  const s = settings?.schedule;
  if (!s?.enabled) {
    if (scheduleOn === false && director.state === 'sleep') director.handle({ type: 'manual', action: 'wake' });
    scheduleOn = null;
    updateBlackout();
    return;
  }
  const on = scheduleState(new Date(), s).on;
  if (on === scheduleOn) return;
  const first = scheduleOn === null;
  scheduleOn = on;
  director.handle({ type: 'manual', action: on ? 'wake' : 'sleep' });
  updateBlackout();
  // En omladdning när showen släcks rensar minnet inför nästa kväll. Bara när det inte tar bort helskärmen.
  if (!on && !first) {
    window.setTimeout(() => {
      if (blackout && !document.fullscreenElement) location.reload();
    }, 8000);
  }
}

function updateBlackout(): void {
  const next = scheduleOn === false && director.state === 'sleep';
  if (next === blackout) return;
  blackout = next;
  blackoutSince = performance.now();
  document.body.classList.toggle('blackout', next);
  camera.setPaused(next);
  sendStatus();
}

const camera = new CameraSensor({
  onEvents: (events) => events.forEach((event) => director.handle(event)),
  onStatus: () => sendStatus(),
  onFrame: (frame) => bus.send({ kind: 'cameraFrame', frame }),
});

function swapCharacter(next: Character, styleId: string): void {
  scene.remove(character.object);
  character.dispose();
  character = next;
  character.setState(director.state);
  scene.add(character.object);
  shownStyle = styleId;
  sendStatus();
}

/** Byter figur när temat eller stilen ändras. Går något fel visas testtomten och felet skickas till panelen. */
async function applyStyle(themeId: string, styleId: string): Promise<void> {
  const key = `${themeId}/${styleId}`;
  if (key === wantedStyle) return;
  wantedStyle = key;
  if (styleId === 'test') {
    styleError = undefined;
    swapCharacter(new TestTomte(), 'test');
    return;
  }
  try {
    const theme = await loadTheme(themeId);
    const style = theme.styles.find((s) => s.id === (styleId || theme.defaultStyle)) ?? theme.styles[0];
    if (!style) throw new Error('Temat har inga stilar');
    const next = await GlbCharacter.load(themeBase(themeId), style);
    if (wantedStyle !== key) {
      next.dispose();
      return;
    }
    styleError = undefined;
    swapCharacter(next, style.id);
  } catch (error) {
    if (wantedStyle !== key) return;
    styleError = error instanceof Error ? error.message : String(error);
    if (shownStyle !== 'test') swapCharacter(new TestTomte(), 'test');
    else sendStatus();
  }
}

const bus = createBus((message) => {
  switch (message.kind) {
    case 'settings':
      applySettings(message.settings);
      break;
    case 'event':
      director.handle(message.event);
      break;
    case 'cameraPreview':
      camera.setPreview(message.on);
      break;
    case 'requestStatus':
    case 'hello':
      if (message.kind === 'requestStatus' || message.from === 'panel') sendStatus();
      break;
  }
});

function applySettings(next: ShowSettings): void {
  settings = next;
  director.autonomous = next.autonomous;
  pattern.hidden = !next.testPattern;
  document.documentElement.lang = next.locale;
  hint.textContent = strings(next.locale).fullscreenHint;
  layout();
  void applyStyle(next.themeId, next.styleId);
  camera.configure(next.camera);
  applySchedule();
}

function layout(): void {
  if (!settings) return;
  const profile = activeProfile(settings);
  const l = computeLayout(profile, window.innerWidth, window.innerHeight);
  content.style.width = `${l.width}px`;
  content.style.height = `${l.height}px`;
  content.style.transform = l.transform;
  mirror.classList.toggle('mirrored', l.mirror);
  mirror.style.clipPath = l.clipPath;
  scene.setSize(l.width, l.height);
}

// Bilder per sekund och statuspuls till kontrollpanelen.
let fps = 0;
let frames = 0;
let fpsWindowStart = performance.now();
let lastFrameAt = performance.now();

function sendStatus(): void {
  const status: StageStatus = {
    state: director.state,
    fps,
    fullscreen: isFullscreenLike(),
    autonomous: director.autonomous,
    screen: { width: window.innerWidth, height: window.innerHeight },
    styleId: shownStyle,
    styleError,
    camera: camera.status,
    blackout,
    at: Date.now(),
  };
  bus.send({ kind: 'status', status });
}

let previous = performance.now();
const start = previous;
function frame(now: number): void {
  const dt = Math.min(0.1, (now - previous) / 1000);
  previous = now;
  lastFrameAt = now;
  const time = (now - start) / 1000;
  director.update(dt);
  character.update(dt, { lookTarget: director.lookTarget, time });
  scene.update(dt, time);
  // När fönstret är släckt och tonats ut behöver grafiken inte ritas.
  if (!blackout || now - blackoutSince < 4000) scene.render();

  frames++;
  if (now - fpsWindowStart >= 1000) {
    fps = Math.round((frames * 1000) / (now - fpsWindowStart));
    frames = 0;
    fpsWindowStart = now;
    sendStatus();
  }
  requestAnimationFrame(frame);
}

// Helskärm, muspekare och tangenter för test utan kontrollpanel.
async function toggleFullscreen(): Promise<void> {
  if (document.fullscreenElement) await document.exitFullscreen();
  else await document.documentElement.requestFullscreen();
}

/** Helskärm från webbsidan eller från Mac (Ctrl+Cmd+F). Mac-helskärmen ligger kvar när sidan laddas om. */
function isFullscreenLike(): boolean {
  if (document.fullscreenElement) return true;
  return Math.abs(window.innerWidth - screen.width) <= 2 && Math.abs(window.innerHeight - screen.height) <= 2;
}

function updateHint(): void {
  hint.hidden = isFullscreenLike();
}

document.addEventListener('fullscreenchange', () => {
  updateHint();
  sendStatus();
});
document.addEventListener('dblclick', () => void toggleFullscreen());
document.addEventListener('keydown', (e) => {
  const key = e.key.toLowerCase();
  if (key === 'f') void toggleFullscreen();
  if (key === 'w') director.handle({ type: 'manual', action: 'wave' });
  if (key === 'c') director.handle({ type: 'manual', action: 'celebrate' });
  if (key === 'l') director.handle({ type: 'manual', action: 'lookAround' });
  if (key === 's') director.handle({ type: 'manual', action: director.state === 'sleep' ? 'wake' : 'sleep' });
});

let cursorTimer = 0;
document.addEventListener('mousemove', () => {
  document.body.classList.add('show-cursor');
  window.clearTimeout(cursorTimer);
  cursorTimer = window.setTimeout(() => document.body.classList.remove('show-cursor'), 2000);
});

window.addEventListener('resize', () => {
  layout();
  updateHint();
  sendStatus();
});

// Håll skärmen vaken medan showen går.
let wakeLock: WakeLockSentinel | null = null;
async function keepAwake(): Promise<void> {
  try {
    if ('wakeLock' in navigator && document.visibilityState === 'visible') {
      wakeLock = await navigator.wakeLock.request('screen');
    }
  } catch {
    wakeLock = null;
  }
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && !wakeLock) void keepAwake();
});

// Självläkning: tappad grafik eller en scen som slutat rita laddas om.
canvas.addEventListener('webglcontextlost', (e) => {
  e.preventDefault();
  window.setTimeout(() => location.reload(), 2000);
});
window.setInterval(() => {
  if (document.visibilityState === 'visible' && performance.now() - lastFrameAt > 10000) location.reload();
}, 5000);

async function boot(): Promise<void> {
  applySettings(await loadSettings());
  updateHint();
  void keepAwake();
  bus.send({ kind: 'hello', from: 'stage' });
  sendStatus();
  requestAnimationFrame(frame);
  window.setInterval(applySchedule, 15000);
  registerServiceWorker();
}

void boot();
