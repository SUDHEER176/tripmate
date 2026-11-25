import { useEffect, useRef, useState } from "react";
import { Check, Loader2, Luggage, Plus, RotateCcw, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { assistantAvailable, generatePackingList, savePackingList } from "@/lib/api";
import { PACKING_CATEGORIES } from "@/lib/packing";
import { weatherHint } from "@/lib/weather";
import { cn } from "@/lib/utils";

const CATEGORY_LABELS = {
  documents: "Documents & money",
  clothing: "Clothing",
  toiletries: "Toiletries",
  health: "Health",
  electronics: "Electronics",
  gear: "Gear",
  other: "Other",
};

/**
 * Checklist of things to pack. Every change is saved straight away; if a save
 * fails the list goes back to what was last saved.
 */
export function PackingListCard({ tripId, items: savedItems, weather }) {
  const [items, setItems] = useState(savedItems ?? []);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [draft, setDraft] = useState("");
  const [draftCategory, setDraftCategory] = useState("other");
  const lastSaved = useRef(savedItems ?? []);

  useEffect(() => {
    setItems(savedItems ?? []);
    lastSaved.current = savedItems ?? [];
  }, [savedItems]);

  async function persist(next) {
    setItems(next);
    setError(null);
    try {
      const saved = await savePackingList(tripId, next);
      lastSaved.current = saved;
    } catch (err) {
      setItems(lastSaved.current);
      setError(err instanceof Error ? err.message : "Could not save the packing list.");
    }
  }

  async function generate() {
    if (
      items.length &&
      !window.confirm("Replace your packing list with a new one? Ticks and items you added will be lost.")
    )
      return;
    setGenerating(true);
    setError(null);
    try {
      const fresh = await generatePackingList(tripId, weatherHint(weather));
      lastSaved.current = fresh;
      setItems(fresh);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create a packing list.");
    } finally {
      setGenerating(false);
    }
  }

  function addItem(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    persist([...items, { id: crypto.randomUUID(), text, category: draftCategory, packed: false }]);
    setDraft("");
  }

  const packed = items.filter((i) => i.packed).length;
  const pct = items.length ? Math.round((packed / items.length) * 100) : 0;
  const groups = PACKING_CATEGORIES.map((category) => ({
    category,
    items: items.filter((i) => i.category === category),
  })).filter((g) => g.items.length);

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div>
          <h2 className="font-display text-2xl tracking-tight text-neutral-950">Packing list</h2>
          <p className="mt-1 text-sm text-neutral-500">
            {items.length
              ? `${packed} of ${items.length} packed`
              : assistantAvailable
                ? "Let AI write a checklist for this trip, its weather and activities."
                : "Create a checklist for this trip and its weather."}
          </p>
        </div>
        <div className="no-print flex shrink-0 gap-2">
          {items.some((i) => i.packed) && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => persist(items.map((i) => ({ ...i, packed: false })))}
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Untick all
            </Button>
          )}
          <Button size="sm" variant={items.length ? "outline" : "default"} onClick={generate} disabled={generating}>
            {generating ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" />
            )}
            {generating ? "Creating…" : items.length ? "Regenerate" : "Create packing list"}
          </Button>
        </div>
      </div>

      {items.length > 0 && (
        <div className="mt-5 h-2 overflow-hidden rounded-full bg-neutral-100" aria-hidden>
          <div
            className={cn("h-full transition-all duration-500", pct === 100 ? "bg-success" : "bg-neutral-950")}
            style={{ width: `${pct}%` }}
          />
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-terracotta">
          {error}
        </p>
      )}

      {items.length === 0 && !generating ? (
        <div className="mt-6 rounded-2xl border border-dashed border-neutral-300 p-8 text-center">
          <Luggage className="mx-auto h-6 w-6 text-neutral-400" />
          <p className="mt-2 text-sm text-neutral-500">No packing list yet.</p>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {groups.map((group) => (
            <section key={group.category}>
              <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
                {CATEGORY_LABELS[group.category]}
              </h3>
              <ul className="mt-2 space-y-1">
                {group.items.map((item) => (
                  <li key={item.id} className="group flex items-center gap-2">
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={item.packed}
                      onClick={() =>
                        persist(items.map((i) => (i.id === item.id ? { ...i, packed: !i.packed } : i)))
                      }
                      className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-lg px-1.5 py-1.5 text-left text-sm hover:bg-neutral-50"
                    >
                      <span
                        className={cn(
                          "flex h-5 w-5 shrink-0 items-center justify-center rounded-md border transition-colors",
                          item.packed ? "border-neutral-950 bg-neutral-950 text-white" : "border-neutral-300 bg-white",
                        )}
                      >
                        {item.packed && <Check className="h-3.5 w-3.5" />}
                      </span>
                      <span className={cn("min-w-0", item.packed && "text-neutral-400 line-through")}>
                        {item.text}
                      </span>
                    </button>
                    <button
                      type="button"
                      onClick={() => persist(items.filter((i) => i.id !== item.id))}
                      aria-label={`Remove ${item.text}`}
                      className="no-print flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-neutral-400 opacity-100 hover:bg-neutral-100 hover:text-terracotta sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <form onSubmit={addItem} className="no-print mt-6 flex flex-col gap-2 sm:flex-row">
        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          maxLength={120}
          placeholder="Add an item, e.g. Travel pillow"
          aria-label="New packing item"
          className="sm:flex-1"
        />
        <select
          value={draftCategory}
          onChange={(e) => setDraftCategory(e.target.value)}
          aria-label="Category"
          className="h-11 rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none hover:border-neutral-300 focus:border-neutral-950"
        >
          {PACKING_CATEGORIES.map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABELS[c]}
            </option>
          ))}
        </select>
        <Button type="submit" variant="outline" disabled={!draft.trim()}>
          <Plus className="h-4 w-4" />
          Add
        </Button>
      </form>
    </Card>
  );
}
