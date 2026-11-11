import { useEffect, useMemo, useState } from "react";
import {
  ArrowRight,
  Calendar,
  Compass,
  MapPin,
  Plus,
  Search,
  Trash2,
  Users,
  Wallet,
} from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useAuth } from "@/context/AuthContext";
import { deleteTrip, listTrips } from "@/lib/api";
import { getDestinationImageUrl } from "@/lib/destinations";

import { dayCount, formatCurrency, formatDateRange } from "@/lib/utils";

const fallbackImage =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1200&q=80";

export function MyTripsPage() {
  const { user } = useAuth();
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");

  async function loadUserTrips() {
    if (!user) return;
    setLoading(true);
    try {
      const data = await listTrips(user.id);
      setTrips(data);
    } catch (err) {
      console.error("Failed to load trips:", err);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadUserTrips();
  }, [user]);

  async function handleDelete(id, e) {
    e.preventDefault();
    e.stopPropagation();
    if (window.confirm("Are you sure you want to delete this trip?")) {
      try {
        await deleteTrip(id);
      } catch (err) {
        window.alert(
          err instanceof Error ? err.message : "Could not delete the trip.",
        );
      }
      await loadUserTrips();
    }
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return trips;
    return trips.filter(
      (trip) =>
        trip.title.toLowerCase().includes(q) ||
        trip.destination.toLowerCase().includes(q),
    );
  }, [trips, query]);

  const stats = useMemo(() => {
    const totalDays = trips.reduce(
      (sum, trip) => sum + dayCount(trip.start_date, trip.end_date),
      0,
    );
    const totalBudget = trips.reduce(
      (sum, trip) => sum + (trip.total_estimated_cost || trip.budget),
      0,
    );
    const destinations = new Set(
      trips.map((trip) => trip.destination.trim().toLowerCase()),
    ).size;
    return [
      { label: "Saved trips", value: String(trips.length), icon: Compass },
      { label: "Destinations", value: String(destinations), icon: MapPin },
      { label: "Days planned", value: String(totalDays), icon: Calendar },
      {
        label: "Total budget",
        value: formatCurrency(totalBudget),
        icon: Wallet,
      },
    ];
  }, [trips]);

  const firstName = user?.fullName?.split(" ")[0];

  return (
    <div className="mx-auto max-w-6xl space-y-8">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm font-medium text-neutral-500">
            {firstName ? `Welcome back, ${firstName}` : "Welcome back"}
          </p>
          <h1 className="mt-1 font-display text-3xl tracking-tight text-neutral-950 sm:text-4xl">
            Your trips
          </h1>
        </div>

        <Link to="/plan-trip">
          <Button>
            <Plus className="h-4 w-4" />
            Plan a new trip
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="overflow-hidden rounded-2xl border border-neutral-200 bg-white"
            >
              <div className="h-44 animate-pulse bg-neutral-100" />
              <div className="space-y-3 p-5">
                <div className="h-4 w-2/3 animate-pulse rounded bg-neutral-100" />
                <div className="h-3 w-1/2 animate-pulse rounded bg-neutral-100" />
                <div className="h-3 w-1/3 animate-pulse rounded bg-neutral-100" />
              </div>
            </div>
          ))}
        </div>
      ) : trips.length === 0 ? (
        <div className="animate-fade-up rounded-3xl border border-dashed border-neutral-300 bg-white px-6 py-16 text-center">
          <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-950 text-white">
            <Compass className="h-7 w-7" />
          </div>
          <h3 className="mt-5 font-display text-2xl text-neutral-950">
            No trips saved yet
          </h3>
          <p className="mx-auto mt-2 max-w-sm text-sm text-neutral-500">
            Tell TripMate where you want to go and get a day-by-day itinerary
            and budget breakdown in seconds.
          </p>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <Link to="/plan-trip">
              <Button>
                <Plus className="h-4 w-4" />
                Plan your first trip
              </Button>
            </Link>
            <Link to="/explore">
              <Button variant="outline">Browse destinations</Button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            {stats.map((stat) => (
              <div
                key={stat.label}
                className="rounded-2xl border border-neutral-200 bg-white p-4"
              >
                <div className="flex items-center gap-2 text-xs font-medium text-neutral-500">
                  <stat.icon className="h-3.5 w-3.5" />
                  {stat.label}
                </div>
                <p className="mt-2 truncate text-xl font-semibold tracking-tight text-neutral-950 sm:text-2xl">
                  {stat.value}
                </p>
              </div>
            ))}
          </div>

          {/* Search */}
          <div className="relative max-w-sm">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-neutral-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search your trips…"
              className="h-10 w-full rounded-full border border-neutral-200 bg-white pl-10 pr-4 text-sm outline-none transition placeholder:text-neutral-400 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5"
            />
          </div>

          {filtered.length === 0 ? (
            <p className="py-10 text-center text-sm text-neutral-500">
              No trips match “{query}”.
            </p>
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.map((trip, index) => {
                const days = dayCount(trip.start_date, trip.end_date);
                return (
                  <Link
                    key={trip.id}
                    to={`/trips/${trip.id}`}
                    className="animate-fade-up rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/30"
                    style={{ animationDelay: `${Math.min(index, 8) * 50}ms` }}
                  >
                    <Card className="group flex h-full flex-col overflow-hidden transition-all duration-300 hover:-translate-y-1 hover:shadow-xl">
                      <div className="relative h-44 w-full overflow-hidden bg-neutral-100">
                        <img
                          src={getDestinationImageUrl(
                            trip.destination,
                            800,
                            500,
                          )}
                          alt={trip.destination}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                          onError={(e) => {
                            e.currentTarget.src = fallbackImage;
                          }}
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
                        <div className="absolute left-3 top-3 flex gap-1.5">
                          <span className="rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-semibold capitalize text-neutral-900 backdrop-blur">
                            {trip.status}
                          </span>
                          <span className="rounded-full bg-black/40 px-2.5 py-1 text-[11px] font-medium text-white backdrop-blur">
                            {days} {days === 1 ? "day" : "days"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={(e) => handleDelete(trip.id, e)}
                          aria-label="Delete trip"
                          className="absolute right-3 top-3 flex h-8 w-8 cursor-pointer items-center justify-center rounded-full bg-black/40 text-white opacity-100 backdrop-blur transition hover:bg-terracotta sm:opacity-0 sm:group-hover:opacity-100 focus-visible:opacity-100"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                        <div className="absolute inset-x-4 bottom-3 text-white">
                          <div className="flex items-center gap-1.5 text-xs text-white/85">
                            <MapPin className="h-3 w-3" />
                            {trip.destination}
                          </div>
                          <h3 className="mt-0.5 line-clamp-1 font-display text-xl leading-tight">
                            {trip.title}
                          </h3>
                        </div>
                      </div>

                      <div className="flex flex-1 flex-col p-5">
                        <div className="space-y-2 text-sm text-neutral-600">
                          <div className="flex items-center gap-2">
                            <Calendar className="h-4 w-4 text-neutral-400" />
                            {formatDateRange(trip.start_date, trip.end_date)}
                          </div>
                          <div className="flex items-center gap-2">
                            <Users className="h-4 w-4 text-neutral-400" />
                            {trip.travelers}{" "}
                            {trip.travelers === 1 ? "traveler" : "travelers"} ·{" "}
                            <span className="capitalize">{trip.pace} pace</span>
                          </div>
                        </div>

                        {trip.interests.length > 0 && (
                          <div className="mt-4 flex flex-wrap gap-1.5">
                            {trip.interests.slice(0, 4).map((item) => (
                              <span
                                key={item}
                                className="rounded-full border border-neutral-200 px-2.5 py-0.5 text-[11px] font-medium capitalize text-neutral-600"
                              >
                                {item}
                              </span>
                            ))}
                          </div>
                        )}

                        <div className="min-h-5 flex-1" />
                        <div className="flex items-center justify-between border-t border-neutral-100 pt-4">
                          <div>
                            <span className="block text-[11px] font-medium uppercase tracking-wider text-neutral-400">
                              Est. budget
                            </span>
                            <span className="font-semibold text-neutral-950">
                              {formatCurrency(
                                trip.total_estimated_cost || trip.budget,
                              )}
                            </span>
                          </div>
                          <span className="flex items-center gap-1 text-sm font-semibold text-neutral-950">
                            Open
                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                          </span>
                        </div>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
