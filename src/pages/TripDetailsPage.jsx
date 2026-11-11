import { useEffect, useState } from "react";
import {
  AlertCircle,
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  BedDouble,
  Bus,
  Calendar,
  Camera,
  Check,
  Clock,
  Edit2,
  Info,
  Loader2,
  MapPin,
  Moon,
  Plus,
  Printer,
  RefreshCw,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Ticket,
  Trash2,
  Users,
  Utensils,
  Wallet,
  X,
} from "lucide-react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { BudgetBreakdownCard } from "@/components/trips/BudgetBreakdownCard";
import { ExpensesCard } from "@/components/trips/ExpensesCard";
import TripMap from "@/components/trips/TripMap";
import { TripAssistant } from "@/components/trips/TripAssistant";
import { RouteOptimizerBar } from "@/components/trips/RouteOptimizerBar";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label, Textarea } from "@/components/ui/input";
import {
  addActivity,
  addExpense,
  deleteActivity,
  deleteExpense,
  deleteTrip,
  getTrip,
  regenerateTrip,
  reorderActivities,
  updateActivity,
  updateExpense,
  updateTrip,
} from "@/lib/api";
import { findDestination, getDestinationImageUrl } from "@/lib/destinations";

import {
  cn,
  dayCount,
  formatCurrency,
  formatDate,
  formatDateRange,
} from "@/lib/utils";

const timeSlots = ["morning", "afternoon", "evening"];
const tripStatuses = ["draft", "planned", "completed", "archived"];

function formatDuration(minutes) {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h ? (m ? `${h} h ${m} min` : `${h} h`) : `${m} min`;
}

const fallbackImage =
  "https://images.unsplash.com/photo-1488646953014-85cb44e25828?auto=format&fit=crop&w=1600&q=80";

const categoryIcons = {
  sightseeing: Camera,
  food: Utensils,
  transport: Bus,
  accommodation: BedDouble,
  activity: Ticket,
  nightlife: Moon,
  shopping: ShoppingBag,
};

const categories = Object.keys(categoryIcons);

