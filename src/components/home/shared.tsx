import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const ease = [0.22, 1, 0.36, 1] as const;

// Fades content up once as it scrolls into view.
export function Reveal({
  children,
  delay = 0,
  y = 16,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, delay, ease }}
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
}: {
  eyebrow: string;
  title: ReactNode;
  description?: string;
  align?: "split" | "center";
  className?: string;
}) {
  return (
    <Reveal
      className={cn(
        "flex flex-col gap-5",
        align === "split" ? "lg:flex-row lg:items-end lg:justify-between" : "items-center text-center",
        className,
      )}
    >
      <div className={align === "center" ? "max-w-2xl" : "max-w-2xl"}>
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">{eyebrow}</p>
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
