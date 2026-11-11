import { useEffect, useRef, useState } from "react";
import {
  AlertCircle,
  ArrowUp,
  Check,
  Loader2,
  RotateCcw,
  Sparkles,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { askTripAssistant, assistantAvailable } from "@/lib/api";

import { cn } from "@/lib/utils";

const MAX_HISTORY = 20;
const MAX_CHARS = 2000;

function suggestionsFor(trip) {
  const lastDay = trip.itinerary_days.length;
  return [
    "Make day 1 more relaxed",
    `Add a great local dinner spot on day ${Math.min(2, lastDay)}`,
    trip.budget_summary.is_over_budget
      ? "Cut costs so the trip fits my budget"
      : "Swap one stop for something outdoors",
    "Reorder each day to reduce travel time",
  ];
}

/** Floating chat panel that lets the AI edit this trip. Changes are saved on the server. */
export function TripAssistant({ trip, onTripChange }) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState(null);
  const listRef = useRef(null);
  const inputRef = useRef(null);

  useEffect(() => {
    listRef.current?.scrollTo({
      top: listRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  async function send(text) {
    const content = text.trim();
    if (!content || sending) return;
    const next = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setError(null);
    setSending(true);
    try {
      const history = next
        .slice(-MAX_HISTORY)
        .map(({ role, content }) => ({ role, content }));
      const result = await askTripAssistant(trip.id, history);
      setMessages([
        ...next,
        { role: "assistant", content: result.reply, actions: result.actions },
      ]);
      if (result.actions.some((action) => action.ok)) onTripChange(result.trip);
    } catch (err) {
      // Drop the unanswered message so the history stays user/assistant pairs; keep the text for retry.
      setMessages(messages);
      setDraft(content);
      setError(
        err instanceof Error
          ? err.message
          : "The assistant could not respond. Please try again.",
      );
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="no-print">
      {!open && (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-40 inline-flex h-12 cursor-pointer items-center gap-2 rounded-full bg-neutral-950 px-5 text-sm font-semibold text-white shadow-lg transition hover:bg-neutral-800 active:scale-[0.98]"
        >
          <Sparkles className="h-4 w-4" />
          Ask AI to edit
        </button>
      )}

      {open && (
        <section
          role="dialog"
          aria-label="AI trip assistant"
          className="animate-fade-up fixed inset-x-0 bottom-0 z-50 flex h-[85dvh] flex-col rounded-t-2xl border border-neutral-200 bg-white shadow-2xl sm:inset-x-auto sm:bottom-5 sm:right-5 sm:h-[min(640px,calc(100dvh-2.5rem))] sm:w-[400px] sm:rounded-2xl"
        >
          <header className="flex items-center justify-between border-b border-neutral-100 px-4 py-3">
            <div className="flex items-center gap-2.5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-neutral-950 text-white">
                <Sparkles className="h-4 w-4" />
              </span>
              <div>
                <h2 className="text-sm font-semibold text-neutral-950">
                  Trip assistant
                </h2>
                <p className="text-[11px] text-neutral-500">
                  Edits your itinerary and budget directly
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {messages.length > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    setMessages([]);
                    setError(null);
                  }}
                  aria-label="Start a new conversation"
                  title="New conversation"
                  className="cursor-pointer rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Close assistant"
                className="cursor-pointer rounded-full p-2 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </header>

          <div
            ref={listRef}
            className="flex-1 space-y-4 overflow-y-auto px-4 py-4"
            aria-live="polite"
          >
            {messages.length === 0 && (
              <div className="space-y-4">
                <p className="text-sm leading-relaxed text-neutral-600">
                  Tell me what to change in your {trip.destination} trip: swap
                  stops, shift days, adjust costs. I save the changes for you.
                </p>
                {assistantAvailable ? (
                  <div className="flex flex-wrap gap-2">
                    {suggestionsFor(trip).map((suggestion) => (
                      <button
                        key={suggestion}
                        type="button"
                        onClick={() => send(suggestion)}
                        className="cursor-pointer rounded-full border border-neutral-200 px-3 py-1.5 text-left text-xs text-neutral-700 transition hover:border-neutral-950 hover:text-neutral-950"
                      >
                        {suggestion}
                      </button>
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-neutral-100 p-3 text-xs text-neutral-600">
                    The assistant runs on the server, so it is not available in
                    local demo mode. Connect Supabase to use it.
                  </p>
                )}
              </div>
            )}

            {messages.map((message, index) =>
              message.role === "user" ? (
                <div key={index} className="flex justify-end">
                  <p className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-neutral-950 px-3.5 py-2 text-sm text-white">
                    {message.content}
                  </p>
                </div>
              ) : (
                <div key={index} className="max-w-[92%] space-y-2">
                  {message.actions && message.actions.length > 0 && (
                    <ul className="space-y-1 rounded-xl border border-neutral-100 bg-neutral-50 p-2.5">
                      {message.actions.map((action, i) => (
                        <li
                          key={i}
                          className={cn(
                            "flex items-start gap-1.5 text-xs",
                            action.ok
                              ? "text-neutral-700"
                              : "text-neutral-400 line-through",
                          )}
                        >
                          {action.ok ? (
                            <Check className="mt-0.5 h-3 w-3 shrink-0 text-success" />
                          ) : (
                            <X className="mt-0.5 h-3 w-3 shrink-0" />
                          )}
                          {action.label}
                        </li>
                      ))}
                    </ul>
                  )}
                  <p className="whitespace-pre-wrap text-sm leading-relaxed text-neutral-800">
                    {message.content}
                  </p>
                </div>
              ),
            )}

            {sending && (
              <div className="flex items-center gap-2 text-xs text-neutral-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Working on your trip…
              </div>
            )}
          </div>

          {error && (
            <div
              role="alert"
              className="mx-4 mb-2 flex items-start gap-2 rounded-xl bg-terracotta/5 p-3 text-xs text-terracotta"
            >
              <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form
            className="flex items-end gap-2 border-t border-neutral-100 p-3"
            onSubmit={(e) => {
              e.preventDefault();
              send(draft);
            }}
          >
            <textarea
              ref={inputRef}
              rows={1}
              value={draft}
              maxLength={MAX_CHARS}
              disabled={!assistantAvailable}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  send(draft);
                }
              }}
              placeholder={
                assistantAvailable
                  ? "e.g. Move the temple visit to day 2"
                  : "Unavailable in demo mode"
              }
              aria-label="Message the trip assistant"
              className="max-h-32 min-h-11 flex-1 resize-none rounded-xl border border-neutral-200 px-3 py-2.5 text-sm outline-none transition hover:border-neutral-300 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5 disabled:bg-neutral-50"
            />
            <Button
              type="submit"
              size="icon"
              disabled={!draft.trim() || sending || !assistantAvailable}
              aria-label="Send"
            >
              {sending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ArrowUp className="h-4 w-4" />
              )}
            </Button>
          </form>
        </section>
      )}
    </div>
  );
}
