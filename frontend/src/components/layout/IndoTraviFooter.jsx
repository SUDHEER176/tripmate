import { Link } from "react-router-dom";
import { ArrowRight } from "lucide-react";
import { TripMateLogo } from "@/components/brand/TripMateLogo";
import { Reveal } from "@/components/home/shared";

// Only links that lead somewhere real.
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
    title: "Account",
    links: [
      { label: "Log in", href: "/login" },
      { label: "Sign up", href: "/signup" },
      { label: "Questions", href: "/#faq" },
    ],
  },
];

export function IndoTraviFooter() {
  return (
    <footer
      id="contact"
      className="scroll-mt-20 bg-neutral-950 px-5 text-white sm:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-7xl">
        {/* Closing CTA */}
        <Reveal className="flex flex-col items-start justify-between gap-8 border-b border-white/10 py-20 sm:py-28 lg:flex-row lg:items-end">
          <h2 className="max-w-3xl font-display text-4xl leading-[1.05] tracking-tight sm:text-6xl">
            Where are you going next?
          </h2>
          <Link
            to="/plan-trip"
            className="group inline-flex h-12 shrink-0 items-center gap-2 rounded-full bg-white px-6 text-sm font-medium text-neutral-950 transition-[background-color,transform] duration-150 hover:bg-neutral-200 active:scale-[0.98]"
          >
            Plan a trip
            <ArrowRight className="h-4 w-4 transition-transform duration-150 group-hover:translate-x-0.5" />
          </Link>
        </Reveal>

        {/* Links */}
        <div className="grid gap-12 py-16 md:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <TripMateLogo variant="white" className="h-7" />
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-white/60">
              Day-by-day trip plans with a map of every stop and a budget in
              rupees. Free to start, and every stop stays editable.
            </p>
          </div>

          <div className="grid grid-cols-2 gap-8 lg:col-span-5 lg:col-start-8">
            {columns.map((col) => (
              <div key={col.title}>
                <h4 className="text-sm font-medium text-white/50">
                  {col.title}
                </h4>
                <ul className="mt-4 space-y-1">
                  {col.links.map((link) => (
                    <li key={link.label}>
                      <Link
                        to={link.href}
                        className="inline-flex h-9 items-center text-sm text-white/75 transition-colors duration-150 hover:text-white"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-white/10 py-8">
          <p className="text-xs text-white/50">
            © {new Date().getFullYear()} TripMate
          </p>
        </div>
      </div>
    </footer>
  );
}

export default IndoTraviFooter;
