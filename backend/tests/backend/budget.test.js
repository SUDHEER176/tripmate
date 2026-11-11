import { test } from "node:test";
import assert from "node:assert/strict";
import {
  activityExpenseCategory,
  addDaysUtc,
  calculateBudget,
  dedupeExpenses,
  expenseLineTotal,
  tripDayCount,
  tripNightCount,
} from "../../supabase/functions/_shared/budget.js";

test("line totals apply each cost basis correctly", () => {
  const travelers = 3;
  const line = (cost_basis, amount, quantity = 1) =>
    expenseLineTotal(
      { category: "miscellaneous", amount, quantity, cost_basis },
      travelers,
    );

  assert.equal(line("total", 1500), 1500); // group price, not multiplied
  assert.equal(line("total", 500, 2), 1000); // two units for the group
  assert.equal(line("per_person", 400), 1200); // 400 × 3 travelers
  assert.equal(line("per_night", 3000, 4), 12000); // room for the group × 4 nights
  assert.equal(line("per_person_per_night", 800, 4), 9600); // 800 × 4 nights × 3 travelers
  assert.equal(line("per_day", 2500, 5), 12500); // car hire × 5 days
  assert.equal(line("per_person_per_day", 200, 5), 3000); // 200 × 5 days × 3 travelers
});

test("money math is exact to the paisa", () => {
  const total = calculateBudget({
    budget: 1,
    travelers: 1,
    expenses: [
      { category: "food", amount: 0.1, cost_basis: "total" },
      { category: "food", amount: 0.2, cost_basis: "total" },
    ],
  });
  assert.equal(total.estimated_total, 0.3);
  assert.equal(total.remaining, 0.7);
});

test("numeric strings from PostgREST are accepted", () => {
  assert.equal(
    expenseLineTotal(
      {
        category: "food",
        amount: "199.50",
        quantity: "2",
        cost_basis: "total",
      },
      1,
    ),
    399,
  );
});

test("summary reports totals, per-traveler cost, utilisation and categories", () => {
  const summary = calculateBudget({
    budget: 50000,
    travelers: 2,
    expenses: [
      {
        id: "a",
        category: "accommodation",
        amount: 4000,
        quantity: 3,
        cost_basis: "per_night",
      }, // 12000
      {
        id: "b",
        category: "transport",
        amount: 6000,
        cost_basis: "per_person",
      }, // 12000
      {
        id: "c",
        activity_id: "act1",
        category: "activities",
        amount: 750,
        cost_basis: "per_person",
      }, // 1500
      {
        id: "d",
        activity_id: "act2",
        category: "food",
        amount: 1200,
        cost_basis: "total",
        is_estimate: false,
      }, // 1200
      {
        id: "e",
        category: "local_travel",
        amount: 300,
        quantity: 4,
        cost_basis: "per_person_per_day",
      }, // 2400
    ],
  });
  assert.equal(summary.currency, "INR");
  assert.equal(summary.total_budget, 50000);
  assert.equal(summary.estimated_total, 29100);
  assert.equal(summary.remaining, 20900);
  assert.equal(summary.cost_per_traveler, 14550);
  assert.equal(summary.utilization_pct, 58.2);
  assert.equal(summary.is_over_budget, false);
  assert.equal(summary.expense_count, 5);
  assert.equal(summary.includes_estimates, true);

  const byCat = Object.fromEntries(
    summary.categories.map((c) => [c.category, c]),
  );
  assert.equal(summary.categories.length, 6);
  assert.equal(byCat.accommodation.total, 12000);
  assert.equal(byCat.transport.total, 12000);
  assert.equal(byCat.activities.total, 1500);
  assert.equal(byCat.food.total, 1200);
  assert.equal(byCat.local_travel.total, 2400);
  assert.equal(byCat.miscellaneous.total, 0);
  assert.equal(byCat.miscellaneous.share_pct, 0);
  const shareSum = summary.categories.reduce((sum, c) => sum + c.share_pct, 0);
  assert.ok(Math.abs(shareSum - 100) < 0.5);
});

