import { Check, HelpCircle, Sparkles } from "lucide-react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

const plans = [
  {
    name: "Free Explorer",
    price: "₹0",
    cadence: "forever",
    description: "Perfect for occasional vacation planning and weekend getaways.",
    features: [
      "Up to 3 active AI itineraries",
      "Automated day-by-day scheduling",
      "Interactive OpenStreetMap view",
      "Essential budget breakdowns",
      "Manual activity editing and reordering",
      "Browser & Supabase cloud storage",
    ],
    cta: "Get started free",
    to: "/signup",
    popular: false,
  },
  {
    name: "Pro Wanderer",
    price: "₹499",
    cadence: "per month",
    description: "For avid travelers and digital nomads who need unlimited plans.",
    features: [
      "Unlimited AI itinerary generations",
      "Smart multi-city route optimization",
      "Deep category cost breakdown",
      "Interactive Leaflet maps with custom pins",
      "PDF & Print-ready itinerary export",
      "Priority AI model response times",
      "Real-time currency & budget recalculations",
    ],
    cta: "Start 14-day Pro trial",
    to: "/plan-trip",
    popular: true,
  },
  {
    name: "Nomad Lifetime",
    price: "₹7,999",
    cadence: "one-time payment",
    description: "Pay once, travel forever. All future updates and pro features included.",
    features: [
      "Everything in Pro Wanderer forever",
      "Early access to group trip collaboration",
      "Offline map data pack exports",
      "Custom travel notes and attachment storage",
      "Dedicated priority customer support",
      "No recurring fees ever",
    ],
    cta: "Claim Lifetime pass",
    to: "/plan-trip",
    popular: false,
  },
];

const faqs = [
  {
    q: "Can I use TripMate AI completely free?",
    a: "Yes! Our Free Explorer tier gives you access to full AI itinerary generation, budget estimations, and interactive maps without needing any credit card.",
  },
  {
    q: "How accurate are the budget estimations?",
    a: "Our estimations are calculated using real benchmark daily living costs for accommodations, dining, transport, and attractions across global destinations.",
  },
  {
    q: "Can I edit the AI-generated schedule?",
    a: "Absolutely. Every stop in your itinerary can be customized: change the timing, adjust expected costs, write personal notes, or delete and add new stops anytime.",
  },
  {
    q: "Where is my itinerary data stored?",
    a: "Your data is saved securely in Supabase PostgreSQL with Row Level Security (RLS) enabled, meaning only you have access to your personal trips.",
  },
];

export function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl">
      {/* Header */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1.5 rounded-full bg-mist px-3 py-1 text-xs font-semibold text-pine">
          <Sparkles className="h-3.5 w-3.5 text-gold" />
          Transparent, traveler-first pricing
        </div>
        <h1 className="mt-3 font-display text-3xl text-forest sm:text-5xl">
          Simple plans for every journey
        </h1>
        <p className="mx-auto mt-3 max-w-xl text-forest/70">
          Start for free to create your next adventure, or upgrade for unlimited generation and advanced export capabilities.
        </p>
      </div>

      {/* Pricing Cards */}
      <div className="mt-12 grid gap-8 lg:grid-cols-3">
        {plans.map((plan) => (
          <Card
            key={plan.name}
            className={`relative flex flex-col justify-between p-6 sm:p-8 transition-all ${
              plan.popular
                ? "border-2 border-forest bg-white shadow-xl ring-4 ring-forest/5"
                : "border-forest/10 bg-white/70"
            }`}
          >
            {plan.popular && (
              <div className="absolute -top-3.5 left-1/2 -translate-x-1/2">
                <Badge className="bg-forest px-3 py-1 text-xs text-sand font-semibold">
                  Most Popular
                </Badge>
              </div>
            )}

            <div>
              <h3 className="font-display text-2xl text-forest">{plan.name}</h3>
              <p className="mt-2 text-xs text-forest/70">{plan.description}</p>

              <div className="mt-6 flex items-baseline gap-1 border-b border-forest/10 pb-6">
                <span className="font-display text-4xl text-forest">{plan.price}</span>
                <span className="text-xs text-forest/60">/{plan.cadence}</span>
              </div>

              <div className="mt-6 space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wider text-forest/50">
                  What's included:
                </p>
                {plan.features.map((feature) => (
                  <div key={feature} className="flex items-start gap-2.5 text-xs text-forest/80">
                    <Check className="h-4 w-4 shrink-0 text-pine" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-8 pt-6 border-t border-forest/10">
              <Link to={plan.to} className="block">
                <Button
                  className="w-full"
                  variant={plan.popular ? "default" : "outline"}
                >
                  {plan.cta}
                </Button>
              </Link>
            </div>
          </Card>
        ))}
      </div>

      {/* FAQ Section */}
      <div className="mt-20 border-t border-forest/10 pt-16">
        <div className="text-center">
          <div className="inline-flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-pine">
            <HelpCircle className="h-4 w-4" />
            Frequently asked questions
          </div>
          <h2 className="mt-2 font-display text-3xl text-forest">Got questions? We've got answers</h2>
        </div>

        <div className="mt-10 grid gap-6 md:grid-cols-2">
          {faqs.map((faq) => (
            <div key={faq.q} className="rounded-2xl border border-forest/10 bg-white p-5">
              <h4 className="font-semibold text-forest text-sm sm:text-base">{faq.q}</h4>
              <p className="mt-2 text-xs text-forest/70 leading-relaxed">{faq.a}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
