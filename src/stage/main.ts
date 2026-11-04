import './stage.css';
import { Director } from '../core/director';
import { christmasBanner } from '../core/countdown';
import { formatTime, scheduleState } from '../core/schedule';
import { fetchWeather, sceneWeather, type WeatherNow } from '../shared/weather';
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

const screenEl = document.getElementById('screen') as HTMLDivElement;
const content = document.getElementById('content') as HTMLDivElement;
const mirror = document.getElementById('mirror') as HTMLDivElement;
const canvas = document.getElementById('scene') as HTMLCanvasElement;
const pattern = document.getElementById('pattern') as HTMLDivElement;
const hint = document.getElementById('hint') as HTMLDivElement;
const banner = document.getElementById('banner') as HTMLDivElement;
const bannerMain = banner.querySelector('.main') as HTMLSpanElement;
const bannerSub = banner.querySelector('.sub') as HTMLSpanElement;

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
  const on = scheduleState(new Date(), s, settings.location).on;
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

// Omgivningen: text överst, himmel, snö på marken och väder.
let liveWeather: { now: WeatherNow | null; fetchedAt: number; error?: string } | undefined;
let weatherTimer = 0;
let weatherKey = '';
const WEATHER_INTERVAL_MS = 20 * 60_000;
const WEATHER_MAX_AGE_MS = 3 * 60 * 60_000;

function applyScene(): void {
  if (!settings) return;
  const s = settings.scene;
  const text =
    s.text === 'countdown'
      ? christmasBanner(new Date(), settings.locale)
      : s.text === 'custom' && s.customText.trim()
        ? { main: s.customText.trim(), sub: '' }
        : null;
  banner.hidden = !text;
  if (text) {
    bannerMain.textContent = text.main;
    bannerSub.textContent = text.sub;
  }
  scene.setTextSpace(!!text);
  scene.setSky(s.sky);
  scene.setGround(s.ground);
  const fresh = liveWeather?.now && Date.now() - liveWeather.fetchedAt < WEATHER_MAX_AGE_MS ? liveWeather.now : null;
  scene.setWeather(sceneWeather(s.weather, fresh));

  // Vädret hämtas bara när det ska följas och platsen finns, och då var tjugonde minut.
  const key = s.weather === 'live' && settings.location ? `${settings.location.lat},${settings.location.lon}` : '';
  if (key !== weatherKey) {
    weatherKey = key;
    window.clearInterval(weatherTimer);
    if (key) {
      void refreshWeather();
      weatherTimer = window.setInterval(() => void refreshWeather(), WEATHER_INTERVAL_MS);
    } else {
      liveWeather = undefined;
    }
  }
}

async function refreshWeather(): Promise<void> {
  const loc = settings?.location;
  if (!loc) return;
  try {
    liveWeather = { now: await fetchWeather(loc.lat, loc.lon), fetchedAt: Date.now() };
  } catch (error) {
    // Ett misslyckat försök behåller det senaste vädret. För gammalt väder ger lätt snöfall.
    liveWeather = { now: liveWeather?.now ?? null, fetchedAt: liveWeather?.fetchedAt ?? 0, error: error instanceof Error ? error.message : String(error) };
  }
  applyScene();
  sendStatus();
}

let started = false;

function updateBlackout(): void {
  const next = scheduleOn === false && director.state === 'sleep';
  if (next === blackout) return;
  blackout = next;
  blackoutSince = performance.now();
  // Vid start utanför schemat är fönstret svart direkt, utan att tomten först syns och tonas ut.
  if (!started) {
    content.style.transition = 'none';
    requestAnimationFrame(() => requestAnimationFrame(() => (content.style.transition = '')));
  }
  document.body.classList.toggle('blackout', next);
  camera.setPaused(next);
  updateHint();
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
  updateHint();
  layout();
  void applyStyle(next.themeId, next.styleId);
  camera.configure(next.camera);
  applySchedule();
  applyScene();
}

/**
 * Skärmen som den står på fönstret. Ligger projektorn på sidan vrids hela scenen 90 eller 270 grader,
 * så att hörnen, testbilden och tomten står rätt. Resten av appen räknar med den vridna skärmen.
 */
function screenSize(): { width: number; height: number } {
  const rotation = settings ? activeProfile(settings).rotation : 0;
  return rotation === 0
    ? { width: window.innerWidth, height: window.innerHeight }
    : { width: window.innerHeight, height: window.innerWidth };
}

function rotateScreen(): void {
  const rotation = settings ? activeProfile(settings).rotation : 0;
  const s = screenEl.style;
  if (rotation === 0) {
    s.width = s.height = s.transform = s.transformOrigin = s.right = s.bottom = '';
    return;
  }
  s.right = s.bottom = 'auto';
  s.width = `${window.innerHeight}px`;
  s.height = `${window.innerWidth}px`;
  s.transformOrigin = '0 0';
  s.transform = rotation === 90 ? `translateX(${window.innerWidth}px) rotate(90deg)` : `translateY(${window.innerHeight}px) rotate(270deg)`;
}

function layout(): void {
  if (!settings) return;
  const profile = activeProfile(settings);
  rotateScreen();
  const size = screenSize();
  const l = computeLayout(profile, size.width, size.height);
  content.style.width = `${l.width}px`;
  content.style.height = `${l.height}px`;
  content.style.setProperty('--banner-main', `${Math.round(Math.min(l.height * 0.075, l.width * 0.12))}px`);
  content.style.setProperty('--banner-sub', `${Math.round(Math.min(l.height * 0.038, l.width * 0.06))}px`);
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
    screen: screenSize(),
    styleId: shownStyle,
    styleError,
    camera: camera.status,
    blackout,
    weather: liveWeather,
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
  // Utanför schemat säger tipset varför fönstret är svart. Tipset syns bara utan helskärm, alltså när någon ställer in scenen.
  const t = strings(settings?.locale ?? 'sv');
  if (blackout && settings?.schedule.enabled) {
    const next = scheduleState(new Date(), settings.schedule, settings.location).next;
    hint.textContent = t.stageBlackoutHint(formatTime(next));
  } else {
    hint.textContent = t.fullscreenHint;
  }
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
  started = true;
  sendStatus();
  requestAnimationFrame(frame);
  window.setInterval(applySchedule, 15000);
  // Nedräkningen byter dag vid midnatt.
  window.setInterval(applyScene, 60_000);
  registerServiceWorker();
}

void boot();