export function TripDetailsPage() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [trip, setTrip] = useState(null);
  const [loading, setLoading] = useState(true);
  const [editingActivity, setEditingActivity] = useState(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [actionError, setActionError] = useState(null);
  const [regenerating, setRegenerating] = useState(false);
  const [tripDraft, setTripDraft] = useState(null);

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getTrip(id)
      .then((data) => setTrip(data))
      .catch((err) => console.error("Error loading trip:", err))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!editingActivity && !tripDraft) return;
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      setEditingActivity(null);
      setTripDraft(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [editingActivity, tripDraft]);

  async function reloadTrip() {
    if (!id) return;
    const fresh = await getTrip(id);
    setTrip(fresh);
  }

  /** Runs a change, then reloads the trip so totals always come from the server. Returns false on failure. */
  async function run(action) {
    setActionError(null);
    try {
      await action();
      await reloadTrip();
      return true;
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Something went wrong. Please try again.",
      );
      return false;
    }
  }

  async function handleDeleteTrip() {
    if (!trip) return;
    if (
      window.confirm("Are you sure you want to delete this trip itinerary?")
    ) {
      setActionError(null);
      try {
        await deleteTrip(trip.id);
        navigate("/my-trips");
      } catch (err) {
        setActionError(
          err instanceof Error ? err.message : "Could not delete the trip.",
        );
      }
    }
  }

  async function handleRegenerate() {
    if (!trip) return;
    const confirmed = window.confirm(
      "Regenerate this itinerary? All days, stops and AI-estimated expenses will be replaced with a new plan. " +
        "Expenses you added yourself are kept.",
    );
    if (!confirmed) return;
    setRegenerating(true);
    setActionError(null);
    try {
      setTrip(await regenerateTrip(trip.id));
      setActiveDayIndex(0);
    } catch (err) {
      setActionError(
        err instanceof Error
          ? err.message
          : "Could not regenerate the itinerary.",
      );
    } finally {
      setRegenerating(false);
    }
  }

  async function handleSaveTrip(e) {
    e.preventDefault();
    if (!trip || !tripDraft) return;
    setSavingEdit(true);
    const saved = await run(() =>
      updateTrip(trip.id, {
        title: tripDraft.title.trim(),
        budget: tripDraft.budget,
        travelers: tripDraft.travelers,
        notes: tripDraft.notes.trim() || null,
        status: tripDraft.status,
      }),
    );
    setSavingEdit(false);
    if (saved) setTripDraft(null);
  }

  async function handleAddStop(dayId) {
    if (!trip) return;
    await run(() => addActivity(trip.id, dayId));
  }

  async function handleDeleteStop(activityId) {
    if (!trip) return;
    await run(() => deleteActivity(trip.id, activityId));
  }

  async function handleMoveStop(dayId, ids, from, to) {
    if (!trip || to < 0 || to >= ids.length) return;
    const next = [...ids];
    const [moved] = next.splice(from, 1);
    next.splice(to, 0, moved);
    await run(() => reorderActivities(trip.id, dayId, next));
  }

  async function handleSaveActivityEdit(e) {
    e.preventDefault();
    if (!trip || !editingActivity) return;
    setSavingEdit(true);
    const saved = await run(() => updateActivity(trip.id, editingActivity));
    setSavingEdit(false);
    if (saved) setEditingActivity(null);
  }

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="h-5 w-40 animate-pulse rounded bg-neutral-200" />
        <div className="h-72 animate-pulse rounded-3xl bg-neutral-200" />
        <div className="grid gap-6 lg:grid-cols-12">
          <div className="h-80 animate-pulse rounded-2xl bg-neutral-200 lg:col-span-7" />
          <div className="h-80 animate-pulse rounded-2xl bg-neutral-200 lg:col-span-5" />
        </div>
      </div>
    );
  }

  if (!trip) {
    return (
      <div className="mx-auto max-w-md py-20 text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-neutral-100 text-neutral-500">
          <MapPin className="h-6 w-6" />
        </div>
        <h2 className="mt-4 font-display text-2xl text-neutral-950">
          Trip not found
        </h2>
        <p className="mt-2 text-sm text-neutral-500">
          This itinerary doesn’t exist or has been removed.
        </p>
        <Link to="/my-trips" className="mt-6 inline-block">
          <Button>Back to my trips</Button>
        </Link>
      </div>
    );
  }

  const destMatch = findDestination(trip.destination);
  const mapLat = trip.destination_lat ?? destMatch?.lat ?? 20.5937;
  const mapLng = trip.destination_lng ?? destMatch?.lng ?? 78.9629;
  const allActivities = trip.itinerary_days.flatMap((day) => day.activities);
  const days = dayCount(trip.start_date, trip.end_date);

  const summary = trip.budget_summary;
  const activityTotal = (a) =>
    a.estimated_cost * (a.cost_basis === "per_person" ? trip.travelers : 1);

  const currentDay =
    trip.itinerary_days[activeDayIndex] ?? trip.itinerary_days[0];
  const dayTotal =
    currentDay?.activities.reduce((sum, a) => sum + activityTotal(a), 0) ?? 0;
  const mapActivities = currentDay?.activities.some((a) => a.lat != null)
    ? currentDay.activities
    : allActivities;

  const facts = [
    {
      icon: Calendar,
      label: "Dates",
      value: formatDateRange(trip.start_date, trip.end_date),
    },
    {
      icon: Clock,
      label: "Duration",
      value: `${days} ${days === 1 ? "day" : "days"}`,
    },
    { icon: Users, label: "Travelers", value: String(trip.travelers) },
    {
      icon: Wallet,
      label: "Est. total",
      value: formatCurrency(summary.estimated_total),
    },
  ];

  return (
    <div className="mx-auto max-w-6xl space-y-8 pb-16">
      {/* Back and Action Bar */}
      <div className="no-print flex flex-wrap items-center justify-between gap-3">
        <Link
          to="/my-trips"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-neutral-500 transition-colors hover:text-neutral-950"
        >
          <ArrowLeft className="h-4 w-4" />
          All trips
        </Link>

        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() =>
              setTripDraft({
                title: trip.title,
                budget: trip.budget,
                travelers: trip.travelers,
                notes: trip.notes ?? "",
                status: trip.status,
              })
            }
          >
            <Edit2 className="h-3.5 w-3.5" />
            Edit trip
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRegenerate}
            disabled={regenerating}
          >
            {regenerating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <RefreshCw className="h-3.5 w-3.5" />
            )}
            {regenerating ? "Regenerating…" : "Regenerate"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="h-3.5 w-3.5" />
            Print
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDeleteTrip}
            className="text-terracotta hover:border-terracotta/40 hover:bg-terracotta/5"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Delete
          </Button>
        </div>
      </div>

      {actionError && (
        <div
          role="alert"
          className="no-print flex items-start gap-2 rounded-xl border border-terracotta/20 bg-terracotta/5 p-4 text-sm text-terracotta"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <span className="flex-1">{actionError}</span>
          <button
            type="button"
            onClick={() => setActionError(null)}
            aria-label="Dismiss"
            className="cursor-pointer rounded-full p-0.5 hover:bg-terracotta/10"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Hero */}
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
          <div className="flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold capitalize text-neutral-950">
              {trip.status}
            </span>
            <span className="rounded-full bg-white/15 px-2.5 py-1 text-[11px] font-medium capitalize backdrop-blur">
              {trip.pace} pace
            </span>
            {trip.interests.map((interest) => (
              <span
                key={interest}
                className="rounded-full border border-white/25 px-2.5 py-1 text-[11px] font-medium capitalize text-white/85"
              >
                {interest}
              </span>
            ))}
          </div>
          <p className="mt-4 flex items-center gap-1.5 text-sm text-white/80">
            <MapPin className="h-4 w-4" />
            {trip.destination}
          </p>
          <h1 className="mt-1 font-display text-3xl leading-tight tracking-tight sm:text-5xl">
            {trip.title}
          </h1>

          <dl className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {facts.map((fact) => (
              <div
                key={fact.label}
                className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-md"
              >
                <dt className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-white/60">
                  <fact.icon className="h-3.5 w-3.5" />
                  {fact.label}
                </dt>
                <dd className="mt-1 truncate text-sm font-semibold sm:text-base">
                  {fact.value}
                </dd>
              </div>
            ))}
          </dl>
        </div>
      </div>

      {trip.notes && (
        <div className="flex items-start gap-3 rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          <StickyNote className="mt-0.5 h-4 w-4 shrink-0 text-neutral-400" />
          {trip.notes}
        </div>
      )}

      {(trip.travel_notes || trip.disclaimer) && (
        <div className="rounded-2xl border border-neutral-200 bg-white p-4 text-sm text-neutral-600">
          {trip.travel_notes && (
            <>
              <p className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                Travel notes
              </p>
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {trip.travel_notes.split("\n").map((note, i) => (
                  <li key={i}>{note}</li>
                ))}
              </ul>
            </>
          )}
          {trip.disclaimer && (
            <p
              className={cn(
                "flex items-start gap-1.5 text-xs text-neutral-500",
                trip.travel_notes && "mt-3",
              )}
            >
              <Info className="mt-px h-3.5 w-3.5 shrink-0" />
              {trip.disclaimer}
            </p>
          )}
        </div>
      )}

      {/* Map & Budget Section */}
      <div className="grid gap-6 lg:grid-cols-12">
        <Card className="overflow-hidden lg:col-span-7">
          <div className="flex items-center justify-between border-b border-neutral-100 px-5 py-4">
            <div>
              <h3 className="text-base font-semibold text-neutral-950">
                Route map
              </h3>
              <p className="text-xs text-neutral-500">
                {mapActivities === allActivities
                  ? "All stops"
                  : `Day ${currentDay?.day_number} stops`}{" "}
                in order
              </p>
            </div>
          </div>
          <div className="[&_.leaflet-container]:rounded-none [&_.trip-map]:rounded-none">
            <TripMap
              lat={mapLat}
              lng={mapLng}
              destination={trip.destination}
              activities={mapActivities}
            />
          </div>
        </Card>

        <div className="lg:col-span-5">
          <BudgetBreakdownCard summary={summary} />
        </div>
      </div>

      {/* Day by Day Itinerary */}
      <section className="space-y-5">
        <div>
          <h2 className="font-display text-2xl tracking-tight text-neutral-950 sm:text-3xl">
            Day by day
          </h2>
          <p className="mt-1 text-sm text-neutral-500">
            Pick a day to view and adjust stops, times and costs.
          </p>
        </div>

        {/* Day Selector Tabs */}
        <div
          role="tablist"
          className="no-print -mx-1 flex gap-2 overflow-x-auto px-1 pb-2"
        >
          {trip.itinerary_days.map((day, idx) => {
            const active = activeDayIndex === idx;
            return (
              <button
                key={day.id}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setActiveDayIndex(idx)}
                className={cn(
                  "flex min-w-24 shrink-0 cursor-pointer flex-col rounded-2xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-neutral-950 bg-neutral-950 text-white shadow-lg shadow-neutral-950/10"
                    : "border-neutral-200 bg-white text-neutral-950 hover:border-neutral-400",
                )}
              >
                <span
                  className={cn(
                    "text-[11px] font-semibold uppercase tracking-wider",
                    active ? "text-white/60" : "text-neutral-400",
                  )}
                >
                  Day {day.day_number}
                </span>
                <span className="mt-0.5 text-sm font-semibold">
                  {formatDate(day.date, {
                    weekday: "short",
                    day: "numeric",
                    month: "short",
                  })}
                </span>
              </button>
            );
          })}
        </div>

        {/* Selected Day Content */}
        {currentDay && (
          <Card key={currentDay.id} className="animate-fade-up p-6 sm:p-8">
            <div className="flex flex-col justify-between gap-4 border-b border-neutral-100 pb-5 sm:flex-row sm:items-start">
              <div>
                <span className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                  Day {currentDay.day_number} ·{" "}
                  {formatDate(currentDay.date, {
                    weekday: "long",
                    day: "numeric",
                    month: "long",
                  })}
                </span>
                <h3 className="mt-1 font-display text-2xl text-neutral-950">
                  {currentDay.title}
                </h3>
                {currentDay.summary && (
                  <p className="mt-1 max-w-2xl text-sm text-neutral-500">
                    {currentDay.summary}
                  </p>
                )}
              </div>

              <div className="flex shrink-0 items-center gap-3">
                <div className="text-right">
                  <span className="block text-[11px] uppercase tracking-wider text-neutral-400">
                    Day cost
                  </span>
                  <span className="font-semibold tabular-nums text-neutral-950">
                    {formatCurrency(dayTotal)}
                  </span>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => handleAddStop(currentDay.id)}
                  className="no-print"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add stop
                </Button>
              </div>
            </div>

            <RouteOptimizerBar
              key={currentDay.id}
              tripId={trip.id}
              dayId={currentDay.id}
              activities={currentDay.activities}
              onApplied={reloadTrip}
            />

            {/* Activities timeline */}
            {currentDay.activities.length === 0 ? (
              <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-10 text-center">
                <Sparkles className="mx-auto h-6 w-6 text-neutral-400" />
                <p className="mt-2 text-sm text-neutral-500">
                  No stops scheduled for this day yet.
                </p>
                <Button
                  size="sm"
                  className="mt-4"
                  onClick={() => handleAddStop(currentDay.id)}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add first stop
                </Button>
              </div>
            ) : (
              <ol className="relative mt-6">
                {currentDay.activities.map((activity, idx) => {
                  const Icon = categoryIcons[activity.category] ?? MapPin;
                  const last = idx === currentDay.activities.length - 1;
                  const dayIds = currentDay.activities.map((a) => a.id);
                  return (
                    <li
                      key={activity.id}
                      className="group relative flex gap-4 pb-6 last:pb-0"
                    >
                      {!last && (
                        <span
                          className="absolute left-5 top-11 bottom-1 w-px bg-neutral-200"
                          aria-hidden
                        />
                      )}
                      <div className="flex w-10 shrink-0 flex-col items-center">
                        <span className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200 bg-white text-neutral-700 transition-colors group-hover:border-neutral-950 group-hover:bg-neutral-950 group-hover:text-white">
                          <Icon className="h-4 w-4" />
                        </span>
                      </div>

                      <div className="flex min-w-0 flex-1 flex-col gap-3 rounded-2xl border border-transparent p-3 -m-3 transition-colors group-hover:border-neutral-200 group-hover:bg-neutral-50 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                            {activity.start_time && (
                              <span className="text-sm font-semibold tabular-nums text-neutral-950">
                                {activity.start_time}
                              </span>
                            )}
                            <span className="rounded-full bg-neutral-100 px-2 py-0.5 text-[11px] font-medium capitalize text-neutral-600">
                              {activity.category}
                            </span>
                            {activity.time_slot && (
                              <span className="text-[11px] font-medium capitalize text-neutral-400">
                                {activity.time_slot}
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1 text-base font-semibold text-neutral-950">
                            {activity.name}
                          </h4>
                          {activity.description && (
                            <p className="mt-1 max-w-2xl text-sm text-neutral-600">
                              {activity.description}
                            </p>
                          )}
                          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500">
                            {activity.location_name && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3.5 w-3.5" />
                                {activity.location_name}
                              </span>
                            )}
                            {activity.duration_minutes ? (
                              <span className="flex items-center gap-1">
                                <Clock className="h-3.5 w-3.5" />
                                {formatDuration(activity.duration_minutes)}
                              </span>
                            ) : null}
                            <span className="font-medium tabular-nums text-neutral-700">
                              {activity.estimated_cost > 0
                                ? `${formatCurrency(activity.estimated_cost)}${activity.cost_basis === "per_person" ? " / person" : ""}`
                                : "Free"}
                            </span>
                            {activity.cost_is_estimate &&
                              activity.estimated_cost > 0 && (
                                <span className="rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-500">
                                  est.
                                </span>
                              )}
                          </div>
                          {activity.notes && (
                            <p className="mt-2 rounded-lg bg-neutral-100/70 px-3 py-2 text-xs text-neutral-600">
                              {activity.notes}
                            </p>
                          )}
                        </div>

                        <div className="no-print flex items-center gap-1 self-end opacity-100 transition-opacity sm:self-start sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={() =>
                              handleMoveStop(
                                currentDay.id,
                                dayIds,
                                idx,
                                idx - 1,
                              )
                            }
                            aria-label={`Move ${activity.name} earlier`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-white hover:text-neutral-950 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowUp className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            disabled={last}
                            onClick={() =>
                              handleMoveStop(
                                currentDay.id,
                                dayIds,
                                idx,
                                idx + 1,
                              )
                            }
                            aria-label={`Move ${activity.name} later`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-white hover:text-neutral-950 hover:shadow-sm disabled:cursor-not-allowed disabled:opacity-30"
                          >
                            <ArrowDown className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditingActivity(activity)}
                            aria-label={`Edit ${activity.name}`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-white hover:text-neutral-950 hover:shadow-sm"
                          >
                            <Edit2 className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteStop(activity.id)}
                            aria-label={`Delete ${activity.name}`}
                            className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-white hover:text-terracotta hover:shadow-sm"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        )}
      </section>

      <TripAssistant trip={trip} onTripChange={setTrip} />

      <ExpensesCard
        expenses={trip.expenses}
        travelers={trip.travelers}
        onAdd={async (input) => {
          if (!(await run(() => addExpense(trip.id, input))))
            throw new Error("not saved");
        }}
        onUpdate={async (expenseId, input) => {
          if (!(await run(() => updateExpense(trip.id, expenseId, input))))
            throw new Error("not saved");
        }}
        onDelete={async (expenseId) => {
          await run(() => deleteExpense(trip.id, expenseId));
        }}
      />

      {/* Edit Trip Modal */}
      {tripDraft && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setTripDraft(null)}
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-trip-title"
            className="animate-fade-up w-full max-w-md rounded-b-none p-6 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3
                id="edit-trip-title"
                className="text-lg font-semibold text-neutral-950"
              >
                Edit trip
              </h3>
              <button
                type="button"
                onClick={() => setTripDraft(null)}
                aria-label="Close"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveTrip} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="trip-title">Title</Label>
                <Input
                  id="trip-title"
                  required
                  maxLength={200}
                  value={tripDraft.title}
                  onChange={(e) =>
                    setTripDraft({ ...tripDraft, title: e.target.value })
                  }
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="trip-budget">Budget (₹)</Label>
                  <Input
                    id="trip-budget"
                    type="number"
                    required
                    min={1000}
                    step={500}
                    value={tripDraft.budget}
                    onChange={(e) =>
                      setTripDraft({
                        ...tripDraft,
                        budget: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="trip-travelers">Travelers</Label>
                  <Input
                    id="trip-travelers"
                    type="number"
                    required
                    min={1}
                    max={20}
                    value={tripDraft.travelers}
                    onChange={(e) =>
                      setTripDraft({
                        ...tripDraft,
                        travelers: Number(e.target.value),
                      })
                    }
                  />
                </div>
              </div>
              <div>
                <Label>Status</Label>
                <div className="flex flex-wrap gap-1.5">
                  {tripStatuses.map((status) => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => setTripDraft({ ...tripDraft, status })}
                      className={cn(
                        "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                        tripDraft.status === status
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
                      )}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <Label htmlFor="trip-notes">Preferences</Label>
                <Textarea
                  id="trip-notes"
                  maxLength={1000}
                  value={tripDraft.notes}
                  onChange={(e) =>
                    setTripDraft({ ...tripDraft, notes: e.target.value })
                  }
                />
              </div>
              <p className="text-xs text-neutral-500">
                To change destination or dates, regenerate the itinerary from a
                new plan.
              </p>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setTripDraft(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {savingEdit ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}

      {/* Edit Activity Modal */}
      {editingActivity && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
          onClick={() => setEditingActivity(null)}
        >
          <Card
            role="dialog"
            aria-modal="true"
            aria-labelledby="edit-stop-title"
            className="animate-fade-up w-full max-w-md rounded-b-none p-6 shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3
                id="edit-stop-title"
                className="text-lg font-semibold text-neutral-950"
              >
                Edit stop
              </h3>
              <button
                type="button"
                onClick={() => setEditingActivity(null)}
                aria-label="Close"
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveActivityEdit} className="mt-5 space-y-4">
              <div>
                <Label htmlFor="act-name">Name</Label>
                <Input
                  id="act-name"
                  required
                  autoFocus
                  value={editingActivity.name}
                  onChange={(e) =>
                    setEditingActivity({
                      ...editingActivity,
                      name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label>Category</Label>
                <div className="flex flex-wrap gap-1.5">
                  {categories.map((category) => {
                    const Icon = categoryIcons[category];
                    const active = editingActivity.category === category;
                    return (
                      <button
                        key={category}
                        type="button"
                        onClick={() =>
                          setEditingActivity({ ...editingActivity, category })
                        }
                        className={cn(
                          "flex cursor-pointer items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                          active
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
                        )}
                      >
                        <Icon className="h-3 w-3" />
                        {category}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <Label>Time of day</Label>
                <div className="flex flex-wrap gap-1.5">
                  {timeSlots.map((slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() =>
                        setEditingActivity({
                          ...editingActivity,
                          time_slot: slot,
                        })
                      }
                      className={cn(
                        "cursor-pointer rounded-full border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                        editingActivity.time_slot === slot
                          ? "border-neutral-950 bg-neutral-950 text-white"
                          : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
                      )}
                    >
                      {slot}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label htmlFor="act-time">Time</Label>
                  <Input
                    id="act-time"
                    type="time"
                    value={editingActivity.start_time ?? "10:00"}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        start_time: e.target.value,
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="act-cost">Cost (₹)</Label>
                  <Input
                    id="act-cost"
                    type="number"
                    min={0}
                    value={editingActivity.estimated_cost}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        estimated_cost: Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label htmlFor="act-duration">Duration (min)</Label>
                  <Input
                    id="act-duration"
                    type="number"
                    min={0}
                    max={1440}
                    value={editingActivity.duration_minutes ?? ""}
                    onChange={(e) =>
                      setEditingActivity({
                        ...editingActivity,
                        duration_minutes:
                          e.target.value === "" ? null : Number(e.target.value),
                      })
                    }
                  />
                </div>
                <div>
                  <Label>Cost is</Label>
                  <div className="flex h-11 gap-1.5">
                    {["per_person", "total"].map((basis) => (
                      <button
                        key={basis}
                        type="button"
                        onClick={() =>
                          setEditingActivity({
                            ...editingActivity,
                            cost_basis: basis,
                          })
                        }
                        className={cn(
                          "flex-1 cursor-pointer rounded-xl border text-xs font-medium transition-colors",
                          (editingActivity.cost_basis ?? "per_person") === basis
                            ? "border-neutral-950 bg-neutral-950 text-white"
                            : "border-neutral-200 text-neutral-600 hover:border-neutral-400",
                        )}
                      >
                        {basis === "per_person" ? "Per person" : "For group"}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <div>
                <Label htmlFor="act-description">Description</Label>
                <Textarea
                  id="act-description"
                  maxLength={2000}
                  className="min-h-20"
                  value={editingActivity.description ?? ""}
                  onChange={(e) =>
                    setEditingActivity({
                      ...editingActivity,
                      description: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="act-location">Location</Label>
                <Input
                  id="act-location"
                  maxLength={300}
                  value={editingActivity.location_name ?? ""}
                  onChange={(e) =>
                    setEditingActivity({
                      ...editingActivity,
                      location_name: e.target.value,
                    })
                  }
                />
              </div>

              <div>
                <Label htmlFor="act-notes">Notes</Label>
                <Input
                  id="act-notes"
                  placeholder="e.g. Book tickets in advance"
                  value={editingActivity.notes ?? ""}
                  onChange={(e) =>
                    setEditingActivity({
                      ...editingActivity,
                      notes: e.target.value,
                    })
                  }
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => setEditingActivity(null)}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={savingEdit}>
                  {savingEdit ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                  {savingEdit ? "Saving…" : "Save changes"}
                </Button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </div>
  );
}
