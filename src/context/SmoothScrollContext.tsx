import React, { createContext, useContext, useEffect, useMemo } from "react";
import { useLocation } from "react-router-dom";
import { getSmoothScroller, SmoothScroller, ScrollToOptions } from "@/lib/smooth-scroll";

interface SmoothScrollContextValue {
  scrollTo: (target: number | string | HTMLElement, options?: ScrollToOptions) => void;
  scroller: SmoothScroller | null;
}

const SmoothScrollContext = createContext<SmoothScrollContextValue>({
  scrollTo: () => {},
  scroller: null,
});

export function SmoothScrollProvider({ children }: { children: React.ReactNode }) {
  const location = useLocation();

  useEffect(() => {
    const scroller = getSmoothScroller();
    return () => {
      scroller?.destroy();
    };
  }, []);

  // When route changes, scroll smoothly to top
  useEffect(() => {
    const scroller = getSmoothScroller();
    // Check if there is a hash in the URL like #services
    if (location.hash) {
      const targetId = location.hash.replace("#", "");
      setTimeout(() => {
        const el = document.getElementById(targetId);
        if (el) {
          scroller?.scrollTo(el, { offset: -30, duration: 0.9 });
        }
      }, 100);
    } else {
      scroller?.scrollTo(0, { immediate: true });
    }
  }, [location.pathname, location.hash]);

  const value = useMemo(() => {
    return {
      scrollTo: (target: number | string | HTMLElement, options?: ScrollToOptions) => {
        getSmoothScroller()?.scrollTo(target, options);
      },
      scroller: typeof window !== "undefined" ? getSmoothScroller() : null,
    };
  }, []);

  return (
    <SmoothScrollContext.Provider value={value}>
      {children}
    </SmoothScrollContext.Provider>
  );
}

export function useSmoothScroll() {
  return useContext(SmoothScrollContext);
}
