export function PageTitle({ eyebrow, title, sub, children }) {
  return (
    <div className="mb-8 flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
      <div className="max-w-2xl">
        {eyebrow && <p className="text-sm font-semibold text-cocoa uppercase tracking-wider">{eyebrow}</p>}
        <h1 className="mt-1 text-4xl sm:text-5xl lg:text-6xl text-espresso">{title}</h1>
        {sub && <p className="mt-3 text-base md:text-lg text-cocoa">{sub}</p>}
      </div>
      {children}
    </div>
  );
}
