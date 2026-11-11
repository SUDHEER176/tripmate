// Budget calculation shared by the Edge Functions and the React frontend.
// Pure TypeScript with no imports, so Deno, Vite and Node all load it unchanged.
//
// All arithmetic is done in integer paise to avoid floating-point drift; results
// are returned in rupees rounded to 2 decimals.

export const CURRENCY = "INR";

export const EXPENSE_CATEGORIES = [
  "transport",
  "accommodation",
  "food",
  "activities",
  "local_travel",
  "miscellaneous",
];

export const EXPENSE_CATEGORY_LABELS = {
  transport: "Transport",
  accommodation: "Accommodation",
  food: "Food",
  activities: "Activities & entry fees",
  local_travel: "Local travel",
  miscellaneous: "Miscellaneous",
};

/**
 * How an expense's `amount` scales:
 *   total                 one price for the whole group, × quantity
 *   per_person            each traveler pays amount, × quantity
 *   per_night             group pays amount per night, quantity = nights
 *   per_person_per_night  each traveler pays amount per night, quantity = nights
 *   per_day               group pays amount per day, quantity = days
 *   per_person_per_day    each traveler pays amount per day, quantity = days
 */
export const COST_BASES = [
  "total",
  "per_person",
  "per_night",
  "per_person_per_night",
  "per_day",
  "per_person_per_day",
];

export const COST_BASIS_LABELS = {
  total: "for the group",
  per_person: "per person",
  per_night: "per night (group)",
  per_person_per_night: "per person, per night",
  per_day: "per day (group)",
  per_person_per_day: "per person, per day",
};

export const ACTIVITY_COST_BASES = ["per_person", "total"];

/** Mirrors the CASE in public.sync_activity_expense() (SQL migration). Keep them in sync. */
export function activityExpenseCategory(category) {
  switch (category) {
    case "food":
      return "food";
    case "transport":
      return "local_travel";
    case "accommodation":
      return "accommodation";
    case "shopping":
      return "miscellaneous";
    default:
      return "activities";
  }
}

export function isPerPersonBasis(basis) {
  return (
    basis === "per_person" ||
    basis === "per_person_per_night" ||
    basis === "per_person_per_day"
  );
}

function toFiniteNumber(value, field) {
  const n = typeof value === "string" ? Number(value.trim()) : value;
  if (typeof n !== "number" || !Number.isFinite(n)) {
    throw new RangeError(`${field} must be a finite number`);
  }
  return n;
}

function toPaise(value, field) {
  const n = toFiniteNumber(value, field);
  if (n < 0) throw new RangeError(`${field} must not be negative`);
  return Math.round(n * 100);
}

function fromPaise(paise) {
  return Math.round(paise) / 100;
}

function round1(value) {
  return Math.round(value * 10) / 10;
}

function normalizeTravelers(travelers) {
  if (!Number.isInteger(travelers) || travelers < 1) {
    throw new RangeError("travelers must be a positive integer");
  }
  return travelers;
}

function lineTotalPaise(expense, travelers) {
  const amount = toPaise(expense.amount, "amount");
  const quantity =
    expense.quantity == null ? 1 : toFiniteNumber(expense.quantity, "quantity");
  if (quantity <= 0) throw new RangeError("quantity must be greater than zero");
  const multiplier = isPerPersonBasis(expense.cost_basis) ? travelers : 1;
  return Math.round(amount * quantity * multiplier);
}

/** Total cost of one expense line in rupees, after applying its cost basis. */
export function expenseLineTotal(expense, travelers) {
  return fromPaise(lineTotalPaise(expense, normalizeTravelers(travelers)));
}

/**
 * Removes accidental duplicates before summing: the same expense id twice, or two
 * lines linked to the same activity (an activity cost is only ever counted once).
 */
export function dedupeExpenses(expenses) {
  const seenIds = new Set();
  const seenActivities = new Set();
  const result = [];
  for (const expense of expenses) {
    if (expense.id) {
      if (seenIds.has(expense.id)) continue;
      seenIds.add(expense.id);
    }
    if (expense.activity_id) {
      if (seenActivities.has(expense.activity_id)) continue;
      seenActivities.add(expense.activity_id);
    }
    result.push(expense);
  }
  return result;
}

export function calculateBudget(input) {
  const travelers = normalizeTravelers(input.travelers);
  const budgetPaise = toPaise(input.budget, "budget");
  const expenses = dedupeExpenses(input.expenses);

  const byCategory = new Map(
    EXPENSE_CATEGORIES.map((category) => [category, { paise: 0, count: 0 }]),
  );
  let totalPaise = 0;
  let includesEstimates = false;

  for (const expense of expenses) {
    const bucket = byCategory.get(expense.category);
    if (!bucket)
      throw new RangeError(`Unknown expense category: ${expense.category}`);
    const line = lineTotalPaise(expense, travelers);
    bucket.paise += line;
    bucket.count += 1;
    totalPaise += line;
    if (expense.is_estimate !== false) includesEstimates = true;
  }

  const categories = EXPENSE_CATEGORIES.map((category) => {
    const bucket = byCategory.get(category);
    return {
      category,
      label: EXPENSE_CATEGORY_LABELS[category],
      total: fromPaise(bucket.paise),
      count: bucket.count,
      share_pct: totalPaise > 0 ? round1((bucket.paise / totalPaise) * 100) : 0,
    };
  });

  return {
    currency: CURRENCY,
    total_budget: fromPaise(budgetPaise),
    estimated_total: fromPaise(totalPaise),
    remaining: fromPaise(budgetPaise - totalPaise),
    cost_per_traveler: fromPaise(Math.round(totalPaise / travelers)),
    travelers,
    utilization_pct:
      budgetPaise > 0 ? round1((totalPaise / budgetPaise) * 100) : null,
    is_over_budget: totalPaise > budgetPaise,
    expense_count: expenses.length,
    includes_estimates: includesEstimates,
    categories,
  };
}

/** Inclusive day count between two YYYY-MM-DD dates (UTC, no timezone drift). */
export function tripDayCount(startDate, endDate) {
  const start = Date.parse(`${startDate}T00:00:00Z`);
  const end = Date.parse(`${endDate}T00:00:00Z`);
  return Math.round((end - start) / 86_400_000) + 1;
}

export function tripNightCount(startDate, endDate) {
  return Math.max(0, tripDayCount(startDate, endDate) - 1);
}

/** Adds days to a YYYY-MM-DD date in UTC. */
export function addDaysUtc(date, days) {
  const ms = Date.parse(`${date}T00:00:00Z`) + days * 86_400_000;
  return new Date(ms).toISOString().slice(0, 10);
}
