// Builds a well-formed LLM itinerary response for tests and the mock LLM server.

export type FixtureRequest = { destination: string; dates: string[]; nights: number };

export function buildAiItinerary(req: FixtureRequest) {
  const lat = 26.9124;
  const lng = 75.7873;
  return {
    destination_valid: true,
    destination_issue: null,
    title: `${req.dates.length} days in ${req.destination}`,
    destination_lat: lat,
    destination_lng: lng,
    travel_notes: ["Carry cash for small vendors.", "Opening hours are estimates; check before visiting."],
    itinerary_days: req.dates.map((date, i) => ({
      day_number: i + 1,
      date,
      title: `Day ${i + 1} in ${req.destination}`,
      summary: "A balanced day of sights and food.",
      activities: [
        {
          name: i === 0 ? "Hotel check-in" : `Morning fort visit ${i + 1}`,
          description: "Start the day at a landmark.",
          category: i === 0 ? "accommodation" : "sightseeing",
          time_slot: "morning",
          start_time: "09:00",
          duration_minutes: 120,
          location_name: `${req.destination} Old City`,
          lat: lat + 0.01,
          lng: lng + 0.01,
          // Deliberately priced: the validator must zero it because stays are nightly expenses.
          estimated_cost: i === 0 ? 3500 : 200,
          cost_basis: i === 0 ? "total" : "per_person",
          travel_notes: "Entry fee is an estimate.",
        },
        {
          name: `Lunch thali ${i + 1}`,
          description: "Traditional lunch.",
          category: "food",
          time_slot: "afternoon",
          start_time: "13:00",
          duration_minutes: 60,
          location_name: "Local restaurant",
          lat: lat + 0.02,
          lng: lng - 0.01,
          estimated_cost: 450,
          cost_basis: "per_person",
          travel_notes: "Busy at peak hours.",
        },
        {
          name: `Bazaar walk ${i + 1}`,
          description: "Explore the markets.",
          category: "shopping",
          time_slot: "afternoon",
          start_time: "15:30",
          duration_minutes: 90,
          location_name: "Main bazaar",
          lat: lat - 0.01,
          lng: lng + 0.02,
          estimated_cost: 0,
          cost_basis: "per_person",
          travel_notes: "Bargaining is expected.",
        },
        {
          name: `Rooftop dinner ${i + 1}`,
          description: "Dinner with a view.",
          category: "food",
          time_slot: "evening",
          start_time: "19:30",
          duration_minutes: 90,
          location_name: "Rooftop cafe",
          lat: lat,
          lng: lng,
          estimated_cost: 900,
          cost_basis: "per_person",
          travel_notes: "Reserve ahead on weekends.",
        },
      ],
    })),
    expenses: [
      ...(req.nights > 0
        ? [
            {
              category: "accommodation",
              title: "Mid-range hotel",
              amount: 4000,
              cost_basis: "per_night",
              quantity: 99, // wrong on purpose: must be forced to the real night count
              notes: "Estimate for one double room.",
            },
          ]
        : []),
      {
        category: "transport",
        title: "Return train tickets",
        amount: 1800,
        cost_basis: "per_person",
        quantity: 1,
        notes: "From Delhi, estimate.",
      },
      {
        category: "local_travel",
        title: "Auto-rickshaws",
        amount: 400,
        cost_basis: "per_day",
        quantity: 1,
        notes: "Estimate.",
      },
    ],
  };
}
