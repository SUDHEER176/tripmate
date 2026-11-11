import { useAuth } from "@/context/AuthContext";
import { DashboardLayout } from "./DashboardLayout";
import { PublicLayout } from "./PublicLayout";

// Shared pages (Explore, Pricing) stay inside the dashboard shell when signed in.
export function AdaptiveLayout() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-neutral-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-950 border-t-transparent" />
      </div>
    );
  }

  return user ? <DashboardLayout /> : <PublicLayout />;
}
