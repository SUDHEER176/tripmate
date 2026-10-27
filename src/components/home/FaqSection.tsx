import { useState } from "react";
import { Plus } from "lucide-react";
import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Reveal } from "./shared";

const faqs = [
  {
    q: "Is TripMate free?",
    a: "Yes. The free plan lets you create itineraries, see budget breakdowns and use the map. Paid plans add unlimited trips and extras — see pricing for the details.",
  },
  {
    q: "Do I need an account?",
    a: "You can browse destinations without one. To generate and save a trip you’ll need a free account, so your plans are there when you come back.",
  },
  {
    q: "How accurate are the cost estimates?",
    a: "They’re based on typical daily costs for each destination and the stops in your plan. Treat them as a realistic starting point — prices for your exact dates and hotels will vary.",
  },
  {
    q: "Can I change the plan after it’s made?",
    a: "Everything is editable. Add or remove stops, change times and costs, and write your own notes. The budget recalculates as you go.",
  },
  {
    q: "What currency do you use?",
    a: "All budgets and estimates are shown in Indian rupees (₹).",
  },
  {
    q: "Can I take my itinerary offline?",
    a: "You can print any trip, or save it as a PDF from the print dialog, and keep it on your phone.",
  },
];

export function FaqSection() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="scroll-mt-20 bg-stone-50 px-5 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto grid max-w-7xl gap-12 lg:grid-cols-[1fr_1.4fr] lg:gap-20">
        <Reveal>
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-neutral-500">Questions</p>
          <h2 className="mt-3 font-display text-4xl leading-[1.05] tracking-tight text-neutral-950 sm:text-5xl">
            Good to know before you go
          </h2>
          <p className="mt-5 max-w-sm text-base leading-relaxed text-neutral-500">
            Can’t find what you’re looking for?{" "}
            <a
              href="mailto:support@tripmate.ai"
              className="text-neutral-950 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-950"
            >
              Write to us
            </a>{" "}
            or{" "}
            <Link
              to="/pricing"
              className="text-neutral-950 underline decoration-neutral-300 underline-offset-4 transition-colors hover:decoration-neutral-950"
            >
              compare plans
            </Link>
            .
          </p>
        </Reveal>

        <Reveal delay={0.1}>
          <ul className="border-t border-neutral-200">
            {faqs.map((faq, idx) => {
              const isOpen = open === idx;
              return (
                <li key={faq.q} className="border-b border-neutral-200">
                  <button
                    type="button"
                    onClick={() => setOpen(isOpen ? null : idx)}
                    aria-expanded={isOpen}
                    aria-controls={`faq-${idx}`}
                    className="flex w-full cursor-pointer items-center justify-between gap-6 py-6 text-left"
                  >
                    <span className="text-lg font-medium tracking-tight text-neutral-950">{faq.q}</span>
                    <span
                      className={cn(
                        "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-all duration-300",
                        isOpen
                          ? "rotate-45 border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-300 text-neutral-600",
                      )}
                    >
                      <Plus className="h-4 w-4" />
                    </span>
                  </button>
                  <div
                    id={`faq-${idx}`}
                    className={cn(
                      "grid transition-all duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]",
                      isOpen ? "grid-rows-[1fr] opacity-100" : "grid-rows-[0fr] opacity-0",
                    )}
                  >
                    <p className="overflow-hidden pr-14 text-base leading-relaxed text-neutral-500">
                      <span className="block pb-6">{faq.a}</span>
                    </p>
                  </div>
                </li>
              );
            })}
          </ul>
        </Reveal>
      </div>
    </section>
  );
}

export default FaqSection;
