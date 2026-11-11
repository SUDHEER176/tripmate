import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { AdaptiveLayout } from "@/components/layout/AdaptiveLayout";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { ProtectedRoute } from "@/components/layout/ProtectedRoute";
import { PublicLayout } from "@/components/layout/PublicLayout";
import { AuthProvider } from "@/context/AuthContext";
import { SmoothScrollProvider } from "@/context/SmoothScrollContext";
import { ExplorePage } from "@/pages/ExplorePage";
import { LandingPage } from "@/pages/LandingPage";
import { LoginPage } from "@/pages/LoginPage";
import { MyTripsPage } from "@/pages/MyTripsPage";
import { PlanTripPage } from "@/pages/PlanTripPage";
import { PricingPage } from "@/pages/PricingPage";
import { SignupPage } from "@/pages/SignupPage";
import { TripDetailsPage } from "@/pages/TripDetailsPage";

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <SmoothScrollProvider>
          <Routes>
            {/* Standalone Fullscreen Auth Pages (No Navbar) */}
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />

            {/* Public Pages with Horizontal Navbar */}
            <Route element={<PublicLayout />}>
              <Route path="/" element={<LandingPage />} />
            </Route>

            {/* Shared Pages: dashboard sidebar when signed in, public navbar otherwise */}
            <Route element={<AdaptiveLayout />}>
              <Route path="/explore" element={<ExplorePage />} />
              <Route path="/pricing" element={<PricingPage />} />
            </Route>

            {/* Authenticated Dashboard Pages with Sidebar Navigation */}
            <Route
              element={
                <ProtectedRoute>
                  <DashboardLayout />
                </ProtectedRoute>
              }
            >
              <Route path="/my-trips" element={<MyTripsPage />} />
              <Route path="/plan-trip" element={<PlanTripPage />} />
              <Route path="/trips/:id" element={<TripDetailsPage />} />
            </Route>

            {/* Catch-all redirect */}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </SmoothScrollProvider>
      </BrowserRouter>
    </AuthProvider>
  );
}
