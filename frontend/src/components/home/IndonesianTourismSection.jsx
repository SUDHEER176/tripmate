import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowRight, ArrowUpRight } from "lucide-react";
import { Link } from "react-router-dom";
import { destinations, HIGHLIGHT_LABELS } from "@/lib/destinations";
import { cn, formatCurrency } from "@/lib/utils";
import { Reveal, SectionHeading } from "./shared";

const filters = [
  { id: "all", label: "All" },
  { id: "culture", label: "Culture" },
  { id: "food", label: "Food" },
  { id: "nature", label: "Nature" },
  { id: "relaxation", label: "Slow travel" },
  { id: "history", label: "History" },
];

function DestinationCard({ dest, theme, large = false }) {
  // With a theme selected, show what the city is known for in that theme (its food, its nature...).
  const highlight = theme === "all" ? undefined : dest.highlights[theme];
  const caption = highlight?.caption ?? dest.blurb;

  return (
    <Link
      to={`/plan-trip?destination=${encodeURIComponent(dest.name)}`}
      className={cn(
        "group relative flex h-full flex-col justify-end overflow-hidden rounded-3xl bg-neutral-200 text-white",
        large ? "min-h-[420px] lg:min-h-0" : "min-h-[260px]",
      )}
    >
      <img
        src={highlight?.image ?? dest.image}
        alt={
          highlight
            ? `${caption} — ${dest.name}`
            : `${dest.name}, ${dest.country}`
        }
        loading="lazy"
        className="absolute inset-0 h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
      />
      <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/10 to-transparent" />

      <span className="absolute right-4 top-4 flex h-10 w-10 translate-y-1 items-center justify-center rounded-full bg-white text-neutral-950 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
        <ArrowUpRight className="h-4 w-4" />
      </span>

      <div className={cn("relative", large ? "p-7 sm:p-8" : "p-5")}>
        <p className="text-xs font-medium uppercase tracking-[0.14em] text-white/70">
          {dest.country}
          {highlight && theme !== "all" && (
            <span className="text-white"> · {HIGHLIGHT_LABELS[theme]}</span>
          )}
        </p>
        <h3
          className={cn(
            "mt-1 font-display leading-none tracking-tight",
            large ? "text-4xl sm:text-5xl" : "text-2xl",
          )}
        >
          {dest.name}
        </h3>
        {(large || highlight) && (
          <p
            className={cn(
              "mt-3 max-w-sm leading-relaxed text-white/85",
              large ? "text-sm" : "line-clamp-2 text-xs",
            )}
          >
            {caption}
          </p>
        )}
        <p className="mt-3 text-sm text-white/80">
          from{" "}
          <span className="font-medium text-white">
            {formatCurrency(dest.avgDaily)}
          </span>{" "}
          / day
        </p>
      </div>

      {highlight?.credit && (
        <span className="absolute bottom-1.5 right-3 text-[9px] text-white/55">
          Photo: {highlight.credit}
        </span>
      )}
    </Link>
  );
}

export function IndonesianTourismSection() {
  const [filter, setFilter] = useState("all");

  const list = (
    filter === "all"
      ? destinations
      : destinations.filter((d) => d.tags.includes(filter))
  ).slice(0, 5);
  const [featured, ...rest] = list;

  return (
    <section
      id="about"
      className="scroll-mt-20 bg-white px-5 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Destinations"
          title={
            <>
              Places people are
              <br className="hidden sm:block" /> planning right now
            </>
          }
          description="Start from a city you’ve been meaning to visit. Prices are a typical day for one person — food, transport and a stay included."
        />

        <Reveal
          delay={0.1}
          className="mt-12 flex gap-1 overflow-x-auto border-b border-neutral-200"
        >
          {filters.map((f) => (
            <button
              key={f.id}
              type="button"
              onClick={() => setFilter(f.id)}
              className={cn(
                "relative cursor-pointer whitespace-nowrap px-4 pb-3 pt-1 text-sm transition-colors",
                filter === f.id
                  ? "text-neutral-950"
                  : "text-neutral-500 hover:text-neutral-950",
              )}
            >
              {f.label}
              {filter === f.id && (
                <motion.span
                  layoutId="destination-filter"
                  className="absolute inset-x-0 -bottom-px h-0.5 bg-neutral-950"
                  transition={{ type: "spring", stiffness: 500, damping: 40 }}
                />
              )}
            </button>
          ))}
        </Reveal>

        <AnimatePresence mode="wait">
          <motion.div
            key={filter}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.25 }}
            className="mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:grid-rows-2"
          >
            {featured && (
              <div className="sm:col-span-2 lg:row-span-2">
                <DestinationCard dest={featured} theme={filter} large />
              </div>
            )}
            {rest.map((dest) => (
              <DestinationCard key={dest.name} dest={dest} theme={filter} />
            ))}
          </motion.div>
        </AnimatePresence>

        <Reveal className="mt-10 flex justify-center">
          <Link
            to="/explore"
            className="group inline-flex items-center gap-2 text-sm font-medium text-neutral-950"
          >
            <span className="border-b border-neutral-950/30 pb-0.5 transition-colors group-hover:border-neutral-950">
              See all destinations
            </span>
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>
      </div>
    </section>
  );
}

export default IndonesianTourismSection;
