import { CreditCard, LogOut, Map, Plus, Route } from "lucide-react";
import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { TripMateLogo } from "@/components/brand/TripMateLogo";
import { DemoBanner } from "@/components/DemoBanner";
import { cn } from "@/lib/utils";

const nav = [
  { to: "/my-trips", label: "My trips", icon: Route },
  { to: "/plan-trip", label: "Plan a trip", icon: Plus },
  { to: "/explore", label: "Explore", icon: Map },
  { to: "/pricing", label: "Pricing", icon: CreditCard },
];

function initials(name?: string, email?: string) {
  const source = name?.trim() || email?.split("@")[0] || "?";
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

export function DashboardLayout() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();

  async function handleSignOut() {
    await signOut();
    navigate("/");
  }

  return (
    <div className="min-h-screen bg-neutral-50 md:grid md:grid-cols-[256px_1fr]">
      <aside className="hidden md:sticky md:top-0 md:flex md:h-screen md:flex-col bg-neutral-950 text-white">
        <div className="px-6 py-7">
          <TripMateLogo variant="white" className="h-7" />
        </div>

        <p className="px-6 pb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-white/40">
          Menu
        </p>
        <nav className="flex flex-1 flex-col gap-1 px-3">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                cn(
                  "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-white/60 transition-colors hover:bg-white/5 hover:text-white",
                  isActive && "bg-white/10 text-white",
                )
              }
            >
              {({ isActive }) => (
                <>
                  <span
                    className={cn(
                      "absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-white transition-opacity",
                      isActive ? "opacity-100" : "opacity-0",
                    )}
                  />
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="m-3 rounded-2xl border border-white/10 bg-white/5 p-3">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-xs font-bold text-neutral-950">
              {initials(user?.fullName, user?.email)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{user?.fullName || "Traveler"}</p>
              <p className="truncate text-xs text-white/50">{user?.email}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleSignOut}
            className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-xl border border-white/10 py-2 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <LogOut className="h-3.5 w-3.5" />
            Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0">
        <header className="sticky top-0 z-30 border-b border-neutral-200 bg-white/90 backdrop-blur md:hidden">
          <div className="flex items-center justify-between px-4 py-3">
            <TripMateLogo variant="dark" className="h-6" />
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-full border border-neutral-200 text-neutral-700 hover:bg-neutral-100"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
          <nav className="flex gap-1.5 overflow-x-auto px-3 pb-2.5">
            {nav.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-1.5 text-xs font-medium text-neutral-600 transition-colors",
                    isActive ? "bg-neutral-950 text-white" : "bg-neutral-100 hover:bg-neutral-200",
                  )
                }
              >
                <item.icon className="h-3.5 w-3.5" />
                {item.label}
              </NavLink>
            ))}
          </nav>
        </header>

        <main className="min-h-screen px-4 py-6 sm:px-6 md:px-10 md:py-10">
          <div className="mx-auto max-w-6xl">
            <DemoBanner />
          </div>
          <Outlet />
        </main>
      </div>
    </div>
  );
}
