import { createContext, useContext, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";

// Uses the browser's normal scrolling. scrollTo() is kept for buttons and
// links that jump to a section, e.g. scrollTo("#about", { offset: -25 }).

function scrollToTarget(target, { offset = 0, immediate = false } = {}) {
  let top;
  if (typeof target === "number") {
    top = target;
  } else {
    const el =
      typeof target === "string" ? document.querySelector(target) : target;
    if (!el) return;
    top = el.getBoundingClientRect().top + window.scrollY;
  }
  window.scrollTo({
    top: Math.max(0, top + offset),
    behavior: immediate ? "instant" : "smooth",
  });
}

const SmoothScrollContext = createContext({ scrollTo: scrollToTarget });

export function SmoothScrollProvider({ children }) {
  const location = useLocation();

  // New page: start at the top. Link with #section: go to that section.
  useEffect(() => {
    if (location.hash) {
      const id = decodeURIComponent(location.hash.slice(1));
      const timer = setTimeout(() => {
        const el = document.getElementById(id);
        if (el) scrollToTarget(el, { offset: -30 });
      }, 100);
      return () => clearTimeout(timer);
    }
    scrollToTarget(0, { immediate: true });
  }, [location.pathname, location.hash]);

  const value = useMemo(() => ({ scrollTo: scrollToTarget }), []);

  return (
    <SmoothScrollContext.Provider value={value}>
      {children}
    </SmoothScrollContext.Provider>
  );
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}