test("exceeded budget is flagged with negative remaining", () => {
  const summary = calculateBudget({
    budget: 10000,
    travelers: 1,
    expenses: [{ category: "transport", amount: 12500, cost_basis: "total" }],
  });
  assert.equal(summary.is_over_budget, true);
  assert.equal(summary.remaining, -2500);
  assert.equal(summary.utilization_pct, 125);
});

test("exactly-on-budget is not over budget", () => {
  const summary = calculateBudget({
    budget: 10000,
    travelers: 1,
    expenses: [{ category: "transport", amount: 10000, cost_basis: "total" }],
  });
  assert.equal(summary.is_over_budget, false);
  assert.equal(summary.remaining, 0);
});

test("empty trip and zero budget", () => {
  const summary = calculateBudget({ budget: 0, travelers: 4, expenses: [] });
  assert.equal(summary.estimated_total, 0);
  assert.equal(summary.utilization_pct, null);
  assert.equal(summary.includes_estimates, false);
  assert.equal(summary.cost_per_traveler, 0);
});

test("duplicates are never double counted", () => {
  const expenses = [
    { id: "x", category: "food", amount: 100, cost_basis: "total" },
    { id: "x", category: "food", amount: 100, cost_basis: "total" }, // same row twice
    {
      id: "y",
      activity_id: "act",
      category: "activities",
      amount: 500,
      cost_basis: "total",
    },
    {
      id: "z",
      activity_id: "act",
      category: "activities",
      amount: 500,
      cost_basis: "total",
    }, // same activity
  ];
  assert.equal(dedupeExpenses(expenses).length, 2);
  assert.equal(
    calculateBudget({ budget: 1000, travelers: 1, expenses }).estimated_total,
    600,
  );
});

test("invalid amounts are rejected", () => {
  assert.throws(
    () =>
      expenseLineTotal(
        { category: "food", amount: -1, cost_basis: "total" },
        1,
      ),
    RangeError,
  );
  assert.throws(
    () =>
      expenseLineTotal(
        { category: "food", amount: Number.NaN, cost_basis: "total" },
        1,
      ),
    RangeError,
  );
  assert.throws(
    () =>
      expenseLineTotal(
        { category: "food", amount: "abc", cost_basis: "total" },
        1,
      ),
    RangeError,
  );
  assert.throws(
    () =>
      expenseLineTotal(
        { category: "food", amount: 1, quantity: 0, cost_basis: "total" },
        1,
      ),
    RangeError,
  );
  assert.throws(
    () =>
      expenseLineTotal({ category: "food", amount: 1, cost_basis: "total" }, 0),
    RangeError,
  );
  assert.throws(
    () =>
      calculateBudget({
        budget: 1,
        travelers: 1,
        expenses: [{ category: "nope", amount: 1, cost_basis: "total" }],
      }),
    RangeError,
  );
});

test("activity categories map onto budget categories", () => {
  assert.equal(activityExpenseCategory("food"), "food");
  assert.equal(activityExpenseCategory("transport"), "local_travel");
  assert.equal(activityExpenseCategory("accommodation"), "accommodation");
  assert.equal(activityExpenseCategory("shopping"), "miscellaneous");
  assert.equal(activityExpenseCategory("sightseeing"), "activities");
  assert.equal(activityExpenseCategory("nightlife"), "activities");
  assert.equal(activityExpenseCategory("activity"), "activities");
});

test("date helpers are timezone-safe", () => {
  assert.equal(tripDayCount("2026-12-30", "2027-01-02"), 4);
  assert.equal(tripNightCount("2026-12-30", "2027-01-02"), 3);
  assert.equal(tripNightCount("2026-12-30", "2026-12-30"), 0);
  assert.equal(addDaysUtc("2028-02-28", 1), "2028-02-29");
  assert.equal(addDaysUtc("2026-03-01", -1), "2026-02-28");
});
