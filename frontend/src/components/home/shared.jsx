import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1];

// Fades content up once as it scrolls into view.
export function Reveal({ children, delay = 0, y = 12, className }) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.5, delay, ease }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

export function SectionHeading({
  eyebrow,
  title,
  description,
  align = "split",
  className,
}) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-5",
        align === "split"
          ? "lg:flex-row lg:items-end lg:justify-between"
          : "items-center text-center",
        className,
      )}
    >
      <div className={align === "center" ? "max-w-2xl" : "max-w-2xl"}>
        <p className="text-sm font-medium text-neutral-500">
          {eyebrow}
        </p>
        <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-neutral-950 sm:text-5xl">
          {title}
        </h2>
      </div>
      {description && (
        <p
          className={cn(
            "text-base leading-relaxed text-neutral-500",
            align === "split" ? "max-w-sm lg:pb-1.5" : "max-w-xl",
          )}
        >
          {description}
        </p>
      )}
    </Reveal>
  );
}

// Signature detail: a day's stops as numbered dots joined by a route line.
// Used in the hero itinerary card and in "How it works", nowhere else.
export function RouteStops({ stops, tone = "light", className }) {
  return (
    <ol className={cn("relative", className)}>
      {stops.map((stop, idx) => (
        <li
          key={stop.name}
          className="relative flex items-start gap-3 pb-4 last:pb-0"
        >
          {idx < stops.length - 1 && (
            <span
              aria-hidden
              className="absolute bottom-0 left-[9.5px] top-5 w-px bg-neutral-200"
            />
          )}
          <span
            className={cn(
              "relative flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-medium tabular-nums",
              tone === "light"
                ? "bg-neutral-950 text-white"
                : "bg-white text-neutral-950",
            )}
          >
            {idx + 1}
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-medium text-neutral-950">
              {stop.name}
            </span>
            <span className="block text-xs tabular-nums text-neutral-500">
              {stop.time}
              {stop.note ? ` · ${stop.note}` : ""}
            </span>
          </span>
          {stop.cost && (
            <span className="shrink-0 text-sm tabular-nums text-neutral-700">
              {stop.cost}
            </span>
          )}
        </li>
      ))}
    </ol>
  );
}
