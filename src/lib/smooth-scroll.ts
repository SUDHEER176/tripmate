/**
 * Lightweight, premium inertial smooth scrolling engine inspired by Lenis.
 * Features:
 * - Frame-rate independent physics (smooth at 60Hz, 120Hz, 144Hz+)
 * - Trackpad & mouse wheel delta normalization
 * - 0% CPU consumption when idle
 * - Smooth section navigation & anchor link interceptor
 * - Full accessibility & prefers-reduced-motion compliance
 */

export interface ScrollToOptions {
  offset?: number;
  duration?: number; // in seconds
  immediate?: boolean;
}

export class SmoothScroller {
  private isRunning = false;
  private isScrolling = false;
  private currentScroll = 0;
  private targetScroll = 0;
  private lastTime = 0;
  private rafId: number | null = null;
  private isReducedMotion = false;

  // Animation parameters
  private damping = 8; // responsiveness (higher = quicker stop, lower = more fluid float)
  private animateTarget: {
    start: number;
    end: number;
    startTime: number;
    duration: number;
  } | null = null;

  constructor() {
    if (typeof window === "undefined") return;

    this.isReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    this.currentScroll = window.scrollY || window.pageYOffset || 0;
    this.targetScroll = this.currentScroll;

    this.init();
  }

  private init() {
    if (this.isReducedMotion) return;

    // Listen to wheel events
    window.addEventListener("wheel", this.onWheel, { passive: false });

    // Sync when user drags scrollbar or keyboard navigation triggers native scroll
    window.addEventListener("scroll", this.onNativeScroll, { passive: true });

    // Listen to anchor clicks on document
    document.addEventListener("click", this.onAnchorClick, { capture: true });

    // Sync on resize
    window.addEventListener("resize", this.onResize, { passive: true });
  }

  public destroy() {
    if (typeof window === "undefined") return;

    if (this.rafId) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }

