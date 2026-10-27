// Minimal OpenAI-compatible Chat Completions server for integration tests.
//   node --experimental-strip-types tests/integration/mock-llm-server.ts [port]
// Destination "Atlantis"    → destination_valid: false
// Destination "Brokenville" → itinerary missing evening activities (invalid)
// Anything else             → a valid itinerary built from the prompt's dates
// Requests with `tools` (trip assistant):
//   first turn → add_activity "Mock Rooftop Dinner" on day 1 (or delete_activity "a99" if the user mentions a99)
//   after tool results → a short text reply that echoes whether the tool succeeded

import { createServer } from "node:http";
import { buildAiItinerary } from "../fixtures/ai-itinerary.ts";

const port = Number(process.argv[2] ?? 8787);
const expectedKey = process.env.MOCK_LLM_KEY ?? "mock-llm-key";
let calls = 0;

createServer((req, res) => {
  if (req.method === "GET" && req.url === "/calls") {
    res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ calls }));
    return;
  }
  let body = "";
  req.on("data", (chunk) => (body += chunk));
  req.on("end", () => {
    calls += 1;
    if (req.headers.authorization !== `Bearer ${expectedKey}`) {
      res.writeHead(401).end(JSON.stringify({ error: "bad key" }));
      return;
    }
    const parsed = JSON.parse(body);
    if (Array.isArray(parsed.tools)) {
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify(assistantReply(parsed.messages)));
      return;
    }
    const user: string = parsed.messages[1].content;
    const request = JSON.parse(user.slice(user.indexOf("{"), user.indexOf("\n\nReturn JSON")));

    let itinerary: unknown;
    if (String(request.destination).includes("Atlantis")) {
      itinerary = { destination_valid: false, destination_issue: "Atlantis is a mythical place" };
    } else {
      const full = buildAiItinerary({ destination: request.destination, dates: request.dates, nights: request.nights });
      if (String(request.destination).includes("Brokenville")) {
        for (const day of full.itinerary_days) day.activities = day.activities.filter((a) => a.time_slot !== "evening");
      }
      itinerary = full;
    }
    res.writeHead(200, { "content-type": "application/json" }).end(
      JSON.stringify({ choices: [{ message: { content: JSON.stringify(itinerary) }, finish_reason: "stop" }] }),
    );
  });
}).listen(port, "0.0.0.0", () => console.log(`mock LLM listening on ${port}`));

type MockMessage = { role: string; content: string | null };

function assistantReply(messages: MockMessage[]) {
  const last = messages[messages.length - 1];
  if (last.role === "tool") {
    const result = JSON.parse(String(last.content));
    const content = result.ok ? "Added a rooftop dinner to day 1." : `That did not work: ${result.error}`;
    return { choices: [{ message: { role: "assistant", content }, finish_reason: "stop" }] };
  }
  const toolCall = String(last.content).includes("a99")
    ? { name: "delete_activity", arguments: JSON.stringify({ activity_ref: "a99" }) }
    : {
        name: "add_activity",
        arguments: JSON.stringify({
          day_number: 1,
          name: "Mock Rooftop Dinner",
          category: "food",
          time_slot: "evening",
          start_time: "20:00",
          duration_minutes: 90,
          estimated_cost: 1500,
          cost_basis: "per_person",
        }),
      };
  return {
    choices: [
      {
        message: { role: "assistant", content: null, tool_calls: [{ id: "call_1", type: "function", function: toolCall }] },
        finish_reason: "tool_calls",
      },
    ],
  };
}
