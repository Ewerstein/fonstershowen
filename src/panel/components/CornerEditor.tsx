import { useRef, useState } from 'react';
import { clamp } from '../../shared/geometry';
import type { Strings } from '../../shared/i18n';
import type { Corners, Point } from '../../shared/types';

interface CornerEditorProps {
  t: Strings;
  corners: Corners;
  mirror: boolean;
  screenAspect: number;
  onChange: (corners: Corners) => void;
}

const VIEW_W = 1000;

/**
 * Hörnen visas som de ser ut från gatan. Med spegling på byter vänster och höger plats,
 * så att hörn 1 här är samma hörn som siffran 1 i testbilden på duken.
 */
const MIRROR_INDEX = [1, 0, 3, 2];

export function CornerEditor({ t, corners, mirror, screenAspect, onChange }: CornerEditorProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [selected, setSelected] = useState(0);
  const viewH = VIEW_W / screenAspect;

  const storedIndex = (displayIndex: number) => (mirror ? MIRROR_INDEX[displayIndex] : displayIndex);
  const toDisplay = (p: Point): Point => (mirror ? { x: 1 - p.x, y: p.y } : p);
  const fromDisplay = (p: Point): Point => (mirror ? { x: 1 - p.x, y: p.y } : p);
  const display = [0, 1, 2, 3].map((i) => toDisplay(corners[storedIndex(i)]));

  const setCorner = (displayIndex: number, p: Point) => {
    const next = [...corners] as Corners;
    const stored = fromDisplay({ x: clamp(p.x, -0.2, 1.2), y: clamp(p.y, -0.2, 1.2) });
    next[storedIndex(displayIndex)] = stored;
    onChange(next);
  };

  const pointerToNormalized = (e: React.PointerEvent): Point | null => {
    const svg = svgRef.current;
    const ctm = svg?.getScreenCTM();
    if (!svg || !ctm) return null;
    const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(ctm.inverse());
    return { x: pt.x / VIEW_W, y: pt.y / viewH };
  };

  const onPointerDown = (i: number) => (e: React.PointerEvent<SVGGElement>) => {
    setSelected(i);
    (e.currentTarget as Element).setPointerCapture(e.pointerId);
  };

  const onPointerMove = (i: number) => (e: React.PointerEvent<SVGGElement>) => {
    if (!(e.currentTarget as Element).hasPointerCapture(e.pointerId)) return;
    const p = pointerToNormalized(e);
    if (p) setCorner(i, p);
  };

  const onKeyDown = (i: number) => (e: React.KeyboardEvent) => {
    const step = e.shiftKey ? 0.01 : 0.001;
    const p = display[i];
    const moves: Record<string, Point> = {
      ArrowLeft: { x: p.x - step, y: p.y },
      ArrowRight: { x: p.x + step, y: p.y },
      ArrowUp: { x: p.x, y: p.y - step },
      ArrowDown: { x: p.x, y: p.y + step },
    };
    const next = moves[e.key];
    if (!next) return;
    e.preventDefault();
    setCorner(i, next);
  };

  const polygon = display.map((p) => `${p.x * VIEW_W},${p.y * viewH}`).join(' ');

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`-40 -40 ${VIEW_W + 80} ${viewH + 80}`}
        className="w-full touch-none select-none"
        role="group"
        aria-label={t.stepCorners}
      >
        <rect x="0" y="0" width={VIEW_W} height={viewH} rx="6" fill="#08111d" stroke="#2b4a6e" strokeWidth="2" />
        {[0.25, 0.5, 0.75].map((f) => (
          <g key={f} stroke="#132538" strokeWidth="2">
            <line x1={f * VIEW_W} y1="0" x2={f * VIEW_W} y2={viewH} />
            <line x1="0" y1={f * viewH} x2={VIEW_W} y2={f * viewH} />
          </g>
        ))}
        <polygon points={polygon} fill="rgb(244 184 96 / 0.14)" stroke="#f4b860" strokeWidth="3" strokeLinejoin="round" />
        {display.map((p, i) => {
          const active = selected === i;
          return (
            <g
              key={i}
              role="button"
              tabIndex={0}
              aria-label={`${t.cornerLabels[i]}, ${Math.round(p.x * 1000) / 10} %, ${Math.round(p.y * 1000) / 10} %`}
              transform={`translate(${p.x * VIEW_W} ${p.y * viewH})`}
              onPointerDown={onPointerDown(i)}
              onPointerMove={onPointerMove(i)}
              onFocus={() => setSelected(i)}
              onKeyDown={onKeyDown(i)}
              className="cursor-grab outline-none active:cursor-grabbing"
            >
              <circle r="34" fill="transparent" />
              <circle r="22" fill={active ? '#f4b860' : '#132538'} stroke="#f4b860" strokeWidth="3" />
              <text
                textAnchor="middle"
                dominantBaseline="central"
                fontSize="22"
                fontWeight="700"
                fill={active ? '#08111d' : '#f4b860'}
                style={{ fontFamily: 'var(--font-display)' }}
              >
                {i + 1}
              </text>
            </g>
          );
        })}
      </svg>
      <p className="mt-2 text-sm text-mist">
        {t.cornerLabels[selected]}. {t.nudgeHint}
      </p>
    </div>
  );
}
