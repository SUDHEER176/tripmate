// Server-side validation for every request payload and for AI-generated itineraries.
// Pure TypeScript (web-standard APIs only) so it runs in Deno and in Node tests.

import { ApiError, ValidationError } from "./http.ts";
import {
  ACTIVITY_COST_BASES,
  COST_BASES,
  EXPENSE_CATEGORIES,
  addDaysUtc,
  tripDayCount,
  tripNightCount,
  type ActivityCategory,
  type ActivityCostBasis,
  type CostBasis,
  type ExpenseCategory,
} from "./budget.ts";

export const LIMITS = {
  MAX_TRIP_DAYS: 14,
  MAX_START_DAYS_AHEAD: 730,
  MIN_TRAVELERS: 1,
  MAX_TRAVELERS: 20,
  MIN_BUDGET: 1000,
  MAX_BUDGET: 10_000_000,
  MAX_AMOUNT: 10_000_000,
  MAX_QUANTITY: 1000,
  MIN_AI_ACTIVITIES_PER_DAY: 3,
  MAX_AI_ACTIVITIES_PER_DAY: 8,
  MAX_ACTIVITIES_PER_DAY: 20,
  MAX_AI_EXPENSES: 30,
  MAX_INTERESTS: 8,
} as const;

export const INTERESTS = [
  "food",
  "culture",
  "nature",
  "nightlife",
  "shopping",
  "adventure",
  "relaxation",
  "history",
] as const;
export const PACES = ["relaxed", "moderate", "packed"] as const;
export const TRAVEL_STYLES = ["budget", "mid_range", "luxury"] as const;
export const TRIP_STATUSES = ["draft", "planned", "completed", "archived"] as const;
export const TIME_SLOTS = ["morning", "afternoon", "evening"] as const;
export const ACTIVITY_CATEGORIES = [
  "sightseeing",
  "food",
  "transport",
  "accommodation",
  "activity",
  "nightlife",
  "shopping",
] as const;

