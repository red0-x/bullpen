import { ShieldAlert, Wrench } from "lucide-react";

const DIY = {
  yes: ["badge-ready", "You can probably handle this yourself"],
  maybe: ["badge-neutral", "Might be a DIY fix"],
  no: ["badge-warn", "Call a pro"],
};

export function FixGuide({ steps = [], safety, diy, testId = "fix-guide" }) {
  if (!steps.length && !safety) return null;
  return (
    <div className="rounded-[16px] border-[1.5px] border-line bg-cream/60 p-4" data-testid={testId}>
      <div className="flex flex-wrap items-center gap-2">
        <Wrench size={18} className="text-cap" aria-hidden />
        <h3 className="text-lg">How to fix it</h3>
        {diy && <span className={`badge ${DIY[diy][0]}`} data-testid={`${testId}-diy`}>{DIY[diy][1]}</span>}
      </div>
      {steps.length > 0 && (
        <ol className="mt-3 flex flex-col gap-2">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-3 text-sm text-espresso">
              <span className="h-6 w-6 shrink-0 rounded-full bg-white border-[1.5px] border-line grid place-items-center text-xs font-bold">{i + 1}</span>
              <span className="pt-0.5">{s}</span>
            </li>
          ))}
        </ol>
      )}
      {safety && (
        <p className="mt-3 rounded-[12px] bg-blush text-blush-ink text-sm font-semibold p-3 flex gap-2" data-testid={`${testId}-safety`}>
          <ShieldAlert size={16} className="shrink-0 mt-0.5" aria-hidden /> {safety}
        </p>
      )}
      <p className="mt-2 text-xs text-cocoa">AI suggestion from your photo and note. Check it before acting.</p>
    </div>
  );
}
