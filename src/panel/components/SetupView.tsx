import { defaultCorners, lightOnWindow, projectorDistanceCm } from '../../shared/geometry';
import type { Strings } from '../../shared/i18n';
import type { CameraFrame, CameraStatus, MaskShape, Rotation, ShowSettings, WindowProfile } from '../../shared/types';
import { CameraStep } from './CameraStep';
import { EveningStep } from './EveningStep';
import { CornerEditor } from './CornerEditor';
import { Toggle } from './Toggle';

interface SetupViewProps {
  t: Strings;
  settings: ShowSettings;
  profile: WindowProfile;
  screenAspect: number;
  onProfile: (patch: Partial<WindowProfile>) => void;
  onSettings: (change: (s: ShowSettings) => ShowSettings) => void;
  cameraStatus: CameraStatus | null;
  cameraFrame: CameraFrame | null;
  connected: boolean;
  onCameraPreview: (on: boolean) => void;
}

export function SetupView({
  t,
  settings,
  profile,
  screenAspect,
  onProfile,
  onSettings,
  cameraStatus,
  cameraFrame,
  connected,
  onCameraPreview,
}: SetupViewProps) {
  const masks: { value: MaskShape; label: string }[] = [
    { value: 'rect', label: t.maskRect },
    { value: 'rounded', label: t.maskRounded },
    { value: 'arch', label: t.maskArch },
  ];

  const aspect = profile.windowWidthCm / profile.windowHeightCm;
  const onSide = profile.rotation !== 0;
  const portrait = profile.windowHeightCm > profile.windowWidthCm;
  const lightPct = Math.round(lightOnWindow(profile.windowWidthCm, profile.windowHeightCm, onSide) * 100);
  // Projektorns egen bild är alltid liggande. Scenen räknar med den vriden när projektorn ligger på sidan.
  const physicalAspect = onSide ? 1 / screenAspect : screenAspect;

  /** Nya mått. Ändras formen mycket, till exempel bredd och höjd i fel ordning, börjar hörnen om. */
  const setSize = (patch: { windowWidthCm?: number; windowHeightCm?: number }) => {
    const w = patch.windowWidthCm ?? profile.windowWidthCm;
    const h = patch.windowHeightCm ?? profile.windowHeightCm;
    const changed = Math.abs(w / h / aspect - 1) > 0.2;
    onProfile(changed ? { ...patch, corners: defaultCorners(w / h, screenAspect) } : patch);
  };

  /** Ny placering av projektorn. Hörnen börjar om i den nya riktningen. */
  const setRotation = (rotation: Rotation) => {
    const logical = rotation === 0 ? physicalAspect : 1 / physicalAspect;
    onProfile({ rotation, corners: defaultCorners(aspect, logical) });
  };

  return (
    <ol className="space-y-4">
      <Step number={1} title={t.stepWindow} hint={t.stepWindowHint}>
        <div className="flex flex-wrap gap-4">
          <NumberField
            label={t.width}
            unit={t.cm}
            value={profile.windowWidthCm}
            onChange={(windowWidthCm) => setSize({ windowWidthCm })}
          />
          <NumberField
            label={t.height}
            unit={t.cm}
            value={profile.windowHeightCm}
            onChange={(windowHeightCm) => setSize({ windowHeightCm })}
          />
        </div>
        <fieldset className="mt-4">
          <legend className="text-sm text-mist">{t.projectorMount}</legend>
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <div className="inline-flex rounded-xl border border-night-600 p-0.5">
              {([0, 90] as Rotation[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  aria-pressed={value === 0 ? !onSide : onSide}
                  onClick={() => (value === 0 ? onSide && setRotation(0) : !onSide && setRotation(90))}
                  className={[
                    'rounded-[10px] px-3.5 py-1.5 text-sm transition-colors',
                    (value === 0 ? !onSide : onSide) ? 'bg-lantern/15 text-lantern-soft' : 'text-frost hover:text-lantern-soft',
                  ].join(' ')}
                >
                  {value === 0 ? t.projectorUpright : t.projectorOnSide}
                </button>
              ))}
            </div>
            {onSide && (
              <button
                type="button"
                onClick={() => setRotation(profile.rotation === 90 ? 270 : 90)}
                className="rounded-xl border border-night-600 px-3.5 py-1.5 text-sm font-medium text-frost hover:border-mist"
              >
                {t.projectorTurn}
              </button>
            )}
          </div>
        </fieldset>
        <p className="mt-3 text-[15px] text-frost/85">
          {t.projectorDistance(projectorDistanceCm(profile.windowWidthCm, profile.windowHeightCm, onSide))}{' '}
          {t.projectorLight(lightPct)}
        </p>
        {portrait && !onSide && <p className="mt-2 max-w-[62ch] text-[15px] leading-snug text-lantern-soft">{t.projectorSideTip}</p>}
      </Step>

      <Step number={2} title={t.stepCorners} hint={t.stepCornersHint}>
        <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
          <CornerEditor
            t={t}
            corners={profile.corners}
            mirror={profile.mirror}
            screenAspect={screenAspect}
            onChange={(corners) => onProfile({ corners })}
          />
          <div className="divide-y divide-night-700">
            <Toggle
              label={t.testPattern}
              hint={t.testPatternHint}
              checked={settings.testPattern}
              onChange={(testPattern) => onSettings((s) => ({ ...s, testPattern }))}
            />
            <Toggle label={t.mirror} hint={t.mirrorHint} checked={profile.mirror} onChange={(mirror) => onProfile({ mirror })} />
            <fieldset className="py-3">
              <legend className="text-[15px] font-medium">{t.maskShape}</legend>
              <div className="mt-2 flex flex-wrap gap-2">
                {masks.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    aria-pressed={profile.mask === m.value}
                    onClick={() => onProfile({ mask: m.value })}
                    className={[
                      'rounded-full border px-3.5 py-1.5 text-sm transition-colors',
                      profile.mask === m.value
                        ? 'border-lantern bg-lantern/15 text-lantern-soft'
                        : 'border-night-600 text-frost hover:border-mist',
                    ].join(' ')}
                  >
                    {m.label}
                  </button>
                ))}
              </div>
              <label className="mt-4 block text-sm text-mist">
                {t.maskInset}
                <input
                  type="range"
                  min={0}
                  max={20}
                  step={0.5}
                  value={profile.maskInsetPct}
                  onChange={(e) => onProfile({ maskInsetPct: Number(e.target.value) })}
                  className="mt-2 block w-full accent-lantern"
                />
              </label>
            </fieldset>
            <div className="pt-4">
              <button
                type="button"
                onClick={() => onProfile({ corners: defaultCorners(profile.windowWidthCm / profile.windowHeightCm, screenAspect) })}
                className="rounded-xl border border-night-600 px-4 py-2 text-sm font-medium text-frost hover:border-mist"
              >
                {t.resetCorners}
              </button>
            </div>
          </div>
        </div>
      </Step>

      <Step number={3} title={t.stepCamera} hint={t.stepCameraHint}>
        <CameraStep
          t={t}
          camera={settings.camera}
          status={cameraStatus}
          frame={cameraFrame}
          connected={connected}
          onChange={(patch) => onSettings((s) => ({ ...s, camera: { ...s.camera, ...patch } }))}
          onPreview={onCameraPreview}
        />
      </Step>

      <Step number={4} title={t.stepEvening} hint={t.stepEveningHint}>
        <EveningStep t={t} themeId={settings.themeId} cameraEnabled={settings.camera.enabled} />
      </Step>
    </ol>
  );
}

