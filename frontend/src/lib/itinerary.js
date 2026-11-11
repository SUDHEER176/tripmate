import { addDays, dayCount } from "./utils";
import { findDestination } from "./destinations";

const catalog = {
  food: [
    {
      name: "Neighborhood breakfast cafe",
      category: "food",
      hours: ["08:30", "09:00"],
    },
    { name: "Market tasting walk", category: "food", hours: ["11:00"] },
    {
      name: "Signature dinner reservation",
      category: "food",
      hours: ["19:30"],
    },
  ],
  culture: [
    {
      name: "Old town walking tour",
      category: "sightseeing",
      hours: ["10:00"],
    },
    {
      name: "Museum or gallery visit",
      category: "sightseeing",
      hours: ["14:00"],
    },
  ],
  nature: [
    {
      name: "Sunrise viewpoint or garden",
      category: "activity",
      hours: ["06:30", "08:00"],
    },
    { name: "Park or coastal trail", category: "activity", hours: ["15:00"] },
  ],
  nightlife: [
    { name: "Sunset rooftop drinks", category: "nightlife", hours: ["18:30"] },
    {
      name: "Live music or night market",
      category: "nightlife",
      hours: ["21:00"],
    },
  ],
  shopping: [
    { name: "Local artisan market", category: "shopping", hours: ["16:00"] },
    {
      name: "Design district browsing",
      category: "shopping",
      hours: ["13:00"],
    },
  ],
  adventure: [
    {
      name: "Guided outdoor experience",
      category: "activity",
      hours: ["09:00"],
    },
    { name: "Bike or boat excursion", category: "activity", hours: ["14:30"] },
  ],
  relaxation: [
    {
      name: "Spa or slow cafe afternoon",
      category: "activity",
      hours: ["15:30"],
    },
    { name: "Golden-hour stroll", category: "activity", hours: ["17:30"] },
  ],
  history: [
    {
      name: "Landmark and heritage site",
      category: "sightseeing",
      hours: ["10:30"],
    },
    {
      name: "Historic neighborhood walk",
      category: "sightseeing",
      hours: ["16:00"],
    },
  ],
  default: [
    { name: "Orientation walk", category: "sightseeing", hours: ["10:00"] },
    { name: "Local lunch", category: "food", hours: ["13:00"] },
    {
      name: "Neighborhood exploration",
      category: "activity",
      hours: ["16:00"],
    },
  ],
};

const paceSlots = {
  relaxed: 3,
  moderate: 4,
  packed: 5,
};

export function estimateBudget(input) {
  const days = dayCount(input.start_date, input.end_date);
  const known = findDestination(input.destination);
  const daily = known?.avgDaily ?? Math.round(input.budget / days);
  const suggested = daily * days * Math.max(1, input.travelers * 0.65);
  const total = Math.max(input.budget, Math.round(suggested * 0.35));
  const cap = input.budget || total;

  return {
    accommodation: Math.round(cap * 0.4),
    food: Math.round(cap * 0.25),
    transport: Math.round(cap * 0.15),
    activities: Math.round(cap * 0.2),
    total: cap,
  };
}

export function generateLocalPlan(input) {
  const days = dayCount(input.start_date, input.end_date);
  const budget = estimateBudget(input);
  const dest = findDestination(input.destination);
  const interests = input.interests.length
    ? input.interests
    : ["culture", "food"];
  const slots = paceSlots[input.pace];
  const perDayActivityBudget = Math.round(budget.activities / days);
  const perDayFood = Math.round(budget.food / days);
  const stayPerNight = Math.round(budget.accommodation / days);
  const transportShare = Math.round(budget.transport / days);

  const itinerary_days = [];

  for (let i = 0; i < days; i += 1) {
    const dayNumber = i + 1;
    const date = addDays(input.start_date, i);
    const focus = interests[i % interests.length];
    const dayId = crypto.randomUUID();
    const pool = [
      ...catalog[focus],
      ...catalog.default,
      ...interests.flatMap((item) => catalog[item]),
    ];
    const unique = pool.filter(
      (item, index, list) =>
        list.findIndex((entry) => entry.name === item.name) === index,
    );
    const chosen = unique.slice(0, slots);
    const activities = [
      {
        id: crypto.randomUUID(),
        itinerary_day_id: dayId,
        name:
          dayNumber === 1
            ? `Check in near ${input.destination}`
            : "Hotel / stay",
        category: "accommodation",
        start_time: dayNumber === 1 ? "14:00" : "08:00",
        location_name: `${input.destination} stay`,
        lat: dest ? dest.lat + i * 0.008 : null,
        lng: dest ? dest.lng + i * 0.006 : null,
        estimated_cost: stayPerNight,
        notes: "Estimated lodging share for this day.",
        sort_order: 0,
      },
    ];

    chosen.forEach((item, index) => {
      const isFood = item.category === "food";
      activities.push({
        id: crypto.randomUUID(),
        itinerary_day_id: dayId,
        name: `${item.name} in ${input.destination}`,
        category: item.category,
        start_time: item.hours[index % item.hours.length],
        location_name: `${input.destination} · ${item.name}`,
        lat: dest ? dest.lat + (index + 1) * 0.012 : null,
        lng: dest ? dest.lng - (index + 1) * 0.01 : null,
        estimated_cost: isFood
          ? Math.round(
              perDayFood /
                Math.max(1, chosen.filter((c) => c.category === "food").length),
            )
          : Math.round(perDayActivityBudget / Math.max(1, slots)),
        notes: input.notes || null,
        sort_order: index + 1,
      });
    });

    activities.push({
      id: crypto.randomUUID(),
      itinerary_day_id: dayId,
      name:
        dayNumber === 1
          ? "Airport / station transfer"
          : "Local transit day pass",
      category: "transport",
      start_time: dayNumber === 1 ? "11:00" : "09:30",
      location_name: input.destination,
      lat: dest?.lat ?? null,
      lng: dest?.lng ?? null,
      estimated_cost: transportShare,
      notes: null,
      sort_order: activities.length,
    });

    itinerary_days.push({
      id: dayId,
      trip_id: "",
      day_number: dayNumber,
      date,
      title:
        dayNumber === 1
          ? `Arrive in ${input.destination}`
          : dayNumber === days
            ? `Last day in ${input.destination}`
            : `${capitalize(focus)} day in ${input.destination}`,
      summary: `A ${input.pace} day focused on ${focus}, with time for food, movement, and one standout stop.`,
      activities,
    });
  }

  const total_estimated_cost = itinerary_days
    .flatMap((day) => day.activities)
    .reduce((sum, activity) => sum + activity.estimated_cost, 0);

  return {
    title: `${days}-day ${input.destination} trip`,
    destination_lat: dest?.lat ?? null,
    destination_lng: dest?.lng ?? null,
    total_estimated_cost,
    budget,
    itinerary_days,
  };
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function breakdownFromActivities(days) {
  const sums = { accommodation: 0, food: 0, transport: 0, activities: 0 };
  days.forEach((day) => {
    day.activities.forEach((activity) => {
      if (activity.category === "accommodation")
        sums.accommodation += activity.estimated_cost;
      else if (activity.category === "food")
        sums.food += activity.estimated_cost;
      else if (activity.category === "transport")
        sums.transport += activity.estimated_cost;
      else sums.activities += activity.estimated_cost;
    });
  });
  return {
    ...sums,
    total: sums.accommodation + sums.food + sums.transport + sums.activities,
  };
}
