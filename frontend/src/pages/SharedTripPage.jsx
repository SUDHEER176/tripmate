import { useEffect, useState } from "react";
import { Calendar, Clock, Info, Link2Off, MapPin, Users, Wallet } from "lucide-react";
import { Link, useParams } from "react-router-dom";
import TripMap from "@/components/trips/TripMap";
import { WeatherChip, WeatherLine } from "@/components/trips/WeatherBadge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getSharedTrip } from "@/lib/api";
import { findDestination, getDestinationImageUrl } from "@/lib/destinations";
import { cn, dayCount, formatCurrency, formatDate, formatDateRange } from "@/lib/utils";
import { useTripWeather } from "@/lib/weather";

const fallbackImage =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80";

/** Read-only trip page for anyone with a share link. */
export function SharedTripPage() {
  const { shareId } = useParams();
  const [trip, setTrip] = useState(undefined);
  const [error, setError] = useState(null);
  const [activeDay, setActiveDay] = useState(0);

  useEffect(() => {
    setTrip(undefined);
    setError(null);
    getSharedTrip(shareId)
      .then(setTrip)
      .catch((err) => setError(err instanceof Error ? err.message : "Could not load this trip."));
  }, [shareId]);

  useEffect(() => {
    if (trip?.title) document.title = `${trip.title} · TripMate`;
  }, [trip]);

  const dest = trip ? findDestination(trip.destination) : null;
  const lat = trip?.destination_lat ?? dest?.lat ?? null;
  const lng = trip?.destination_lng ?? dest?.lng ?? null;
  const weather = useTripWeather(lat, lng, trip?.start_date, trip?.end_date);

  if (trip === undefined && !error) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <div className="h-72 animate-pulse rounded-3xl bg-neutral-200" />
        <div className="h-80 animate-pulse rounded-2xl bg-neutral-200" />
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
          <Link2Off className="h-6 w-6" />
        </div>
        <h1 className="mt-4 font-display text-2xl text-neutral-950">
          {error ? "Something went wrong" : "This link isn't active"}
        </h1>
        <p className="mt-2 text-sm text-neutral-500">
          {error ?? "The trip owner may have turned off sharing. Ask them for a new link."}
        </p>
        <Link to="/" className="mt-6 inline-block">
          <Button>Plan your own trip</Button>
        </Link>
      </div>
    );
  }

  const days = dayCount(trip.start_date, trip.end_date);
  const day = trip.itinerary_days[activeDay] ?? trip.itinerary_days[0];
  const allActivities = trip.itinerary_days.flatMap((d) => d.activities);
  const mapActivities = day?.activities.some((a) => a.lat != null) ? day.activities : allActivities;
  const facts = [
    { icon: Calendar, label: "Dates", value: formatDateRange(trip.start_date, trip.end_date) },
    { icon: Clock, label: "Duration", value: `${days} ${days === 1 ? "day" : "days"}` },
    { icon: Users, label: "Travelers", value: String(trip.travelers) },
    { icon: Wallet, label: "Per traveler", value: formatCurrency(trip.cost_per_traveler) },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-8 pb-10">
      <div className="relative overflow-hidden rounded-3xl bg-neutral-950 text-white">
        <img
          src={getDestinationImageUrl(trip.destination, 1600, 700)}
          alt={trip.destination}
          className="absolute inset-0 h-full w-full object-cover opacity-60"
          onError={(e) => {
            e.currentTarget.src = fallbackImage;
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-black/10" />
        <div className="relative flex min-h-72 flex-col justify-end p-6 sm:p-10">
          <span className="w-fit rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium backdrop-blur">
            Shared itinerary · view only
          </span>
          <p className="mt-4 flex items-center gap-1.5 text-sm text-white/80">
            <MapPin className="h-4 w-4" />
            {trip.destination}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight tracking-tight sm:text-5xl">{trip.title}</h1>
          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((fact) => (
              <div key={fact.label} className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md">
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/60">
                  <fact.icon className="h-3.5 w-3.5" />
                  {fact.label}
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold sm:text-base">{fact.value}</dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {trip.travel_notes && (
        <Card className="p-5 text-sm text-neutral-600">
          <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">Travel notes</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            {trip.travel_notes.split("\n").map((note, i) => (
              <li key={i}>{note}</li>
            ))}
          </ul>
        </Card>
      )}

      <Card className="overflow-hidden">
        <TripMap lat={lat ?? 20.5937} lng={lng ?? 78.9629} destination={trip.destination} activities={mapActivities} />
      </Card>

      <section className="space-y-4">
        <h2 className="font-display text-2xl tracking-tight text-neutral-950 sm:text-3xl">Day by day</h2>
        <div role="tablist" className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-2">
          {trip.itinerary_days.map((d, idx) => {
            const active = idx === activeDay;
            return (
              <button
                key={d.day_number}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveDay(idx)}
                className={cn(
                  "flex min-w-24 shrink-0 cursor-pointer flex-col rounded-2xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 bg-white text-neutral-950 hover:border-neutral-400",
                )}
              >
                <span className={cn("text-[11px] font-semibold uppercase tracking-wider", active ? "text-white/60" : "text-neutral-400")}>
                  Day {d.day_number}
                </span>
                <span className="mt-0.5 text-sm font-semibold">
                  {formatDate(d.date, { weekday: "short", day: "numeric", month: "short" })}
                </span>
                <WeatherChip day={weather?.[d.date]} className={cn("mt-1", active ? "text-white/80" : "text-neutral-500")} />
              </button>
            );
          })}
        </div>

        {day && (
          <Card className="p-6 sm:p-8">
            <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
              Day {day.day_number} · {formatDate(day.date, { weekday: "long", day: "numeric", month: "long" })}
            </span>
            <h3 className="mt-1 font-display text-2xl text-neutral-950">{day.title}</h3>
            {day.summary && <p className="mt-1 text-sm text-neutral-500">{day.summary}</p>}
            <WeatherLine day={weather?.[day.date]} />
            <ol className="mt-6 space-y-5">
              {day.activities.map((a) => (
                <li key={a.id} className="flex gap-4">
                  <span className="w-12 shrink-0 pt-0.5 text-sm font-semibold tabular-nums text-neutral-950">
                    {a.start_time ?? ""}
                  </span>
                  <div className="min-w-0">
                    <h4 className="font-semibold text-neutral-950">{a.name}</h4>
                    {a.description && <p className="mt-0.5 text-sm text-neutral-600">{a.description}</p>}
                    <p className="mt-1 flex flex-wrap gap-x-3 text-xs text-neutral-500">
                      {a.location_name && (
                        <span className="flex items-center gap-1">
                          <MapPin className="h-3.5 w-3.5" />
                          {a.location_name}
                        </span>
                      )}
                      <span className="tabular-nums">
                        {a.estimated_cost > 0
                          ? `${formatCurrency(a.estimated_cost)}${a.cost_basis === "per_person" ? " / person" : ""}`
                          : "Free"}
                      </span>
                    </p>
                  </div>
                </li>
              ))}
            </ol>
          </Card>
        )}
      </section>

      <p className="flex items-start gap-1.5 text-xs text-neutral-500">
        <Info className="mt-px h-3.5 w-3.5 shrink-0" />
        {trip.disclaimer}
      </p>

      <Card className="flex flex-col items-center gap-3 p-8 text-center">
        <h2 className="font-display text-2xl text-neutral-950">Plan a trip like this</h2>
        <p className="max-w-md text-sm text-neutral-500">
          TripMate builds a day-by-day itinerary with a budget, map and packing list in under a minute.
        </p>
        <Link to="/signup">
          <Button>Start planning free</Button>
        </Link>
      </Card>
    </div>
  );
}
