import { Coins, Lock, MapPinned, RefreshCw } from "lucide-react";
import { Reveal, SectionHeading } from "./shared";

// Every point here describes what the product actually does
// (see backend/supabase/functions/_shared/budget.js and the RLS policies).
const points = [
  {
    icon: MapPinned,
    title: "Typical costs for each city",
    text: "Estimates start from what an ordinary day costs in that destination: food, local transport and a place to stay.",
  },
  {
    icon: Coins,
    title: "A price on every stop",
    text: "Each activity is counted per person, per night or for the whole group, and never twice.",
  },
  {
    icon: RefreshCw,
    title: "Updated as you edit",
    text: "Move, swap or delete a stop and the day total and trip budget change straight away.",
  },
  {
    icon: Lock,
    title: "Private to your account",
    text: "Saved trips are tied to your login, and the database only lets you open your own.",
  },
];

export function BudgetTrustSection() {
  return (
    <section className="bg-stone-50 px-5 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Behind the numbers"
          title="How TripMate works out your budget"
          description="Estimates you can follow, in rupees. Treat them as a realistic starting point, since prices for your exact dates will vary."
        />

        <div className="mt-14 grid gap-x-8 gap-y-10 border-t border-neutral-950/8 pt-10 sm:grid-cols-2 lg:grid-cols-4">
          {points.map((point, idx) => (
            <Reveal key={point.title} delay={idx * 0.05}>
              <point.icon
                className="h-[18px] w-[18px] text-neutral-500"
                strokeWidth={1.5}
              />
              <h3 className="mt-4 text-lg font-medium tracking-tight text-neutral-950">
                {point.title}
              </h3>
              <p className="mt-2 text-base leading-relaxed text-neutral-500">
                {point.text}
              </p>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  );
}

export default BudgetTrustSection;
