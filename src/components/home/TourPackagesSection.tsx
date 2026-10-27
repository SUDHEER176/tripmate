import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { formatCurrency } from "@/lib/utils";
import { Reveal, SectionHeading } from "./shared";

type TripIdea = {
  title: string;
  destination: string;
  days: number;
  budget: number;
  pace: string;
  highlights: string[];
  image: string;
};

const ideas: TripIdea[] = [
  {
    title: "A long weekend in Jaipur",
    destination: "Jaipur",
    days: 3,
    budget: 18000,
    pace: "Relaxed",
    highlights: ["Amber Fort at opening", "Johari Bazaar", "Rooftop dinner"],
    image: "https://images.unsplash.com/photo-1477587458883-47145ed94245?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Five slow days in Bali",
    destination: "Bali",
    days: 5,
    budget: 45000,
    pace: "Relaxed",
    highlights: ["Tegallalang rice terraces", "Ubud cooking class", "Uluwatu sunset"],
    image: "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "A week of temples in Kyoto",
    destination: "Kyoto",
    days: 7,
    budget: 95000,
    pace: "Moderate",
    highlights: ["Fushimi Inari at dawn", "Nishiki Market", "Day trip to Nara"],
    image: "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
  },
];

export function TourPackagesSection() {
  return (
    <section id="tour" className="scroll-mt-20 bg-white px-5 py-24 sm:px-10 sm:py-32 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <SectionHeading
          eyebrow="Trip ideas"
          title="Not sure where to start?"
          description="Open one of these and change whatever you like. They’re starting points, not packages."
        />

        <div className="mt-14 grid gap-x-6 gap-y-12 md:grid-cols-3">
          {ideas.map((idea, idx) => {
            const params = new URLSearchParams({
              destination: idea.destination,
              days: String(idea.days),
              budget: String(idea.budget),
            });
            return (
              <Reveal key={idea.title} delay={idx * 0.08}>
                <Link to={`/plan-trip?${params}`} className="group block">
                  <div className="relative aspect-[4/5] overflow-hidden rounded-3xl bg-neutral-100">
                    <img
                      src={idea.image}
                      alt={idea.destination}
                      loading="lazy"
                      className="h-full w-full object-cover transition-transform duration-[1.2s] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04]"
                    />
                    <span className="absolute left-4 top-4 rounded-full bg-white px-3 py-1 text-xs font-medium text-neutral-950">
                      {idea.days} days · {idea.pace}
                    </span>
                  </div>

                  <div className="mt-5 flex items-start justify-between gap-4">
                    <h3 className="font-display text-2xl leading-tight tracking-tight text-neutral-950">
                      {idea.title}
                    </h3>
                    <ArrowRight className="mt-1.5 h-5 w-5 shrink-0 text-neutral-400 transition-all duration-300 group-hover:translate-x-1 group-hover:text-neutral-950" />
                  </div>
                  <p className="mt-2 text-sm text-neutral-500">{idea.highlights.join(" · ")}</p>
                  <p className="mt-3 text-sm text-neutral-950">
                    About <span className="font-medium">{formatCurrency(idea.budget)}</span> per person
                  </p>
                </Link>
              </Reveal>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default TourPackagesSection;
