import { useEffect, useState } from "react";

const QUERY = "(max-width: 767px)";

function matches(): boolean {
  return typeof window !== "undefined" && typeof window.matchMedia === "function"
    ? window.matchMedia(QUERY).matches
    : false;
}

/** True on phone-sized viewports, where the side panels collapse. */
export function useNarrowViewport(): boolean {
  const [narrow, setNarrow] = useState(matches);

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return;
    const mql = window.matchMedia(QUERY);
    const onChange = () => setNarrow(mql.matches);
    onChange();
    mql.addEventListener("change", onChange);
    return () => mql.removeEventListener("change", onChange);
  }, []);

  return narrow;
}
