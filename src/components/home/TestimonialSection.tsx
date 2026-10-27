import { useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, ArrowRight } from "lucide-react";
import avatarOne from "@/assets/images/testimonial-avatar.jpg";
import { Reveal } from "./shared";

type Testimonial = {
  name: string;
  trip: string;
  avatar: string;
  quote: string;
};

const testimonials: Testimonial[] = [
  {
    name: "Donald Sullivan",
    trip: "6 days in Kyoto",
    avatar: avatarOne,
    quote:
      "I usually spend weeks on spreadsheets before a trip. This got me a plan I mostly kept in one evening, and the daily budget was closer to reality than my own guesses.",
  },
  {
    name: "Maya Wijaya",
    trip: "5 days in Bali",
    avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80",
    quote:
      "The best part is that nothing is locked in. I moved the cooking class, dropped a temple, and the costs just updated. It felt like planning with a friend who knows the island.",
  },
  {
    name: "Lukas Weber",
    trip: "4 days in Jaipur",
    avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=400&q=80",
    quote:
      "Having each day on a map stopped us from zig-zagging across the city. We saw more and spent less time in autos — which my legs appreciated.",
  },
];

export function TestimonialSection() {
  const [[index, direction], setState] = useState<[number, number]>([0, 1]);
  const current = testimonials[index];

  const go = (dir: number) =>
    setState(([i]) => [(i + dir + testimonials.length) % testimonials.length, dir]);

  return (
    <section className="bg-stone-50 px-5 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-5xl">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">From travelers</p>
        </Reveal>

        <div className="relative mt-8 min-h-[260px] sm:min-h-[220px]">
          <AnimatePresence mode="wait" custom={direction}>
            <motion.figure
              key={index}
              custom={direction}
              initial={{ opacity: 0, x: direction * 24 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: direction * -24 }}
              transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            >
              <blockquote className="font-display text-2xl leading-snug tracking-tight text-neutral-950 sm:text-4xl sm:leading-[1.2]">
                “{current.quote}”
              </blockquote>
              <figcaption className="mt-8 flex items-center gap-4">
                <img
                  src={current.avatar}
                  alt=""
                  loading="lazy"
                  className="h-12 w-12 rounded-full object-cover grayscale"
                />
                <div>
                  <p className="font-medium text-neutral-950">{current.name}</p>
                  <p className="text-sm text-neutral-500">{current.trip}</p>
                </div>
              </figcaption>
            </motion.figure>
          </AnimatePresence>
        </div>

        <div className="mt-10 flex items-center justify-between border-t border-neutral-200 pt-6">
          <span className="text-sm tabular-nums text-neutral-500">
            {String(index + 1).padStart(2, "0")} / {String(testimonials.length).padStart(2, "0")}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => go(-1)}
              aria-label="Previous testimonial"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition-colors hover:border-neutral-950 hover:bg-neutral-950 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() => go(1)}
              aria-label="Next testimonial"
              className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-full border border-neutral-300 text-neutral-700 transition-colors hover:border-neutral-950 hover:bg-neutral-950 hover:text-white"
            >
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

export default TestimonialSection;