function Step({
  number,
  title,
  hint,
  children,
}: {
  number: number;
  title: string;
  hint: string;
  children: React.ReactNode;
}) {
  return (
    <li className="rounded-[22px] border border-night-700 bg-night-900 p-5 sm:p-6">
      <div className="flex gap-4">
        <span
          aria-hidden="true"
          className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-night-600 font-display text-[17px] font-semibold text-lantern"
        >
          {number}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-[21px] font-semibold leading-tight">{title}</h3>
          <p className="mt-1 max-w-[62ch] text-[15px] leading-snug text-mist">{hint}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </li>
  );
}

function NumberField({ label, unit, value, onChange }: { label: string; unit: string; value: number; onChange: (v: number) => void }) {
  return (
    <label className="block">
      <span className="text-sm text-mist">{label}</span>
      <span className="mt-1 flex items-center rounded-xl border border-night-600 bg-night-800 focus-within:border-lantern">
        <input
          type="number"
          inputMode="decimal"
          min={10}
          max={1000}
          value={value}
          onChange={(e) => {
            const v = Number(e.target.value);
            if (Number.isFinite(v) && v >= 10 && v <= 1000) onChange(v);
          }}
          className="w-24 bg-transparent px-3 py-2.5 text-[17px] tabular-nums text-frost outline-none"
        />
        <span className="pr-3 text-sm text-mist">{unit}</span>
      </span>
    </label>
  );
}
