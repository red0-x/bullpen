const POSES = {
  glove: { src: "/mascot/pup-glove.webp", alt: "Bullpup puppy holding a baseball glove" },
  sleep: { src: "/mascot/pup-sleep.webp", alt: "Bullpup puppy napping on his glove" },
  head: { src: "/mascot/pup-head.webp", alt: "Bullpup puppy" },
};

export function EmptyState({ pose = "glove", title, body, children, testId = "empty-state" }) {
  const p = POSES[pose];
  return (
    <div className="card px-6 py-10 sm:py-14 flex flex-col items-center text-center animate-rise" data-testid={testId}>
      <img src={p.src} alt={p.alt} className="w-36 h-36 sm:w-44 sm:h-44 rounded-card object-cover" />
      <h2 className="mt-6 text-2xl sm:text-3xl text-espresso">{title}</h2>
      {body && <p className="mt-2 max-w-md text-cocoa text-sm sm:text-base">{body}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
