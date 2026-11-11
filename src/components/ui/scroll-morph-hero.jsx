import { useState, useEffect, useMemo, useRef } from "react";

// --- Types ---

// --- FlipCard Component with Pure 3D CSS Transitions ---
const IMG_WIDTH = 60;
const IMG_HEIGHT = 85;

function FlipCard({ src, index, target }) {
  const [flipped, setFlipped] = useState(false);

  return (
    <div
      onClick={() => setFlipped(!flipped)}
      onMouseEnter={() => setFlipped(true)}
      onMouseLeave={() => setFlipped(false)}
      className="cursor-pointer select-none"
      style={{
        position: "absolute",
        width: IMG_WIDTH,
        height: IMG_HEIGHT,
        transform: `translate3d(${target.x}px, ${target.y}px, 0) rotate(${target.rotation}deg) scale(${target.scale})`,
        opacity: target.opacity,
        transformStyle: "preserve-3d",
        perspective: "1000px",
        transition:
          "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1), opacity 0.3s ease",
        willChange: "transform, opacity",
      }}
    >
      <div
        className="relative h-full w-full"
        style={{
          transformStyle: "preserve-3d",
          transform: flipped ? "rotateY(180deg)" : "rotateY(0deg)",
          transition: "transform 0.5s cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      >
        {/* Front Face */}
        <div
          className="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg bg-neutral-100 border border-neutral-200"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
        >
          <img
            src={src}
            alt={`destination-${index}`}
            className="h-full w-full object-cover"
            loading="lazy"
          />
          <div className="absolute inset-0 bg-black/10 hover:bg-transparent transition-colors" />
        </div>

        {/* Back Face (White & Black Theme) */}
        <div
          className="absolute inset-0 h-full w-full overflow-hidden rounded-xl shadow-lg bg-neutral-950 flex flex-col items-center justify-center p-2 border border-neutral-800"
          style={{
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
            transform: "rotateY(180deg)",
          }}
        >
          <div className="text-center">
            <p className="text-[7px] font-bold text-neutral-400 uppercase tracking-widest mb-0.5">
              Explore
            </p>
            <p className="text-[10px] font-semibold text-white">
              Stop #{index + 1}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

// --- Main Hero Component ---
const TOTAL_IMAGES = 20;
const MAX_SCROLL = 3000;

// Curated high quality Unsplash travel & landscape stock images
const DEFAULT_IMAGES = [
  "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1513735492246-483526278b11?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1503614472-8c93d56e92ce?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1613395877344-13d4a8e0d49e?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1502602898657-3e91760cbb34?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1516483638261-f4dbaf036963?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1506744038136-46273834b3fb?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1469854523086-cc02fe5d8800?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1512453979798-5ea266f8880c?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1486299267070-83823f5448dd?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1523906834658-6e24ef2386f9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9?auto=format&fit=crop&w=600&q=80",
  "https://images.unsplash.com/photo-1542314831-068cd1dbfeeb?auto=format&fit=crop&w=600&q=80",
];

const lerp = (start, end, t) => start * (1 - t) + end * t;

export default function IntroAnimation({
  title = "The future of travel is built on AI.",
  subtitle = "SCROLL TO EXPLORE DESTINATIONS",
  badge = "Explore Global Blueprints",
  images = DEFAULT_IMAGES,
  className = "",
}) {
  const [introPhase, setIntroPhase] = useState("scatter");
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  const containerRef = useRef(null);

  // Virtual scroll & animation states
  const [scrollVal, setScrollVal] = useState(0);
  const targetScroll = useRef(0);
  const currentScroll = useRef(0);

  // Mouse parallax
  const [parallaxX, setParallaxX] = useState(0);
  const targetMouseX = useRef(0);
  const currentMouseX = useRef(0);

  // Track container size
  useEffect(() => {
    if (!containerRef.current) return;

    const handleResize = (entries) => {
      for (const entry of entries) {
        setContainerSize({
          width: entry.contentRect.width,
          height: entry.contentRect.height,
        });
      }
    };

    const observer = new ResizeObserver(handleResize);
    observer.observe(containerRef.current);

    setContainerSize({
      width: containerRef.current.offsetWidth,
      height: containerRef.current.offsetHeight,
    });

    return () => observer.disconnect();
  }, []);

  // Smooth animation loop using requestAnimationFrame (spring/lerp)
  useEffect(() => {
    let animId;

    const tick = () => {
      // Smooth scroll interpolation
      currentScroll.current = lerp(
        currentScroll.current,
        targetScroll.current,
        0.08,
      );
      setScrollVal(currentScroll.current);

      // Smooth mouse parallax interpolation
      currentMouseX.current = lerp(
        currentMouseX.current,
        targetMouseX.current,
        0.06,
      );
      setParallaxX(currentMouseX.current);

      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Wheel and touch listeners
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleWheel = (e) => {
      e.preventDefault();
      targetScroll.current = Math.min(
        Math.max(targetScroll.current + e.deltaY * 1.5, 0),
        MAX_SCROLL,
      );
    };

    let touchStartY = 0;
    const handleTouchStart = (e) => {
      touchStartY = e.touches[0].clientY;
    };
    const handleTouchMove = (e) => {
      const touchY = e.touches[0].clientY;
      const deltaY = touchStartY - touchY;
      touchStartY = touchY;
      targetScroll.current = Math.min(
        Math.max(targetScroll.current + deltaY * 2, 0),
        MAX_SCROLL,
      );
    };

    container.addEventListener("wheel", handleWheel, { passive: false });
    container.addEventListener("touchstart", handleTouchStart, {
      passive: false,
    });
    container.addEventListener("touchmove", handleTouchMove, {
      passive: false,
    });

    return () => {
      container.removeEventListener("wheel", handleWheel);
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
    };
  }, []);

  // Mouse move listener for parallax
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const handleMouseMove = (e) => {
      const rect = container.getBoundingClientRect();
      const relativeX = e.clientX - rect.left;
      const normalizedX = (relativeX / rect.width) * 2 - 1;
      targetMouseX.current = normalizedX * 100;
    };

    container.addEventListener("mousemove", handleMouseMove);
    return () => container.removeEventListener("mousemove", handleMouseMove);
  }, []);

  // Intro Sequence Timers
  useEffect(() => {
    const timer1 = setTimeout(() => setIntroPhase("line"), 500);
    const timer2 = setTimeout(() => setIntroPhase("circle"), 2200);
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

  // Scatter positions
  const scatterPositions = useMemo(() => {
    return images.map(() => ({
      x: (Math.random() - 0.5) * 1400,
      y: (Math.random() - 0.5) * 900,
      rotation: (Math.random() - 0.5) * 180,
      scale: 0.6,
      opacity: 0,
    }));
  }, [images]);

  // Derived morph & rotate values from smooth scroll
  const morphValue = Math.min(Math.max(scrollVal / 600, 0), 1);
  const rotateValue = Math.min(Math.max((scrollVal - 600) / 2400, 0), 1) * 360;

  // Header / Arc text opacities
  const introOpacity =
    introPhase === "circle" ? Math.max(1 - morphValue * 2, 0) : 0;
  const contentOpacity = Math.min(Math.max((morphValue - 0.7) / 0.3, 0), 1);
  const contentY = (1 - contentOpacity) * 20;

  return (
    <div
      ref={containerRef}
      className={`relative w-full h-full bg-white text-neutral-950 overflow-hidden select-none ${className}`}
    >
      {/* Background Radial Glow */}
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_40%,rgba(0,0,0,0.03),transparent_70%)]" />

      {/* Main Container */}
      <div className="flex h-full w-full flex-col items-center justify-center perspective-1000">
        {/* Intro Text (Fades out as user scrolls) */}
        <div
          className="absolute z-0 flex flex-col items-center justify-center text-center pointer-events-none top-1/2 -translate-y-1/2 px-4 transition-all duration-300"
          style={{
            opacity: introOpacity,
            transform: `translateY(-50%) scale(${1 - morphValue * 0.2})`,
          }}
        >
          <h2 className="text-2xl font-display font-medium tracking-tight text-neutral-950 md:text-5xl">
            {title}
          </h2>
          <p className="mt-4 text-xs font-bold tracking-[0.25em] text-neutral-500 uppercase">
            {subtitle}
          </p>
        </div>

        {/* Arc Active Content (Fades in when morphValue > 0.7) */}
        <div
          className="absolute top-[8%] z-10 flex flex-col items-center justify-center text-center pointer-events-none px-4 transition-all duration-300"
          style={{
            opacity: contentOpacity,
            transform: `translateY(${contentY}px)`,
          }}
        >
          <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 bg-neutral-100 px-3.5 py-1 text-xs font-semibold uppercase tracking-wider text-neutral-900 shadow-sm">
            {badge}
          </div>
          <h3 className="mt-3 text-3xl md:text-5xl font-display font-semibold text-neutral-950 tracking-tight">
            Curated Itineraries, Reimagined
          </h3>
          <p className="mt-2 text-xs md:text-sm text-neutral-600 max-w-lg leading-relaxed">
            Scroll across the arc to reveal bespoke destinations. Designed with
            intelligence, crafted for memory.
          </p>
        </div>

        {/* Cards Visual Carousel */}
        <div className="relative flex items-center justify-center w-full h-full pointer-events-auto">
          {images.slice(0, TOTAL_IMAGES).map((src, i) => {
            let target = { x: 0, y: 0, rotation: 0, scale: 1, opacity: 1 };

            if (introPhase === "scatter") {
              target = scatterPositions[i] ?? {
                x: 0,
                y: 0,
                rotation: 0,
                scale: 1,
                opacity: 0,
              };
            } else if (introPhase === "line") {
              const lineSpacing = 68;
              const lineTotalWidth = TOTAL_IMAGES * lineSpacing;
              const lineX = i * lineSpacing - lineTotalWidth / 2;
              target = { x: lineX, y: 0, rotation: 0, scale: 1, opacity: 1 };
            } else {
              const isMobile = containerSize.width < 768;
              const minDimension = Math.min(
                containerSize.width,
                containerSize.height,
              );

              // 1. Circle Position
              const circleRadius = Math.min(minDimension * 0.35, 340);
              const circleAngle = (i / TOTAL_IMAGES) * 360;
              const circleRad = (circleAngle * Math.PI) / 180;
              const circlePos = {
                x: Math.cos(circleRad) * circleRadius,
                y: Math.sin(circleRad) * circleRadius,
                rotation: circleAngle + 90,
              };

              // 2. Rainbow Arc Position
              const baseRadius = Math.min(
                containerSize.width,
                containerSize.height * 1.5,
              );
              const arcRadius = baseRadius * (isMobile ? 1.4 : 1.1);
              const arcApexY = containerSize.height * (isMobile ? 0.35 : 0.25);
              const arcCenterY = arcApexY + arcRadius;
              const spreadAngle = isMobile ? 100 : 130;
              const startAngle = -90 - spreadAngle / 2;
              const step = spreadAngle / (TOTAL_IMAGES - 1);

              const scrollProgress = Math.min(
                Math.max(rotateValue / 360, 0),
                1,
              );
              const maxRotation = spreadAngle * 0.8;
              const boundedRotation = -scrollProgress * maxRotation;

              const currentArcAngle = startAngle + i * step + boundedRotation;
              const arcRad = (currentArcAngle * Math.PI) / 180;

              const arcPos = {
                x: Math.cos(arcRad) * arcRadius + parallaxX,
                y: Math.sin(arcRad) * arcRadius + arcCenterY,
                rotation: currentArcAngle + 90,
                scale: isMobile ? 1.4 : 1.8,
              };

              // 3. Interpolate between circle and rainbow arc
              target = {
                x: lerp(circlePos.x, arcPos.x, morphValue),
                y: lerp(circlePos.y, arcPos.y, morphValue),
                rotation: lerp(circlePos.rotation, arcPos.rotation, morphValue),
                scale: lerp(1, arcPos.scale, morphValue),
                opacity: 1,
              };
            }

            return (
              <FlipCard
                key={i}
                src={src}
                index={i}
                total={TOTAL_IMAGES}
                target={target}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