    window.removeEventListener("wheel", this.onWheel);
    window.removeEventListener("scroll", this.onNativeScroll);
    document.removeEventListener("click", this.onAnchorClick, { capture: true });
    window.removeEventListener("resize", this.onResize);
  }

  private getMaxScroll(): number {
    return Math.max(
      0,
      document.documentElement.scrollHeight - window.innerHeight
    );
  }

  private onWheel = (e: WheelEvent) => {
    // Ignore if modal, dropdown, or specific scroll container is being scrolled
    const target = e.target as HTMLElement | null;
    if (target && this.isScrollableElement(target)) {
      return;
    }

    // Don't intercept ctrl+wheel (browser zoom)
    if (e.ctrlKey || e.metaKey) return;

    e.preventDefault();

    // Normalize wheel delta (mouse wheels give ~100px steps; trackpads give small fractions)
    let delta = e.deltaY;
    if (e.deltaMode === 1) delta *= 40; // lines
    if (e.deltaMode === 2) delta *= 800; // pages

    // Trackpads vs discrete wheel
    const isTrackpad = Math.abs(delta) < 45 && e.deltaMode === 0;
    const multiplier = isTrackpad ? 1.0 : 1.15;

    // Interrupt any active smooth animated scrollTo
    this.animateTarget = null;

    const max = this.getMaxScroll();
    this.targetScroll = Math.max(0, Math.min(max, this.targetScroll + delta * multiplier));

    this.startRaf();
  };

  private onNativeScroll = () => {
    // If not currently animating smoothly, keep currentScroll in sync
    if (!this.isScrolling) {
      const scrollY = window.scrollY || window.pageYOffset || 0;
      this.currentScroll = scrollY;
      this.targetScroll = scrollY;
    }
  };

  private onResize = () => {
    const max = this.getMaxScroll();
    this.targetScroll = Math.min(this.targetScroll, max);
    this.currentScroll = Math.min(this.currentScroll, max);
  };

  private onAnchorClick = (e: MouseEvent) => {
    const target = (e.target as HTMLElement)?.closest("a");
    if (!target) return;

    const href = target.getAttribute("href");
    if (href && href.startsWith("#") && href.length > 1) {
      const targetId = href.slice(1);
      const el = document.getElementById(targetId);
      if (el) {
        e.preventDefault();
        this.scrollTo(el, { offset: -20, duration: 1.0 });
      }
    }
  };

  private isScrollableElement(el: HTMLElement): boolean {
    let current: HTMLElement | null = el;
    while (current && current !== document.body && current !== document.documentElement) {
      const style = window.getComputedStyle(current);
      const overflowY = style.overflowY;
      if (
        (overflowY === "auto" || overflowY === "scroll") &&
        current.scrollHeight > current.clientHeight
      ) {
        return true;
      }
      current = current.parentElement;
    }
    return false;
  }

  private startRaf() {
    if (!this.isRunning) {
      this.isRunning = true;
      this.lastTime = performance.now();
      this.rafId = requestAnimationFrame(this.render);
    }
  }

  private render = (currentTime: number) => {
    const dt = Math.min((currentTime - this.lastTime) / 1000, 0.1);
    this.lastTime = currentTime;

    const max = this.getMaxScroll();
    this.targetScroll = Math.max(0, Math.min(max, this.targetScroll));

    // Case 1: Programmatic smooth scrollTo animation curve
    if (this.animateTarget) {
      const elapsed = (currentTime - this.animateTarget.startTime) / 1000;
      const progress = Math.min(1, elapsed / this.animateTarget.duration);
      // Premium easeOutExpo curve
      const eased = progress === 1 ? 1 : 1 - Math.pow(2, -10 * progress);

      this.currentScroll =
        this.animateTarget.start +
        (this.animateTarget.end - this.animateTarget.start) * eased;
      this.targetScroll = this.currentScroll;

      this.isScrolling = true;
      window.scrollTo(0, Math.round(this.currentScroll));

      if (progress >= 1) {
        this.animateTarget = null;
        this.isScrolling = false;
        this.isRunning = false;
        return;
      }
    } else {
      // Case 2: Inertial wheel physics (damping with exponential lerp)
      const diff = this.targetScroll - this.currentScroll;

      if (Math.abs(diff) > 0.4) {
        // Frame-rate independent lerp
        const alpha = 1 - Math.exp(-this.damping * dt);
        this.currentScroll += diff * alpha;

        this.isScrolling = true;
        window.scrollTo(0, Math.round(this.currentScroll));
      } else {
        // Snap to exact target and sleep RAF
        this.currentScroll = this.targetScroll;
        window.scrollTo(0, Math.round(this.currentScroll));
        this.isScrolling = false;
        this.isRunning = false;
        return;
      }
    }

    this.rafId = requestAnimationFrame(this.render);
  };

  /**
   * Smoothly scroll to a target element, pixel number, or selector
   */
  public scrollTo(
    target: number | string | HTMLElement,
    options: ScrollToOptions = {}
  ) {
    if (typeof window === "undefined") return;

    const { offset = 0, duration = 0.9, immediate = false } = options;

    let targetTop = 0;

    if (typeof target === "number") {
      targetTop = target;
    } else if (typeof target === "string") {
      const el = document.querySelector(target) as HTMLElement | null;
      if (el) {
        const rect = el.getBoundingClientRect();
        targetTop = (window.scrollY || window.pageYOffset || 0) + rect.top;
      }
    } else if (target instanceof HTMLElement) {
      const rect = target.getBoundingClientRect();
      targetTop = (window.scrollY || window.pageYOffset || 0) + rect.top;
    }

    targetTop = Math.max(0, Math.min(this.getMaxScroll(), targetTop + offset));

    if (immediate || this.isReducedMotion) {
      this.currentScroll = targetTop;
      this.targetScroll = targetTop;
      this.animateTarget = null;
      window.scrollTo(0, targetTop);
      return;
    }

    this.animateTarget = {
      start: window.scrollY || window.pageYOffset || 0,
      end: targetTop,
      startTime: performance.now(),
      duration: Math.max(0.3, duration),
    };

    this.startRaf();
  }
}

// Global singleton instance
let scrollerInstance: SmoothScroller | null = null;

export function getSmoothScroller(): SmoothScroller {
  if (!scrollerInstance && typeof window !== "undefined") {
    scrollerInstance = new SmoothScroller();
    // Expose on window for easy access / compatibility with Lenis
    (window as unknown as { lenis?: SmoothScroller }).lenis = scrollerInstance;
  }
  return scrollerInstance!;
}
