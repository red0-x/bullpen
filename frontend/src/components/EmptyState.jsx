"use client";

import { Mascot } from "./Mascot";

export function EmptyState({ pose = "glove", motion = "bob", title, body, children, testId = "empty-state" }) {
  return (
    <div className="card px-6 py-10 sm:py-14 flex flex-col items-center text-center animate-rise" data-testid={testId}>
      <Mascot pose={pose} motion={motion} className="w-36 h-36 sm:w-44 sm:h-44" framed={["glove", "sleep", "head"].includes(pose)} />
      <h2 className="mt-6 text-2xl sm:text-3xl text-espresso">{title}</h2>
      {body && <p className="mt-2 max-w-md text-cocoa text-sm sm:text-base">{body}</p>}
      {children && <div className="mt-6 flex flex-wrap justify-center gap-3">{children}</div>}
    </div>
  );
}
