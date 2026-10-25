"use client";

export function TradePicker({ trades, value, onChange, testId, unsure }) {
  return (
    <div className="flex flex-wrap gap-2" data-testid={testId}>
      {trades.map((t) => {
        const on = value.includes(t);
        return (
          <button key={t} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== t) : [...value, t])}
            className={`chip min-h-[40px] transition-colors duration-150 ${on ? "bg-espresso text-white border-espresso" : unsure ? "bg-blush border-[#F0C6B5] text-blush-ink" : "bg-white hover:bg-cream"}`}
            data-testid={`${testId}-${t.replace(/\W+/g, "-").toLowerCase()}`}>
            {t}
          </button>
        );
      })}
    </div>
  );
}

export function AreaPicker({ cities, value, onChange, testId }) {
  const custom = value.filter((v) => !cities.includes(v)).join(", ");
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap gap-2" data-testid={testId}>
        {cities.map((c) => {
          const on = value.includes(c);
          return (
            <button key={c} type="button" aria-pressed={on} onClick={() => onChange(on ? value.filter((x) => x !== c) : [...value, c])}
              className={`chip min-h-[40px] transition-colors duration-150 ${on ? "bg-espresso text-white border-espresso" : "bg-white hover:bg-cream"}`}
              data-testid={`${testId}-${c.replace(/\W+/g, "-").toLowerCase()}`}>
              {c}
            </button>
          );
        })}
      </div>
      <input className="field" placeholder="Other areas, comma separated" defaultValue={custom}
        onBlur={(e) => onChange([...value.filter((v) => cities.includes(v)), ...e.target.value.split(",").map((s) => s.trim()).filter(Boolean)])}
        data-testid={`${testId}-other`} />
    </div>
  );
}