export type Interest = (typeof INTERESTS)[number];
export type Pace = (typeof PACES)[number];
export type TravelStyle = (typeof TRAVEL_STYLES)[number];
export type TripStatus = (typeof TRIP_STATUSES)[number];
export type TimeSlot = (typeof TIME_SLOTS)[number];

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
// Letters (any script), digits, spaces and common place-name punctuation only.
const DESTINATION_RE = /^[\p{L}\p{M}\p{N}][\p{L}\p{M}\p{N}\s.,'’&()\-/]*$/u;
// deno-lint-ignore no-control-regex
const CONTROL_CHARS_RE = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g;

export function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export function utcToday(): string {
  return new Date().toISOString().slice(0, 10);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function cleanText(value: string): string {
  return value.replace(CONTROL_CHARS_RE, "").trim();
}

function isRealDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

/** Collects field errors and turns them into one 422 response. */
class FieldErrors {
  errors: Record<string, string> = {};

  add(field: string, message: string) {
    if (!(field in this.errors)) this.errors[field] = message;
  }

  throwIfAny() {
    if (Object.keys(this.errors).length) throw new ValidationError(this.errors);
  }
}

type TextOpts = { min?: number; max: number; required?: boolean; nullable?: boolean };

function readText(src: Record<string, unknown>, key: string, e: FieldErrors, opts: TextOpts): string | null | undefined {
  const raw = src[key];
  if (raw === undefined) {
    if (opts.required) e.add(key, "is required");
    return undefined;
  }
  if (raw === null || (typeof raw === "string" && raw.trim() === "" && opts.nullable)) {
    if (opts.nullable) return null;
    e.add(key, opts.required ? "is required" : "must be a string");
    return undefined;
  }
  if (typeof raw !== "string") {
    e.add(key, "must be a string");
    return undefined;
  }
  const value = cleanText(raw);
  const min = opts.min ?? (opts.required ? 1 : 0);
  if (value.length < min) {
    e.add(key, min <= 1 ? "must not be empty" : `must be at least ${min} characters`);
    return undefined;
  }
  if (value.length > opts.max) {
    e.add(key, `must be at most ${opts.max} characters`);
    return undefined;
  }
  return value;
}

function readEnum<T extends string>(
  src: Record<string, unknown>,
  key: string,
  e: FieldErrors,
  allowed: readonly T[],
  opts: { required?: boolean; nullable?: boolean } = {},
): T | null | undefined {
  const raw = src[key];
  if (raw === undefined) {
    if (opts.required) e.add(key, "is required");
    return undefined;
  }
  if (raw === null && opts.nullable) return null;
  if (typeof raw !== "string" || !(allowed as readonly string[]).includes(raw)) {
    e.add(key, `must be one of: ${allowed.join(", ")}`);
    return undefined;
  }
  return raw as T;
}

function toNumber(raw: unknown): number | null {
  if (typeof raw === "number") return Number.isFinite(raw) ? raw : null;
  if (typeof raw === "string" && raw.trim() !== "" && /^-?\d+(\.\d+)?$/.test(raw.trim())) return Number(raw.trim());
  return null;
}

function readInt(
  src: Record<string, unknown>,
  key: string,
  e: FieldErrors,
  opts: { min: number; max: number; required?: boolean; nullable?: boolean },
): number | null | undefined {
  const raw = src[key];
  if (raw === undefined) {
    if (opts.required) e.add(key, "is required");
    return undefined;
  }
  if (raw === null && opts.nullable) return null;
  const n = toNumber(raw);
  if (n === null || !Number.isInteger(n)) {
    e.add(key, "must be a whole number");
    return undefined;
  }
  if (n < opts.min || n > opts.max) {
    e.add(key, `must be between ${opts.min} and ${opts.max}`);
    return undefined;
  }
  return n;
}

/** Non-negative INR amount with at most 2 decimal places. */
function readMoney(
  src: Record<string, unknown>,
  key: string,
  e: FieldErrors,
  opts: { min: number; max: number; required?: boolean },
): number | undefined {
  const raw = src[key];
  if (raw === undefined || raw === null) {
    if (opts.required) e.add(key, "is required");
    else if (raw === null) e.add(key, "must be a number");
    return undefined;
  }
  const n = toNumber(raw);
  if (n === null) {
    e.add(key, "must be a number");
    return undefined;
  }
  if (Math.round(n * 100) !== Math.round(n * 100 * 1e6) / 1e6) {
    e.add(key, "must have at most 2 decimal places");
    return undefined;
  }
  if (n < opts.min || n > opts.max) {
    e.add(key, `must be between ${opts.min} and ${opts.max}`);
    return undefined;
  }
  return Math.round(n * 100) / 100;
}

function readDate(src: Record<string, unknown>, key: string, e: FieldErrors, required: boolean): string | undefined {
  const raw = src[key];
  if (raw === undefined) {
    if (required) e.add(key, "is required");
    return undefined;
  }
  if (typeof raw !== "string" || !isRealDate(raw)) {
    e.add(key, "must be a valid date (YYYY-MM-DD)");
    return undefined;
  }
  return raw;
}

function readCoordinate(
  src: Record<string, unknown>,
  key: string,
  e: FieldErrors,
  limit: 90 | 180,
): number | null | undefined {
  const raw = src[key];
  if (raw === undefined) return undefined;
  if (raw === null) return null;
  const n = toNumber(raw);
  if (n === null || n < -limit || n > limit) {
    e.add(key, `must be between -${limit} and ${limit}`);
    return undefined;
  }
  return n;
}

function rejectUnknownKeys(src: Record<string, unknown>, allowed: readonly string[], e: FieldErrors) {
  for (const key of Object.keys(src)) {
    if (!allowed.includes(key)) e.add(key, "is not an allowed field");
  }
}

function requireObject(body: unknown): Record<string, unknown> {
  if (!isRecord(body)) throw new ValidationError({ body: "must be a JSON object" });
  return body;
}

function readInterests(src: Record<string, unknown>, e: FieldErrors): Interest[] | undefined {
  const raw = src.interests;
  if (raw === undefined) return undefined;
  if (!Array.isArray(raw)) {
    e.add("interests", "must be an array");
    return undefined;
  }
  if (raw.length > LIMITS.MAX_INTERESTS) {
    e.add("interests", `must contain at most ${LIMITS.MAX_INTERESTS} items`);
    return undefined;
  }
  const result: Interest[] = [];
  for (const item of raw) {
    if (typeof item !== "string" || !(INTERESTS as readonly string[]).includes(item)) {
      e.add("interests", `items must be one of: ${INTERESTS.join(", ")}`);
      return undefined;
    }
    if (!result.includes(item as Interest)) result.push(item as Interest);
  }
  return result;
}

function checkTripDates(
  start: string | undefined,
  end: string | undefined,
  e: FieldErrors,
  opts: { today: string; allowPastStart: boolean },
) {
  if (!start || !end) return;
  if (end < start) {
    e.add("end_date", "must be on or after start_date");
    return;
  }
  const days = tripDayCount(start, end);
  if (days > LIMITS.MAX_TRIP_DAYS) {
    e.add("end_date", `trips can be at most ${LIMITS.MAX_TRIP_DAYS} days long`);
  }
  if (!opts.allowPastStart && start < addDaysUtc(opts.today, -1)) {
    e.add("start_date", "must not be in the past");
  }
  if (start > addDaysUtc(opts.today, LIMITS.MAX_START_DAYS_AHEAD)) {
    e.add("start_date", `must be within ${LIMITS.MAX_START_DAYS_AHEAD} days from today`);
  }
}

// ------------------------------------------------------------------------------
// Trip generation input
// ------------------------------------------------------------------------------

export type TripInput = {
  destination: string;
  start_date: string;
  end_date: string;
  travelers: number;
  budget: number;
  travel_style: TravelStyle;
  interests: Interest[];
  pace: Pace;
  preferences: string | null;
};

export const TRIP_INPUT_FIELDS = [
  "destination",
  "start_date",
  "end_date",
  "travelers",
  "budget",
  "travel_style",
  "interests",
  "pace",
  "preferences",
  "notes",
] as const;

export function parseTripInput(
  body: unknown,
  opts: { today?: string; allowPastStart?: boolean; extraAllowedKeys?: readonly string[] } = {},
): TripInput {
  const src = requireObject(body);
  const e = new FieldErrors();
  rejectUnknownKeys(src, [...TRIP_INPUT_FIELDS, ...(opts.extraAllowedKeys ?? [])], e);

  const destination = readText(src, "destination", e, { min: 2, max: 100, required: true });
  if (destination && !DESTINATION_RE.test(destination)) {
    e.add("destination", "may only contain letters, numbers, spaces and basic punctuation");
  }
  const start_date = readDate(src, "start_date", e, true);
  const end_date = readDate(src, "end_date", e, true);
  const travelers = readInt(src, "travelers", e, {
    min: LIMITS.MIN_TRAVELERS,
    max: LIMITS.MAX_TRAVELERS,
    required: true,
  });
  const budget = readMoney(src, "budget", e, { min: LIMITS.MIN_BUDGET, max: LIMITS.MAX_BUDGET, required: true });
  const travel_style = readEnum(src, "travel_style", e, TRAVEL_STYLES) ?? "mid_range";
  const pace = readEnum(src, "pace", e, PACES) ?? "moderate";
  const interests = readInterests(src, e) ?? [];
  // `notes` is the legacy name used by the existing form; `preferences` wins if both are sent.
  const prefKey = src.preferences !== undefined ? "preferences" : "notes";
  const preferences = readText(src, prefKey, e, { max: 1000, nullable: true }) ?? null;

  checkTripDates(start_date, end_date, e, {
    today: opts.today ?? utcToday(),
    allowPastStart: opts.allowPastStart ?? false,
  });
  e.throwIfAny();

  return {
    destination: destination!,
    start_date: start_date!,
    end_date: end_date!,
    travelers: travelers!,
    budget: budget!,
    travel_style: travel_style as TravelStyle,
    interests,
    pace: pace as Pace,
    preferences,
  };
}

export type GenerateRequest = {
  trip_id: string | null;
  confirm_regenerate: boolean;
  /** Raw trip fields; validated with parseTripInput after merging with the stored trip. */
  fields: Record<string, unknown>;
};

export function parseGenerateRequest(body: unknown): GenerateRequest {
  const src = requireObject(body);
  const { trip_id, confirm_regenerate, ...fields } = src;
  const e = new FieldErrors();
  if (trip_id !== undefined && trip_id !== null && !isUuid(trip_id)) e.add("trip_id", "must be a valid id");
  if (confirm_regenerate !== undefined && typeof confirm_regenerate !== "boolean") {
    e.add("confirm_regenerate", "must be true or false");
  }
  e.throwIfAny();
  return {
    trip_id: (trip_id as string | undefined) ?? null,
    confirm_regenerate: confirm_regenerate === true,
    fields,
  };
}

// ------------------------------------------------------------------------------
// Trip management
// ------------------------------------------------------------------------------

export type TripUpdate = Partial<{
  title: string;
  budget: number;
  travelers: number;
  travel_style: TravelStyle;
  interests: Interest[];
  pace: Pace;
  notes: string | null;
  status: TripStatus;
  start_date: string;
  end_date: string;
}>;

const TRIP_UPDATE_FIELDS = [
  "title",
  "budget",
  "travelers",
  "travel_style",
  "interests",
  "pace",
  "notes",
  "status",
  "start_date",
  "end_date",
] as const;

export function parseTripUpdate(body: unknown): TripUpdate {
  const src = requireObject(body);
  const e = new FieldErrors();
  rejectUnknownKeys(src, TRIP_UPDATE_FIELDS, e);

  const out: TripUpdate = {};
  const title = readText(src, "title", e, { max: 200 });
  if (title !== undefined && title !== null) out.title = title;
  if (src.title !== undefined && title === "") e.add("title", "must not be empty");
  const budget = readMoney(src, "budget", e, { min: LIMITS.MIN_BUDGET, max: LIMITS.MAX_BUDGET });
  if (budget !== undefined) out.budget = budget;
  const travelers = readInt(src, "travelers", e, { min: LIMITS.MIN_TRAVELERS, max: LIMITS.MAX_TRAVELERS });
  if (travelers != null) out.travelers = travelers;
  const travel_style = readEnum(src, "travel_style", e, TRAVEL_STYLES);
  if (travel_style) out.travel_style = travel_style;
  const pace = readEnum(src, "pace", e, PACES);
  if (pace) out.pace = pace;
  const status = readEnum(src, "status", e, TRIP_STATUSES);
  if (status) out.status = status;
  const interests = readInterests(src, e);
  if (interests) out.interests = interests;
  const notes = readText(src, "notes", e, { max: 1000, nullable: true });
  if (notes !== undefined) out.notes = notes;
  const start_date = readDate(src, "start_date", e, false);
  const end_date = readDate(src, "end_date", e, false);
  if ((start_date === undefined) !== (end_date === undefined) && !e.errors.start_date && !e.errors.end_date) {
    e.add(start_date ? "end_date" : "start_date", "start_date and end_date must be changed together");
  }
  if (start_date && end_date) {
    checkTripDates(start_date, end_date, e, { today: utcToday(), allowPastStart: true });
    out.start_date = start_date;
    out.end_date = end_date;
  }
  if (!Object.keys(src).length) e.add("body", "provide at least one field to update");
  e.throwIfAny();
  return out;
}

export type ActivityInput = Partial<{
  itinerary_day_id: string;
  name: string;
  description: string | null;
  category: ActivityCategory;
  time_slot: TimeSlot | null;
  start_time: string | null;
  duration_minutes: number | null;
  location_name: string | null;
  lat: number | null;
  lng: number | null;
  estimated_cost: number;
  cost_basis: ActivityCostBasis;
  notes: string | null;
}>;

const ACTIVITY_FIELDS = [
  "itinerary_day_id",
  "name",
  "description",
  "category",
  "time_slot",
  "start_time",
  "duration_minutes",
  "location_name",
  "lat",
  "lng",
  "estimated_cost",
  "cost_basis",
  "notes",
] as const;

export function parseActivityInput(body: unknown, mode: "create" | "update"): ActivityInput {
  const src = requireObject(body);
  const e = new FieldErrors();
  rejectUnknownKeys(src, ACTIVITY_FIELDS, e);
  const create = mode === "create";
  const out: ActivityInput = {};

  if (src.itinerary_day_id !== undefined || create) {
    if (!isUuid(src.itinerary_day_id)) e.add("itinerary_day_id", create ? "is required" : "must be a valid id");
    else out.itinerary_day_id = src.itinerary_day_id;
  }
  const name = readText(src, "name", e, { max: 200, required: create });
  if (name) out.name = name;
  const description = readText(src, "description", e, { max: 2000, nullable: true });
  if (description !== undefined) out.description = description;
  const category = readEnum(src, "category", e, ACTIVITY_CATEGORIES);
  if (category) out.category = category;
  const time_slot = readEnum(src, "time_slot", e, TIME_SLOTS, { nullable: true });
  if (time_slot !== undefined) out.time_slot = time_slot;
  if (src.start_time !== undefined) {
    if (src.start_time === null || src.start_time === "") out.start_time = null;
    else if (typeof src.start_time === "string" && TIME_RE.test(src.start_time)) out.start_time = src.start_time;
    else e.add("start_time", "must be a 24-hour time (HH:MM)");
  }
  const duration = readInt(src, "duration_minutes", e, { min: 0, max: 1440, nullable: true });
  if (duration !== undefined) out.duration_minutes = duration;
  const location = readText(src, "location_name", e, { max: 300, nullable: true });
  if (location !== undefined) out.location_name = location;
  const lat = readCoordinate(src, "lat", e, 90);
  const lng = readCoordinate(src, "lng", e, 180);
  if ((lat === undefined) !== (lng === undefined) || (lat === null) !== (lng === null)) {
    if (!e.errors.lat && !e.errors.lng) e.add("lat", "lat and lng must be provided together");
  } else if (lat !== undefined) {
    out.lat = lat;
    out.lng = lng;
  }
  const cost = readMoney(src, "estimated_cost", e, { min: 0, max: LIMITS.MAX_AMOUNT });
  if (cost !== undefined) out.estimated_cost = cost;
  const basis = readEnum(src, "cost_basis", e, ACTIVITY_COST_BASES);
  if (basis) out.cost_basis = basis;
  const notes = readText(src, "notes", e, { max: 1000, nullable: true });
  if (notes !== undefined) out.notes = notes;

  if (!create && !Object.keys(src).length) e.add("body", "provide at least one field to update");
  e.throwIfAny();
  return out;
}

export type ExpenseInput = Partial<{
  category: ExpenseCategory;
  title: string;
  amount: number;
  quantity: number;
  cost_basis: CostBasis;
  notes: string | null;
  is_estimate: boolean;
}>;

const EXPENSE_FIELDS = ["category", "title", "amount", "quantity", "cost_basis", "notes", "is_estimate"] as const;

export function parseExpenseInput(body: unknown, mode: "create" | "update"): ExpenseInput {
  const src = requireObject(body);
  const e = new FieldErrors();
  rejectUnknownKeys(src, EXPENSE_FIELDS, e);
  const create = mode === "create";
  const out: ExpenseInput = {};

  const category = readEnum(src, "category", e, EXPENSE_CATEGORIES, { required: create });
  if (category) out.category = category;
  const title = readText(src, "title", e, { max: 200, required: create });
  if (title) out.title = title;
  const amount = readMoney(src, "amount", e, { min: 0, max: LIMITS.MAX_AMOUNT, required: create });
  if (amount !== undefined) out.amount = amount;
  // When omitted on create, the handler defaults quantity from the cost basis (nights, days or 1).
  if (src.quantity !== undefined) {
    const q = readMoney(src, "quantity", e, { min: 0.01, max: LIMITS.MAX_QUANTITY });
    if (q !== undefined) out.quantity = q;
  }
  const basis = readEnum(src, "cost_basis", e, COST_BASES);
  if (basis) out.cost_basis = basis;
  else if (create && src.cost_basis === undefined) out.cost_basis = "total";
  const notes = readText(src, "notes", e, { max: 1000, nullable: true });
  if (notes !== undefined) out.notes = notes;
  if (src.is_estimate !== undefined) {
    if (typeof src.is_estimate !== "boolean") e.add("is_estimate", "must be true or false");
    else out.is_estimate = src.is_estimate;
  } else if (create) {
    out.is_estimate = false;
  }

  if (!create && !Object.keys(src).length) e.add("body", "provide at least one field to update");
  e.throwIfAny();
  return out;
}

export function parseReorderInput(body: unknown): { itinerary_day_id: string; activity_ids: string[] } {
  const src = requireObject(body);
  const e = new FieldErrors();
  rejectUnknownKeys(src, ["itinerary_day_id", "activity_ids"], e);
  if (!isUuid(src.itinerary_day_id)) e.add("itinerary_day_id", "is required");
  const ids = src.activity_ids;
  if (!Array.isArray(ids) || ids.length === 0 || ids.length > LIMITS.MAX_ACTIVITIES_PER_DAY) {
    e.add("activity_ids", `must be a list of 1–${LIMITS.MAX_ACTIVITIES_PER_DAY} activity ids`);
  } else if (!ids.every(isUuid)) {
    e.add("activity_ids", "must contain only valid ids");
  } else if (new Set(ids).size !== ids.length) {
    e.add("activity_ids", "must not contain duplicates");
  }
  e.throwIfAny();
  return { itinerary_day_id: src.itinerary_day_id as string, activity_ids: ids as string[] };
}

// ------------------------------------------------------------------------------
// AI output validation
// ------------------------------------------------------------------------------

export class AiOutputError extends ApiError {
  problems: string[];

  constructor(problems: string[]) {
    super(502, "AI_INVALID_OUTPUT", "The AI returned an incomplete itinerary. Nothing was saved; please try again.", {
      problems: problems.slice(0, 10),
    });
    this.name = "AiOutputError";
    this.problems = problems;
  }
}

export type NormalizedDay = { id: string; day_number: number; date: string; title: string; summary: string };

export type NormalizedActivity = {
  id: string;
  itinerary_day_id: string;
  name: string;
  description: string;
  category: ActivityCategory;
  time_slot: TimeSlot;
  start_time: string | null;
  duration_minutes: number;
  location_name: string;
  lat: number | null;
  lng: number | null;
  estimated_cost: number;
  cost_basis: ActivityCostBasis;
  notes: string | null;
  sort_order: number;
};

export type NormalizedExpense = {
  category: ExpenseCategory;
  title: string;
  amount: number;
  quantity: number;
  cost_basis: CostBasis;
  notes: string | null;
};

export type NormalizedItinerary = {
  title: string;
  destination_lat: number | null;
  destination_lng: number | null;
  travel_notes: string | null;
  days: NormalizedDay[];
  activities: NormalizedActivity[];
  expenses: NormalizedExpense[];
  warnings: string[];
};

const SLOT_ORDER: Record<TimeSlot, number> = { morning: 0, afternoon: 1, evening: 2 };
const MAX_COORD_DISTANCE_DEG = 3;

function aiText(raw: unknown, max: number): string | null {
  if (typeof raw !== "string") return null;
  const value = cleanText(raw);
  if (!value) return null;
  return value.length > max ? `${value.slice(0, max - 1)}…` : value;
}

function slotFromTime(time: string | null): TimeSlot | null {
  if (!time) return null;
  const hour = Number(time.slice(0, 2));
  return hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening";
}

function aiCoords(
  latRaw: unknown,
  lngRaw: unknown,
  anchor: { lat: number; lng: number } | null,
): { lat: number | null; lng: number | null } {
  const lat = toNumber(latRaw);
  const lng = toNumber(lngRaw);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180 || (lat === 0 && lng === 0)) {
    return { lat: null, lng: null };
  }
  if (
    anchor &&
    (Math.abs(lat - anchor.lat) > MAX_COORD_DISTANCE_DEG || Math.abs(lng - anchor.lng) > MAX_COORD_DISTANCE_DEG)
  ) {
    return { lat: null, lng: null }; // implausibly far from the destination
  }
  return { lat, lng };
}

/**
 * Validates and normalises raw LLM JSON. Recoverable issues (over-long text, an
 * unknown category, implausible coordinates) are repaired and reported as
 * warnings; structural problems throw AiOutputError so nothing gets saved.
 */
export function validateAiItinerary(
  raw: unknown,
  input: TripInput,
  makeId: () => string = () => crypto.randomUUID(),
): NormalizedItinerary {
  const problems: string[] = [];
  const warnings: string[] = [];
  if (!isRecord(raw)) throw new AiOutputError(["response is not a JSON object"]);

  if (raw.destination_valid === false) {
    const reason = aiText(raw.destination_issue, 200);
    throw new ApiError(
      422,
      "INVALID_DESTINATION",
      reason ? `We couldn't plan for that destination: ${reason}` : "We couldn't recognise that destination.",
    );
  }

  const dayCount = tripDayCount(input.start_date, input.end_date);
  const nights = tripNightCount(input.start_date, input.end_date);

  const destLat = toNumber(raw.destination_lat);
  const destLng = toNumber(raw.destination_lng);
  const destCoords =
    destLat !== null && destLng !== null && Math.abs(destLat) <= 90 && Math.abs(destLng) <= 180
      ? { lat: destLat, lng: destLng }
      : null;

  const travelNotesRaw = Array.isArray(raw.travel_notes)
    ? raw.travel_notes.filter((n) => typeof n === "string").join("\n")
    : raw.travel_notes;

  const result: NormalizedItinerary = {
    title: aiText(raw.title, 200) ?? `${dayCount}-day ${input.destination} trip`,
    destination_lat: destCoords?.lat ?? null,
    destination_lng: destCoords?.lng ?? null,
    travel_notes: aiText(travelNotesRaw, 4000),
    days: [],
    activities: [],
    expenses: [],
    warnings,
  };

  // ---- Days & activities ----
  const rawDays = raw.itinerary_days;
  if (!Array.isArray(rawDays)) {
    throw new AiOutputError(["itinerary_days is missing"]);
  }
  if (rawDays.length !== dayCount) {
    problems.push(`expected ${dayCount} itinerary days, got ${rawDays.length}`);
  }

  const seenDayNumbers = new Set<number>();
  rawDays.slice(0, dayCount).forEach((rawDay, index) => {
    const path = `itinerary_days[${index}]`;
    if (!isRecord(rawDay)) {
      problems.push(`${path} is not an object`);
      return;
    }
    const dayNumberRaw = toNumber(rawDay.day_number);
    const dayNumber = dayNumberRaw !== null && Number.isInteger(dayNumberRaw) ? dayNumberRaw : index + 1;
    if (dayNumber < 1 || dayNumber > dayCount || seenDayNumbers.has(dayNumber)) {
      problems.push(`${path}.day_number ${dayNumber} is out of range or repeated`);
      return;
    }
    seenDayNumbers.add(dayNumber);

    const dayId = makeId();
    const day: NormalizedDay = {
      id: dayId,
      day_number: dayNumber,
      // Dates are derived from the trip, never trusted from the model.
      date: addDaysUtc(input.start_date, dayNumber - 1),
      title: aiText(rawDay.title, 200) ?? `Day ${dayNumber} in ${input.destination}`,
      summary: aiText(rawDay.summary, 1000) ?? "",
    };

    const rawActivities = rawDay.activities;
    if (!Array.isArray(rawActivities)) {
      problems.push(`${path}.activities is missing`);
      return;
    }
    if (
      rawActivities.length < LIMITS.MIN_AI_ACTIVITIES_PER_DAY ||
      rawActivities.length > LIMITS.MAX_AI_ACTIVITIES_PER_DAY
    ) {
      problems.push(
        `${path} must have ${LIMITS.MIN_AI_ACTIVITIES_PER_DAY}–${LIMITS.MAX_AI_ACTIVITIES_PER_DAY} activities, got ${rawActivities.length}`,
      );
      return;
    }

    const dayActivities: NormalizedActivity[] = [];
    rawActivities.forEach((rawAct, j) => {
      const ap = `${path}.activities[${j}]`;
      if (!isRecord(rawAct)) {
        problems.push(`${ap} is not an object`);
        return;
      }
      const name = aiText(rawAct.name, 200);
      if (!name) problems.push(`${ap}.name is missing`);
      const description = aiText(rawAct.description, 2000);
      if (!description) problems.push(`${ap}.description is missing`);
      const location = aiText(rawAct.location_name, 300);
      if (!location) problems.push(`${ap}.location_name is missing`);

      const startTime = typeof rawAct.start_time === "string" && TIME_RE.test(rawAct.start_time.trim())
        ? rawAct.start_time.trim()
        : null;
      const slotRaw = typeof rawAct.time_slot === "string" ? rawAct.time_slot.toLowerCase().trim() : "";
      const slot = (TIME_SLOTS as readonly string[]).includes(slotRaw) ? (slotRaw as TimeSlot) : slotFromTime(startTime);
      if (!slot) problems.push(`${ap}.time_slot is missing`);

      const durationRaw = toNumber(rawAct.duration_minutes);
      const duration = durationRaw === null ? null : Math.round(durationRaw);
      if (duration === null || duration < 10 || duration > 720) {
        problems.push(`${ap}.duration_minutes must be 10–720`);
      }

      const cost = toNumber(rawAct.estimated_cost);
      if (cost === null || cost < 0) problems.push(`${ap}.estimated_cost must be a non-negative number`);
      else if (cost > input.budget) problems.push(`${ap}.estimated_cost exceeds the entire trip budget`);

      const categoryRaw = typeof rawAct.category === "string" ? rawAct.category.toLowerCase().trim() : "";
      const category = (ACTIVITY_CATEGORIES as readonly string[]).includes(categoryRaw)
        ? (categoryRaw as ActivityCategory)
        : "activity";
      if (category !== categoryRaw) warnings.push(`${ap}.category "${categoryRaw}" replaced with "activity"`);

      const basisRaw = typeof rawAct.cost_basis === "string" ? rawAct.cost_basis : "per_person";
      const costBasis = (ACTIVITY_COST_BASES as readonly string[]).includes(basisRaw)
        ? (basisRaw as ActivityCostBasis)
        : "per_person";

      const coords = aiCoords(rawAct.lat, rawAct.lng, destCoords);
      if (coords.lat === null && rawAct.lat != null) warnings.push(`${ap} coordinates dropped as implausible`);

      if (!name || !description || !location || !slot || duration === null || cost === null) return;
      dayActivities.push({
        id: makeId(),
        itinerary_day_id: dayId,
        name,
        description,
        category,
        time_slot: slot,
        start_time: startTime,
        duration_minutes: duration,
        location_name: location,
        lat: coords.lat,
        lng: coords.lng,
        estimated_cost: Math.round(cost * 100) / 100,
        cost_basis: costBasis,
        notes: aiText(rawAct.travel_notes ?? rawAct.notes, 1000),
        sort_order: 0,
      });
    });

    for (const slot of TIME_SLOTS) {
      if (!dayActivities.some((a) => a.time_slot === slot)) problems.push(`${path} has no ${slot} activity`);
    }

    dayActivities
      .sort((a, b) => SLOT_ORDER[a.time_slot] - SLOT_ORDER[b.time_slot] || (a.start_time ?? "").localeCompare(b.start_time ?? ""))
      .forEach((a, order) => {
        a.sort_order = order;
      });

    result.days.push(day);
    result.activities.push(...dayActivities);
  });

  for (let n = 1; n <= dayCount; n += 1) {
    if (!seenDayNumbers.has(n) && rawDays.length === dayCount) problems.push(`day ${n} is missing`);
  }
  result.days.sort((a, b) => a.day_number - b.day_number);

  // ---- Standalone expenses ----
  const rawExpenses = raw.expenses;
  if (!Array.isArray(rawExpenses)) {
    problems.push("expenses is missing");
  } else {
    if (rawExpenses.length > LIMITS.MAX_AI_EXPENSES) problems.push(`too many expenses (${rawExpenses.length})`);
    const seen = new Set<string>();
    rawExpenses.slice(0, LIMITS.MAX_AI_EXPENSES).forEach((rawExp, k) => {
      const ep = `expenses[${k}]`;
      if (!isRecord(rawExp)) {
        problems.push(`${ep} is not an object`);
        return;
      }
      const category = typeof rawExp.category === "string" ? rawExp.category.toLowerCase().trim() : "";
      if (!(EXPENSE_CATEGORIES as readonly string[]).includes(category)) {
        problems.push(`${ep}.category "${category}" is not valid`);
        return;
      }
      if (category === "activities") {
        // Activity costs are itemised on activities; a lump sum here would double count.
        warnings.push(`${ep} dropped: activity costs must be itemised on activities`);
        return;
      }
      const title = aiText(rawExp.title, 200);
      if (!title) {
        problems.push(`${ep}.title is missing`);
        return;
      }
      const amount = toNumber(rawExp.amount);
      if (amount === null || amount < 0 || amount > input.budget * 2) {
        problems.push(`${ep}.amount is invalid`);
        return;
      }
      const basisRaw = typeof rawExp.cost_basis === "string" ? rawExp.cost_basis : "total";
      if (!(COST_BASES as readonly string[]).includes(basisRaw)) {
        problems.push(`${ep}.cost_basis "${basisRaw}" is not valid`);
        return;
      }
      const basis = basisRaw as CostBasis;
      let quantity: number;
      if (basis === "per_night" || basis === "per_person_per_night") {
        if (nights === 0) {
          warnings.push(`${ep} dropped: per-night cost on a same-day trip`);
          return;
        }
        quantity = nights; // always the real number of nights
      } else if (basis === "per_day" || basis === "per_person_per_day") {
        quantity = dayCount;
      } else {
        const q = toNumber(rawExp.quantity);
        quantity = q !== null && q > 0 && q <= LIMITS.MAX_QUANTITY ? Math.round(q * 100) / 100 : 1;
      }
      const key = `${category}|${title.toLowerCase()}`;
      if (seen.has(key)) {
        warnings.push(`${ep} dropped as a duplicate of an earlier expense`);
        return;
      }
      seen.add(key);
      result.expenses.push({
        category: category as ExpenseCategory,
        title,
        amount: Math.round(amount * 100) / 100,
        quantity,
        cost_basis: basis,
        notes: aiText(rawExp.notes, 1000),
      });
    });
  }

  // ---- Double-counting guard for accommodation ----
  const hasStayExpense = result.expenses.some((x) => x.category === "accommodation");
  if (hasStayExpense) {
    for (const activity of result.activities) {
      if (activity.category === "accommodation" && activity.estimated_cost > 0) {
        activity.estimated_cost = 0;
        warnings.push(`"${activity.name}" cost zeroed: accommodation is budgeted as a nightly expense`);
      }
    }
  } else if (nights > 0 && !result.activities.some((a) => a.category === "accommodation" && a.estimated_cost > 0)) {
    problems.push("accommodation cost is missing for an overnight trip");
  }

  if (problems.length) throw new AiOutputError(problems.slice(0, 25));
  return result;
}
