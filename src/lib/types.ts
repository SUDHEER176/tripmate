import type { ActivityCostBasis, BudgetSummary, CostBasis, ExpenseCategory } from "./budget";

export type TripPace = "relaxed" | "moderate" | "packed";
export type TripStatus = "draft" | "planned" | "completed" | "archived";
export type TravelStyle = "budget" | "mid_range" | "luxury";
export type TimeSlot = "morning" | "afternoon" | "evening";
export type ActivityCategory =
  | "sightseeing"
  | "food"
  | "transport"
  | "accommodation"
  | "activity"
  | "nightlife"
  | "shopping";

export type Interest =
  | "food"
  | "culture"
  | "nature"
  | "nightlife"
  | "shopping"
  | "adventure"
  | "relaxation"
  | "history";

export type Profile = {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  created_at: string;
};

export type Trip = {
  id: string;
  user_id: string;
  title: string;
  destination: string;
  destination_lat: number | null;
  destination_lng: number | null;
  start_date: string;
  end_date: string;
  budget: number;
  travelers: number;
  interests: Interest[];
  pace: TripPace;
  travel_style?: TravelStyle;
  currency?: "INR";
  notes: string | null;
  /** AI travel tips; unverified. */
  travel_notes?: string | null;
  status: TripStatus;
  /** Cached total from the server-side budget calculation. */
  total_estimated_cost: number;
  generation_count?: number;
  created_at: string;
  updated_at: string;
};

export type ItineraryDay = {
  id: string;
  trip_id: string;
  day_number: number;
  date: string;
  title: string;
  summary: string;
};

export type Activity = {
  id: string;
  itinerary_day_id: string;
  name: string;
  category: ActivityCategory;
  start_time: string | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  estimated_cost: number;
  /** per_person: each traveler pays; total: one price for the group. */
  cost_basis?: ActivityCostBasis;
  /** True while the price is an unverified AI estimate. */
  cost_is_estimate?: boolean;
  description?: string | null;
  time_slot?: TimeSlot | null;
  duration_minutes?: number | null;
  notes: string | null;
  sort_order: number;
};

export type Expense = {
  id: string;
  trip_id: string;
  /** Set when the expense mirrors an activity cost (edit the activity instead). */
  activity_id: string | null;
  category: ExpenseCategory;
  title: string;
  amount: number;
  quantity: number;
  cost_basis: CostBasis;
  notes: string | null;
  source: "ai" | "user" | "activity";
  is_estimate: boolean;
};

export type ExpenseInput = {
  category: ExpenseCategory;
  title: string;
  amount: number;
  quantity?: number;
  cost_basis: CostBasis;
  notes?: string | null;
};

export type TripWithPlan = Trip & {
  itinerary_days: (ItineraryDay & { activities: Activity[] })[];
  expenses: Expense[];
  budget_summary: BudgetSummary;
  disclaimer?: string;
};

export type TripUpdate = Partial<
  Pick<Trip, "title" | "budget" | "travelers" | "interests" | "pace" | "notes" | "status" | "start_date" | "end_date">
> & { travel_style?: TravelStyle };

export type TripFormValues = {
  destination: string;
  start_date: string;
  end_date: string;
  budget: number;
  travelers: number;
  interests: Interest[];
  pace: TripPace;
  travel_style: TravelStyle;
  notes: string;
};

export type BudgetBreakdown = {
  accommodation: number;
  food: number;
  transport: number;
  activities: number;
  total: number;
};

export type UserSession = {
  id: string;
  email: string;
  fullName: string;
};

export type ChatTurn = { role: "user" | "assistant"; content: string };

/** One change the trip assistant made (or tried to make). */
export type AssistantAction = { tool: string; ok: boolean; label: string };

export type AssistantReply = {
  reply: string;
  actions: AssistantAction[];
  /** True when the assistant stopped early; any listed changes were still saved. */
  incomplete: boolean;
  trip: TripWithPlan;
};

/** Result of optimising one day's route (a preview unless `applied`). */
export type RouteOptimization = {
  itinerary_day_id: string;
  order: string[];
  start_times: Record<string, string>;
  before: { seconds: number; meters: number };
  after: { seconds: number; meters: number };
  saved_seconds: number;
  changed: boolean;
  skipped: number;
  travel_mode: "DRIVE" | "WALK";
  /** google: real travel times from the Routes API; estimate: straight-line distance. */
  source: "google" | "estimate";
  applied: boolean;
};
