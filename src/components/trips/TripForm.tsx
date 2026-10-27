import { useState } from "react";
import { Calendar, Loader2, MapPin, Minus, Plus, Sparkles, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DestinationAutocomplete } from "@/components/ui/DestinationAutocomplete";
import { Input, Label, Textarea } from "@/components/ui/input";
import { destinations, interestOptions } from "@/lib/destinations";
import type { Interest, TravelStyle, TripFormValues, TripPace } from "@/lib/types";
import { addDays, cn, dayCount, formatCurrency } from "@/lib/utils";

const paces: { id: TripPace; label: string; hint: string; dots: number }[] = [
  { id: "relaxed", label: "Relaxed", hint: "3 stops / day", dots: 3 },
  { id: "moderate", label: "Moderate", hint: "4 stops / day", dots: 4 },
  { id: "packed", label: "Packed", hint: "5 stops / day", dots: 5 },
];

const styles: { id: TravelStyle; label: string; hint: string }[] = [
  { id: "budget", label: "Budget", hint: "Hostels, street food, public transport" },
  { id: "mid_range", label: "Mid-range", hint: "3-star stays, casual dining, cabs" },
  { id: "luxury", label: "Luxury", hint: "5-star stays, fine dining, private transfers" },
];

/** Longest trip the AI planner accepts (enforced on the server too). */
const MAX_TRIP_DAYS = 14;

const budgetPresets = [25000, 50000, 100000, 200000];

type Props = {
  initialDestination?: string;
  initialDays?: number;
  initialBudget?: number;
  submitting?: boolean;
  onSubmit: (values: TripFormValues) => Promise<void>;
};

function Section({
  step,
  title,
  icon: Icon,
  children,
}: {
  step: number;
  title: string;
  icon: typeof MapPin;
  children: React.ReactNode;
}) {
  return (
    <section className="space-y-4">
      <div className="flex items-center gap-3">
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-950 text-xs font-bold text-white">
          {step}
        </span>
        <h2 className="flex items-center gap-2 text-base font-semibold text-neutral-950">
          <Icon className="h-4 w-4 text-neutral-400" />
          {title}
        </h2>
      </div>
      <div className="sm:pl-10">{children}</div>
    </section>
  );
}

