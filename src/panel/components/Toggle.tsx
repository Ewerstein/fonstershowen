interface ToggleProps {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/** Brytare med etikett och förklaring. Accentfärg bara när den är på. */
export function Toggle({ label, hint, checked, onChange }: ToggleProps) {
  return (
    <label className="flex items-start justify-between gap-4 py-3">
      <span>
        <span className="block text-[15px] font-medium text-frost">{label}</span>
        {hint && <span className="mt-0.5 block text-sm leading-snug text-mist">{hint}</span>}
      </span>
      <span className="relative mt-0.5 inline-flex shrink-0">
        <input
          type="checkbox"
          role="switch"
          className="peer sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="h-7 w-12 rounded-full bg-night-700 transition-colors peer-checked:bg-lantern peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-lantern" />
        <span className="pointer-events-none absolute left-1 top-1 h-5 w-5 rounded-full bg-frost shadow transition-transform peer-checked:translate-x-5 peer-checked:bg-night-950" />
      </span>
    </label>
  );
}
