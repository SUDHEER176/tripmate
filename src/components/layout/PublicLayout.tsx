import { Outlet, useLocation } from "react-router-dom";
import { PublicNavbar } from "./PublicNavbar";

export function PublicLayout() {
  const location = useLocation();
  const isLandingPage = location.pathname === "/";
  const isAuthPage = location.pathname === "/login" || location.pathname === "/signup";

  return (
    <div className="min-h-screen">
      {!isLandingPage && !isAuthPage && <PublicNavbar />}
      {isLandingPage ? (
        <Outlet />
      ) : (
        <main className="px-4 py-10 sm:py-12">
          <Outlet />
        </main>
      )}
      {!isLandingPage && !isAuthPage && (
        <footer className="border-t border-neutral-200 bg-white px-4 py-10 text-center text-sm text-neutral-500">
          TripMate AI · Personalized itineraries, honest budgets, saved plans.
        </footer>
      )}
    </div>
  );
}
