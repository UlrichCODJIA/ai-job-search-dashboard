import { useState } from "react";

export function LogoMark() {
  const [broken, setBroken] = useState(false);
  if (broken) {
    return (
      <span className="relative flex h-2 w-2 shrink-0">
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-signal opacity-60" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-signal" />
      </span>
    );
  }
  return (
    <img
      src="/logo.gif"
      alt=""
      className="h-8 w-8 shrink-0 rounded-full object-contain"
      onError={() => setBroken(true)}
    />
  );
}
