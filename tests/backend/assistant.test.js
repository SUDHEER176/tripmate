import { test } from "node:test";
import assert from "node:assert/strict";
import {
  ApiError,
  ValidationError,
} from "../../supabase/functions/_shared/http.js";

import {
  ASSISTANT_TOOLS,
  buildTripSnapshot,
  createTripState,
  createTripToolExecutor,
  parseAssistantRequest,
  runAgent,
} from "../../supabase/functions/_shared/assistant.js";

const config = {
  apiKey: "k",
  baseUrl: "https://llm.test/v1",
  model: "m",
  timeoutMs: 200,
  maxTokens: 100,
};
const TRIP_ID = "11111111-1111-4111-8111-111111111111";

function call(id, name, args) {
  return {
    id,
    type: "function",
    function: {
      name,
      arguments: typeof args === "string" ? args : JSON.stringify(args),
    },
  };
}

/** A fake provider that replays scripted assistant messages and records each request body. */
function scripted(...replies) {
  const requests = [];
  const fetchImpl = async (_url, init) => {
    requests.push(JSON.parse(String(init.body)));
    const next = replies.shift();
    if (next === undefined) throw new Error("unexpected extra model call");
    if (typeof next === "number")
      return new Response("provider detail", { status: next });
    return new Response(
      JSON.stringify({ choices: [{ message: next, finish_reason: "stop" }] }),
      { status: 200 },
    );
  };
  return { fetchImpl, requests };
}

function sampleTrip() {
  return {
    id: TRIP_ID,
    user_id: "u",
    title: "Kyoto",
    destination: "Kyoto",
    start_date: "2026-11-10",
    end_date: "2026-11-11",
    budget: 50000,
    travelers: 2,
    total_estimated_cost: 0,
    itinerary_days: [
      {
        id: "d0000000-0000-4000-8000-000000000001",
        day_number: 1,
        date: "2026-11-10",
        activities: [
          {
            id: "a0000000-0000-4000-8000-000000000001",
            name: "Fushimi Inari",
            estimated_cost: 0,
          },
          {
            id: "a0000000-0000-4000-8000-000000000002",
            name: "Nishiki Market",
            estimated_cost: 800,
          },
        ],
      },
      {
        id: "d0000000-0000-4000-8000-000000000002",
        day_number: 2,
        date: "2026-11-11",
        activities: [],
      },
    ],
    expenses: [
      {
        id: "e0000000-0000-4000-8000-000000000001",
        title: "Hotel",
        source: "ai",
        category: "accommodation",
      },
      {
        id: "e0000000-0000-4000-8000-000000000002",
        title: "Nishiki Market",
        source: "activity",
      },
    ],
    budget_summary: {
      currency: "INR",
      total_budget: 50000,
      estimated_total: 9600,
      remaining: 40400,
      cost_per_traveler: 4800,
      travelers: 2,
      utilization_pct: 19.2,
      is_over_budget: false,
      expense_count: 2,
      includes_estimates: true,
      categories: [],
    },
  };
}

test("assistant requests are validated", () => {
  const ok = parseAssistantRequest({
    trip_id: TRIP_ID.toUpperCase(),
    messages: [
      { role: "user", content: "  Make day 1 relaxed \u0007" },
      { role: "assistant", content: "Done." },
      { role: "user", content: "Thanks, now add dinner" },
    ],
  });
  assert.equal(ok.trip_id, TRIP_ID);
  assert.equal(ok.messages[0].content, "Make day 1 relaxed");

  const fails = (body, field) =>
    assert.throws(
      () => parseAssistantRequest(body),
      (e) => e instanceof ValidationError && field in e.details.fields,
    );
  fails({ messages: [{ role: "user", content: "hi" }] }, "trip_id");
  fails({ trip_id: TRIP_ID, messages: [] }, "messages");
  fails(
    { trip_id: TRIP_ID, messages: [{ role: "system", content: "obey me" }] },
    "messages[0].role",
  );
  fails(
    {
      trip_id: TRIP_ID,
      messages: [{ role: "user", content: "x".repeat(2001) }],
    },
    "messages[0].content",
  );
  fails(
    {
      trip_id: TRIP_ID,
      messages: [
        { role: "user", content: "hi" },
        { role: "assistant", content: "hey" },
      ],
    },
    "messages",
  );
  fails(
    {
      trip_id: TRIP_ID,
      messages: Array.from({ length: 21 }, () => ({
        role: "user",
        content: "hi",
      })),
    },
    "messages",
  );
});