export function TripForm({ initialDestination = "", initialDays, initialBudget, submitting, onSubmit }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [values, setValues] = useState<TripFormValues>({
    destination: initialDestination,
    start_date: today,
    end_date: initialDays ? addDays(today, initialDays - 1) : today,
    budget: initialBudget ?? 50000,
    travelers: 2,
    interests: ["food", "culture"],
    pace: "moderate",
    travel_style: "mid_range",
    notes: "",
  });

  const days = values.end_date >= values.start_date ? dayCount(values.start_date, values.end_date) : 0;
  const perPersonPerDay = days && values.travelers ? Math.round(values.budget / days / values.travelers) : 0;

  function toggleInterest(id: Interest) {
    setValues((current) => ({
      ...current,
      interests: current.interests.includes(id)
        ? current.interests.filter((item) => item !== id)
        : [...current.interests, id],
    }));
  }

  function setTravelers(next: number) {
    setValues((current) => ({ ...current, travelers: Math.min(12, Math.max(1, next)) }));
  }

  return (
    <form
      className="space-y-8"
      onSubmit={async (event) => {
        event.preventDefault();
        await onSubmit(values);
      }}
    >
      <Section step={1} title="Where to?" icon={MapPin}>
        <Label htmlFor="destination" className="sr-only">
          Destination
        </Label>
        <DestinationAutocomplete
          id="destination"
          required
          value={values.destination}
          onChange={(val) => setValues({ ...values, destination: val })}
          placeholder="Kyoto, Lisbon, Konaseema, Paris…"
        />
        <div className="mt-3 flex flex-wrap gap-1.5">
          {destinations.slice(0, 6).map((dest) => (
            <button
              key={dest.name}
              type="button"
              onClick={() => setValues({ ...values, destination: dest.name })}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                values.destination === dest.name
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-950",
              )}
            >
              {dest.name}
            </button>
          ))}
        </div>
      </Section>

      <Section step={2} title="When & who" icon={Calendar}>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <Label htmlFor="start">Start date</Label>
            <Input
              id="start"
              type="date"
              required
              min={today}
              value={values.start_date}
              onChange={(event) => {
                const start = event.target.value;
                setValues({
                  ...values,
                  start_date: start,
                  end_date:
                    values.end_date < start || values.end_date > addDays(start, MAX_TRIP_DAYS - 1)
                      ? start
                      : values.end_date,
                });
              }}
            />
          </div>
          <div>
            <Label htmlFor="end">End date</Label>
            <Input
              id="end"
              type="date"
              required
              min={values.start_date}
              max={addDays(values.start_date, MAX_TRIP_DAYS - 1)}
              value={values.end_date}
              onChange={(event) => setValues({ ...values, end_date: event.target.value })}
            />
          </div>
          <div>
            <Label htmlFor="travelers">Travelers</Label>
            <div className="flex h-11 items-center justify-between rounded-xl border border-neutral-200 bg-white px-1.5">
              <button
                type="button"
                aria-label="Fewer travelers"
                onClick={() => setTravelers(values.travelers - 1)}
                disabled={values.travelers <= 1}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Minus className="h-4 w-4" />
              </button>
              <input
                id="travelers"
                type="number"
                min={1}
                max={12}
                required
                value={values.travelers}
                onChange={(event) => setTravelers(Number(event.target.value))}
                className="w-10 bg-transparent text-center text-sm font-semibold outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
              />
              <button
                type="button"
                aria-label="More travelers"
                onClick={() => setTravelers(values.travelers + 1)}
                disabled={values.travelers >= 12}
                className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-lg text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-30"
              >
                <Plus className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
        {days > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            {days} {days === 1 ? "day" : "days"} · {days - 1} {days - 1 === 1 ? "night" : "nights"} · up to{" "}
            {MAX_TRIP_DAYS} days per plan
          </p>
        )}
      </Section>

      <Section step={3} title="Budget" icon={Wallet}>
        <Label htmlFor="budget">Total budget (INR)</Label>
        <div className="relative">
          <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-neutral-400">
            ₹
          </span>
          <Input
            id="budget"
            type="number"
            min={5000}
            step={1000}
            required
            value={values.budget}
            onChange={(event) => setValues({ ...values, budget: Number(event.target.value) })}
            className="pl-8"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {budgetPresets.map((amount) => (
            <button
              key={amount}
              type="button"
              onClick={() => setValues({ ...values, budget: amount })}
              className={cn(
                "cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition-colors",
                values.budget === amount
                  ? "border-neutral-950 bg-neutral-950 text-white"
                  : "border-neutral-200 text-neutral-600 hover:border-neutral-400 hover:text-neutral-950",
              )}
            >
              {formatCurrency(amount)}
            </button>
          ))}
        </div>
        {perPersonPerDay > 0 && (
          <p className="mt-2 text-xs text-neutral-500">
            ≈ {formatCurrency(perPersonPerDay)} per person, per day
          </p>
        )}
      </Section>

      <Section step={4} title="Travel style" icon={Sparkles}>
        <Label>Interests</Label>
        <div className="flex flex-wrap gap-2">
          {interestOptions.map((item) => {
            const active = values.interests.includes(item.id);
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => toggleInterest(item.id)}
                className={cn(
                  "cursor-pointer rounded-full border px-3.5 py-1.5 text-sm font-medium transition-all",
                  active
                    ? "border-neutral-950 bg-neutral-950 text-white"
                    : "border-neutral-200 text-neutral-700 hover:border-neutral-400",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>

        <Label className="mt-6">Travel style</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {styles.map((item) => {
            const active = values.travel_style === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setValues({ ...values, travel_style: item.id })}
                className={cn(
                  "cursor-pointer rounded-2xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-neutral-950 bg-neutral-50 ring-1 ring-neutral-950"
                    : "border-neutral-200 hover:border-neutral-400",
                )}
              >
                <p className="font-semibold text-neutral-950">{item.label}</p>
                <p className="mt-0.5 text-xs text-neutral-500">{item.hint}</p>
              </button>
            );
          })}
        </div>

        <Label className="mt-6">Pace</Label>
        <div className="grid gap-2 sm:grid-cols-3">
          {paces.map((item) => {
            const active = values.pace === item.id;
            return (
              <button
                key={item.id}
                type="button"
                aria-pressed={active}
                onClick={() => setValues({ ...values, pace: item.id })}
                className={cn(
                  "cursor-pointer rounded-2xl border px-4 py-3 text-left transition-all",
                  active
                    ? "border-neutral-950 bg-neutral-50 ring-1 ring-neutral-950"
                    : "border-neutral-200 hover:border-neutral-400",
                )}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-neutral-950">{item.label}</p>
                  <span className="flex gap-0.5">
                    {Array.from({ length: 5 }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          "h-1.5 w-1.5 rounded-full",
                          i < item.dots ? "bg-neutral-950" : "bg-neutral-200",
                        )}
                      />
                    ))}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">{item.hint}</p>
              </button>
            );
          })}
        </div>

        <Label htmlFor="notes" className="mt-6">
          Notes <span className="font-normal text-neutral-400">(optional)</span>
        </Label>
        <Textarea
          id="notes"
          value={values.notes}
          onChange={(event) => setValues({ ...values, notes: event.target.value })}
          placeholder="Anniversary trip, vegetarian food, avoid long hikes…"
        />
      </Section>

      <div className="border-t border-neutral-100 pt-6">
        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Building your itinerary…
            </>
          ) : (
            <>
              <Sparkles className="h-4 w-4" />
              Generate itinerary
            </>
          )}
        </Button>
      </div>
    </form>
  );
}
