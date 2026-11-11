import { Link, NavLink } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "@/context/AuthContext";
import { cn } from "@/lib/utils";

import { TripMateLogo } from "@/components/brand/TripMateLogo";

export function PublicNavbar() {
  const { user } = useAuth();
  const [language, setLanguage] = useState("en");

  const navItems = [
    { label: "About", to: "/#about" },
    { label: "Services", to: "/#services" },
    { label: "Tour", to: "/#tour" },
    { label: "Blog", to: "/#blog" },
    { label: "Contact", to: "/#contact" },
  ];

  return (
    <header className="sticky top-0 z-40 border-b border-neutral-200/80 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-6 sm:px-10">
        {/* Brand: TripMate */}
        <TripMateLogo variant="dark" className="h-7 sm:h-8" />

        {/* Center Pill Navigation */}
        <nav className="hidden md:flex items-center rounded-full bg-neutral-100/90 hover:bg-neutral-100 border border-neutral-200/60 px-7 py-2 shadow-sm transition-all">
          <div className="flex items-center gap-7 lg:gap-8 text-sm font-medium">
            {navItems.map((item, idx) => (
              <NavLink
                key={`${item.label}-${idx}`}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "transition-colors text-neutral-600 hover:text-neutral-950",
                    isActive &&
                      !item.to.includes("#") &&
                      "text-neutral-950 font-semibold",
                  )
                }
              >
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Right Actions: Language Switcher + Login */}
        <div className="flex items-center gap-3 sm:gap-4">
          <div className="flex items-center rounded-full bg-neutral-100 border border-neutral-200/60 p-1 text-xs font-semibold text-neutral-600 shadow-sm">
            <button
              type="button"
              onClick={() => setLanguage("de")}
              className={`rounded-full px-2.5 py-1 transition-all cursor-pointer ${
                language === "de"
                  ? "bg-white text-neutral-950 font-bold shadow-sm"
                  : "text-neutral-500 hover:text-neutral-950"
              }`}
            >
              De
            </button>
            <button
              type="button"
              onClick={() => setLanguage("en")}
              className={`rounded-full px-2.5 py-1 transition-all cursor-pointer ${
                language === "en"
                  ? "bg-white text-neutral-950 font-bold shadow-sm"
                  : "text-neutral-500 hover:text-neutral-950"
              }`}
            >
              En
            </button>
          </div>

          {user ? (
            <Link
              to="/my-trips"
              className="rounded-full bg-neutral-950 text-white font-medium px-6 py-2 text-sm shadow-md hover:bg-neutral-800 transition-all"
            >
              My Trips
            </Link>
          ) : (
            <Link
              to="/login"
              className="rounded-full bg-neutral-950 text-white font-medium px-7 py-2 text-sm shadow-md hover:bg-neutral-800 transition-all cursor-pointer"
            >
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