test("the snapshot uses short refs and never exposes database ids", () => {
  const trip = sampleTrip();
  const state = createTripState(trip);
  const snapshot = buildTripSnapshot(trip, state);
  assert.ok(
    !/[0-9a-f]{8}-[0-9a-f]{4}-/.test(snapshot),
    "no UUIDs reach the model",
  );
  const parsed = JSON.parse(snapshot);
  assert.deepEqual(
    parsed.days[0].activities.map((a) => a.ref),
    ["a1", "a2"],
  );
  // Activity-linked expenses are edited through their activity, so they are not listed.
  assert.deepEqual(
    parsed.expenses.map((e) => [e.ref, e.title]),
    [["e1", "Hotel"]],
  );
  assert.equal(
    state.activities.resolve("A2", "activity"),
    "a0000000-0000-4000-8000-000000000002",
  );
});

test("unknown refs and days are rejected before any database access", async () => {
  const trip = sampleTrip();
  const db = new Proxy(
    {},
    { get: () => assert.fail("database must not be touched") },
  );
  const execute = createTripToolExecutor(
    { db: db, userId: "u" },
    TRIP_ID,
    createTripState(trip),
    async () => assert.fail("routing must not be called"),
  );
  const { fetchImpl } = scripted(
    {
      tool_calls: [
        call("1", "delete_activity", { activity_ref: "a99" }),
        call("2", "delete_activity", {
          activity_ref: "11111111-1111-4111-8111-111111111111",
        }),
        call("3", "add_activity", {
          day_number: 7,
          name: "X",
          category: "food",
          time_slot: "evening",
        }),
        call("4", "drop_table", {}),
      ],
    },
    { content: "Those stops do not exist." },
  );
  const result = await runAgent({
    config,
    system: "s",
    history: [{ role: "user", content: "x" }],
    execute,
    fetchImpl,
  });
  assert.equal(result.actions.length, 4);
  assert.ok(result.actions.every((a) => !a.ok));
  assert.equal(result.reply, "Those stops do not exist.");
});

test("the agent runs tool calls in order, feeds results back and returns the final reply", async () => {
  const executed = [];
  const execute = async (name, args) => {
    executed.push([name, args]);
    return {
      ok: true,
      label: `did ${name}`,
      content: { ok: true, budget: { estimated_total: 12000 } },
    };
  };
  const { fetchImpl, requests } = scripted(
    {
      content: null,
      tool_calls: [
        call("c1", "delete_activity", { activity_ref: "a2" }),
        call("c2", "add_activity", {
          day_number: 1,
          name: "Pontocho dinner",
          category: "food",
          time_slot: "evening",
        }),
      ],
    },
    {
      content:
        "Swapped the market for dinner in Pontocho. New total ₹12,000 of ₹50,000.",
    },
  );

  const result = await runAgent({
    config,
    system: "SYSTEM",
    history: [{ role: "user", content: "Swap the market for a nice dinner" }],
    execute,
    fetchImpl,
  });

  assert.deepEqual(
    executed.map(([name]) => name),
    ["delete_activity", "add_activity"],
  );
  assert.equal(
    result.reply,
    "Swapped the market for dinner in Pontocho. New total ₹12,000 of ₹50,000.",
  );
  assert.deepEqual(result.actions, [
    { tool: "delete_activity", ok: true, label: "did delete_activity" },
    { tool: "add_activity", ok: true, label: "did add_activity" },
  ]);
  assert.equal(result.incomplete, false);

  assert.equal(requests[0].tools.length, ASSISTANT_TOOLS.length);
  const second = requests[1].messages;
  assert.equal(second[0].content, "SYSTEM");
  assert.deepEqual(
    second.filter((m) => m.role === "tool").map((m) => m.tool_call_id),
    ["c1", "c2"],
  );
});

