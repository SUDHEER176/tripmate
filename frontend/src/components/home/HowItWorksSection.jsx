import { useEffect, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Link } from "react-router-dom";
import yellowTravelerImg from "@/assets/images/traveler-yellow-raincoat.jpg";
import { cn } from "@/lib/utils";
import { Reveal, RouteStops, SectionHeading } from "./shared";

const STEP_MS = 6000;

const steps = [
  {
    title: "Tell us the basics",
    description:
      "Where you’re going, for how long, who’s coming and roughly what you want to spend.",
    image: yellowTravelerImg,
    preview: (
      <div className="space-y-2 text-sm">
        <Row label="Destination" value="Lisbon" />
        <Row label="Dates" value="12 – 17 Mar" />
        <Row label="Budget" value="₹80,000" />
      </div>
    ),
  },
  {
    title: "Get a day-by-day plan",
    description:
      "Stops are ordered so you’re not crossing the city twice, with times and a cost for each.",
    image:
      "https://images.unsplash.com/photo-1585208798174-6cedd86e019a?auto=format&fit=crop&w=1400&q=80",
    preview: (
      <div className="text-sm">
        <p className="text-xs font-medium text-neutral-500">Day 2 · Alfama</p>
        <RouteStops
          className="mt-3"
          stops={[
            { time: "09:30", name: "Castelo de São Jorge" },
            { time: "12:30", name: "Lunch at Taberna da Rua" },
            { time: "16:00", name: "Tram 28 to Graça" },
          ]}
        />
      </div>
    ),
  },
  {
    title: "Make it yours",
    description:
      "Swap a museum for a long lunch, change a time, add a stop. The budget updates as you go.",
    image:
      "https://images.unsplash.com/photo-1528127269322-539801943592?auto=format&fit=crop&w=1400&q=80",
    preview: (
      <div className="text-sm">
        <div className="flex items-baseline justify-between">
          <span className="text-neutral-500">Estimated total</span>
          <span className="font-display text-2xl">₹74,200</span>
        </div>
        <div className="mt-3 flex h-2 gap-0.5 overflow-hidden rounded-full">
          <span className="w-[42%] bg-neutral-950" />
          <span className="w-[24%] bg-neutral-600" />
          <span className="w-[14%] bg-neutral-400" />
          <span className="w-[20%] bg-neutral-300" />
        </div>
        <p className="mt-2 text-xs text-emerald-700">₹5,800 under budget</p>
      </div>
    ),
  },
  {
    title: "Take it with you",
    description:
      "Every trip is saved to your account with a map of each day. Print it or open it on your phone.",
    image:
      "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1400&q=80",
    preview: (
      <div className="space-y-2 text-sm">
        <Row label="Jaipur, 4 days" value="Saved" />
        <Row label="Kyoto, 6 days" value="Saved" />
        <Row label="Hoi An, 3 days" value="Draft" />
      </div>
    ),
  },
];

function Row({ label, value }) {
  return (
    <div className="flex items-center justify-between border-b border-neutral-100 pb-2 last:border-0 last:pb-0">
      <span className="text-neutral-500">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  );
}

export function HowItWorksSection() {
  const [active, setActive] = useState(0);
  const [paused, setPaused] = useState(false);
  const reduceMotion = useReducedMotion();
  const autoplay = !paused && !reduceMotion;

  useEffect(() => {
    if (!autoplay) return;
    const id = setTimeout(
      () => setActive((i) => (i + 1) % steps.length),
      STEP_MS,
    );
    return () => clearTimeout(id);
  }, [active, autoplay]);

  const step = steps[active];

  return (
    <section
      id="services"
      className="scroll-mt-20 bg-stone-50 px-5 py-24 sm:px-10 sm:py-32 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="How it works"
          title="From a rough idea to a plan you’d actually follow"
          description="No twenty open tabs. Four steps, and you can change your mind at any of them."
        />

        <div
          className="mt-14 grid items-stretch gap-10 lg:grid-cols-2 lg:gap-16"
          onMouseEnter={() => setPaused(true)}
          onMouseLeave={() => setPaused(false)}
        >
          {/* Visual */}
          <Reveal className="relative order-2 min-h-[440px] overflow-hidden rounded-3xl bg-neutral-200 lg:order-1 lg:min-h-[560px]">
            <AnimatePresence initial={false}>
              <motion.img
                key={step.image}
                src={step.image}
                alt=""
                initial={{ opacity: 0, scale: 1.04 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}
                className="absolute inset-0 h-full w-full object-cover"
              />
            </AnimatePresence>
            <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

            <div className="absolute inset-x-5 bottom-5 sm:inset-x-auto sm:bottom-8 sm:left-8 sm:w-80">
              <AnimatePresence mode="wait">
                <motion.div
                  key={active}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="rounded-2xl bg-white p-5 text-neutral-950 shadow-xl shadow-black/10"
                >
                  {step.preview}
                </motion.div>
              </AnimatePresence>
            </div>
          </Reveal>

          {/* Steps */}
          <div className="order-1 flex flex-col justify-center lg:order-2">
            <ol>
              {steps.map((s, idx) => {
                const isActive = idx === active;
                return (
                  <li
                    key={s.title}
                    className="border-t border-neutral-200 last:border-b"
                  >
                    <Reveal delay={idx * 0.06}>
                      <button
                        type="button"
                        onClick={() => setActive(idx)}
                        aria-current={isActive ? "step" : undefined}
                        className="group relative flex w-full cursor-pointer gap-6 py-6 text-left"
                      >
                        {/* Progress line */}
                        <span className="absolute inset-x-0 -top-px h-px overflow-hidden">
                          {isActive && (
                            <motion.span
                              key={`${active}-${autoplay}`}
                              className="block h-full origin-left bg-neutral-950"
                              initial={{ scaleX: autoplay ? 0 : 1 }}
                              animate={{ scaleX: 1 }}
                              transition={{
                                duration: autoplay ? STEP_MS / 1000 : 0,
                                ease: "linear",
                              }}
                            />
                          )}
                        </span>

                        <span
                          className={cn(
                            "pt-1 font-display text-sm tabular-nums transition-colors",
                            isActive ? "text-neutral-950" : "text-neutral-400",
                          )}
                        >
                          0{idx + 1}
                        </span>
                        <span className="flex-1">
                          <span
                            className={cn(
                              "block text-xl font-medium tracking-tight transition-colors sm:text-2xl",
                              isActive
                                ? "text-neutral-950"
                                : "text-neutral-400 group-hover:text-neutral-700",
                            )}
                          >
                            {s.title}
                          </span>
                          <span
                            className={cn(
                              "grid transition-opacity duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]",
                              isActive
                                ? "mt-2 grid-rows-[1fr] opacity-100"
                                : "grid-rows-[0fr] opacity-0",
                            )}
                          >
                            <span className="overflow-hidden text-base leading-relaxed text-neutral-500">
                              {s.description}
                            </span>
                          </span>
                        </span>
                      </button>
                    </Reveal>
                  </li>
                );
              })}
            </ol>

            <Reveal delay={0.3} className="mt-10">
              <Link
                to="/plan-trip"
                className="inline-flex items-center rounded-full bg-neutral-950 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
              >
                Start planning
              </Link>
            </Reveal>
          </div>
        </div>
      </div>
    </section>
  );
}

export default HowItWorksSection;
