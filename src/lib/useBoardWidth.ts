"use client";

import { useEffect, useState } from "react";

/** Responsive board size — larger on desktop. */
export function useBoardWidth(max = 720) {
  const [width, setWidth] = useState(Math.min(560, max));

  useEffect(() => {
    function update() {
      const sideReserve = window.innerWidth >= 1100 ? 340 : 48;
      const available = window.innerWidth - sideReserve;
      const byHeight = window.innerHeight - 140;
      const size = Math.min(max, available, byHeight);
      setWidth(Math.max(300, Math.floor(size)));
    }
    update();
    window.addEventListener("resize", update);
    return () => window.removeEventListener("resize", update);
  }, [max]);

  return width;
}