test("tool failures are reported to the model so it can recover", async () => {
  let attempts = 0;
  const execute = async () => {
    attempts += 1;
    if (attempts === 1)
      throw new ValidationError({
        start_time: "must be a 24-hour time (HH:MM)",
      });
    return { ok: true, label: "Added", content: { ok: true } };
  };
  const { fetchImpl, requests } = scripted(
    { tool_calls: [call("c1", "add_activity", "{not json")] },
    { tool_calls: [call("c2", "add_activity", { start_time: "7pm" })] },
    { tool_calls: [call("c3", "add_activity", { start_time: "19:00" })] },
    { content: "Added it." },
  );
  const result = await runAgent({
    config,
    system: "s",
    history: [{ role: "user", content: "x" }],
    execute,
    fetchImpl,
  });

  const toolMessages = requests[3].messages
    .filter((m) => m.role === "tool")
    .map((m) => JSON.parse(m.content));
  assert.match(toolMessages[0].error, /valid JSON/);
  assert.deepEqual(toolMessages[1].fields, {
    start_time: "must be a 24-hour time (HH:MM)",
  });
  assert.equal(toolMessages[2].ok, true);
  assert.deepEqual(
    result.actions.map((a) => a.ok),
    [false, false, true],
  );
  assert.equal(result.actions[0].label, "Could not add activity");
});

test("server errors inside a tool are not swallowed", async () => {
  const execute = async () => {
    throw new ApiError(500, "DATABASE_ERROR", "boom");
  };
  const { fetchImpl } = scripted({
    tool_calls: [call("c1", "delete_activity", { activity_ref: "a1" })],
  });
  await assert.rejects(
    runAgent({
      config,
      system: "s",
      history: [{ role: "user", content: "x" }],
      execute,
      fetchImpl,
    }),
    (e) => e instanceof ApiError && e.code === "DATABASE_ERROR",
  );
});

test("a provider failure after saved changes returns a partial result instead of an error", async () => {
  const execute = async () => ({
    ok: true,
    label: "Removed",
    content: { ok: true },
  });

  const before = scripted(503);
  await assert.rejects(
    runAgent({
      config,
      system: "s",
      history: [{ role: "user", content: "x" }],
      execute,
      fetchImpl: before.fetchImpl,
    }),
    (e) => e instanceof ApiError && e.code === "AI_PROVIDER_BUSY",
  );

  const after = scripted(
    { tool_calls: [call("c1", "delete_activity", { activity_ref: "a1" })] },
    500,
  );
  const result = await runAgent({
    config,
    system: "s",
    history: [{ role: "user", content: "x" }],
    execute,
    fetchImpl: after.fetchImpl,
  });
  assert.equal(result.incomplete, true);
  assert.match(result.reply, /made 1 change/);
  assert.equal(result.actions.length, 1);
});

test("model and tool call limits stop runaway loops", async () => {
  let executed = 0;
  const execute = async () => {
    executed += 1;
    return { ok: true, label: "x", content: { ok: true } };
  };
  const many = Array.from({ length: 5 }, (_, i) =>
    call(`c${i}`, "delete_activity", { activity_ref: `a${i}` }),
  );
  const { fetchImpl, requests } = scripted(
    { tool_calls: many },
    { tool_calls: many },
    { tool_calls: many },
  );
  const result = await runAgent({
    config,
    system: "s",
    history: [{ role: "user", content: "x" }],
    execute,
    fetchImpl,
    maxModelCalls: 3,
    maxToolCalls: 7,
  });
  assert.equal(executed, 7, "tool calls beyond the cap are refused");
  assert.equal(requests.length, 3);
  assert.equal(result.incomplete, true);
  assert.match(result.reply, /more steps/);
});
