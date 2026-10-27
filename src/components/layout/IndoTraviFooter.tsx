import React, { useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Facebook, Instagram, Youtube } from "lucide-react";
import { TripMateLogo } from "@/components/brand/TripMateLogo";
import { Reveal } from "@/components/home/shared";

const columns = [
  {
    title: "Product",
    links: [
      { label: "Plan a trip", href: "/plan-trip" },
      { label: "Destinations", href: "/explore" },
      { label: "Pricing", href: "/pricing" },
      { label: "My trips", href: "/my-trips" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "About", href: "/explore" },
      { label: "Journal", href: "/explore" },
      { label: "Careers", href: "/explore" },
      { label: "Contact", href: "/explore" },
    ],
  },
  {
    title: "Help",
    links: [
      { label: "Account", href: "/login" },
      { label: "Privacy", href: "/explore" },
      { label: "Terms", href: "/explore" },
    ],
  },
];

const socials = [
  { label: "Instagram", href: "https://instagram.com", icon: Instagram },
  { label: "Facebook", href: "https://facebook.com", icon: Facebook },
  { label: "YouTube", href: "https://youtube.com", icon: Youtube },
];

export function IndoTraviFooter() {
  const [email, setEmail] = useState("");
  const [subscribed, setSubscribed] = useState(false);

  const handleSubscribe = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    setSubscribed(true);
    setTimeout(() => {
      setEmail("");
      setSubscribed(false);
    }, 3000);
  };

  return (
    <footer id="contact" className="scroll-mt-20 bg-neutral-950 px-5 text-white sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        {/* Closing CTA */}
        <Reveal className="flex flex-col items-start justify-between gap-8 border-b border-white/10 py-20 sm:py-28 lg:flex-row lg:items-end">
          <h2 className="max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            Where are you going next?
          </h2>
          <Link
            to="/plan-trip"
            className="group inline-flex shrink-0 items-center gap-2 rounded-full bg-white px-6 py-3.5 text-sm font-medium text-neutral-950 transition-colors hover:bg-neutral-200"
          >
            Plan a trip
            <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        {/* Links + newsletter */}
        <div className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <TripMateLogo variant="white" className="h-7" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/50">
              A short note every month: new destinations, planning tips, and nothing you didn’t ask for.
            </p>
            <form onSubmit={handleSubscribe} className="mt-6 flex max-w-sm border-b border-white/20 focus-within:border-white">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Your email"
                aria-label="Email address"
                className="w-full bg-transparent py-3 text-sm text-white outline-none placeholder:text-white/40"
              />
              <button
                type="submit"
                className="flex shrink-0 cursor-pointer items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white"
              >
                {subscribed ? (
                  <>
                    <Check className="h-4 w-4" />
                    Subscribed
                  </>
                ) : (
                  "Subscribe"
                )}
              </button>
            </form>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-6 lg:col-start-7">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold uppercase tracking-[0.14em] text-white/40">{col.title}</h4>
                <ul className="mt-5 space-y-3">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link to={link.href} className="text-sm text-white/70 transition-colors hover:text-white">
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="flex flex-col-reverse items-start justify-between gap-6 border-t border-white/10 py-8 sm:flex-row sm:items-center">
          <p className="text-xs text-white/40">© {new Date().getFullYear()} TripMate. All rights reserved.</p>
          <div className="flex gap-2">
            {socials.map((s) => (
              <a
                key={s.label}
                href={s.href}
                target="_blank"
                rel="noreferrer"
                aria-label={s.label}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 text-white/60 transition-colors hover:border-white hover:text-white"
              >
                <s.icon className="h-4 w-4" />
              </a>
            ))}
          </div>
        </div>
      </div>
    </footer>
  );
}

export default IndoTraviFooter;
