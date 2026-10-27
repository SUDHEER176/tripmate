import { useState } from "react";
import { Check, Edit2, Link2, Loader2, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input, Label } from "@/components/ui/input";
import {
  COST_BASES,
  COST_BASIS_LABELS,
  EXPENSE_CATEGORIES,
  EXPENSE_CATEGORY_LABELS,
  expenseLineTotal,
  type CostBasis,
  type ExpenseCategory,
} from "@/lib/budget";
import type { Expense, ExpenseInput } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

const selectClass =
  "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3 text-sm outline-none transition hover:border-neutral-300 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5";

type Draft = { category: ExpenseCategory; title: string; amount: string; cost_basis: CostBasis; quantity: string };

const emptyDraft: Draft = { category: "miscellaneous", title: "", amount: "", cost_basis: "total", quantity: "" };

function toInput(draft: Draft): ExpenseInput {
  const input: ExpenseInput = {
    category: draft.category,
    title: draft.title.trim(),
    amount: Number(draft.amount),
    cost_basis: draft.cost_basis,
  };
  if (draft.quantity.trim()) input.quantity = Number(draft.quantity);
  return input;
}

function ExpenseForm({
  initial,
  submitLabel,
  onSubmit,
  onCancel,
}: {
  initial: Draft;
  submitLabel: string;
  onSubmit: (input: ExpenseInput) => Promise<void>;
  onCancel?: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(initial);
  const [saving, setSaving] = useState(false);
  const needsQuantity = draft.cost_basis !== "per_person";

  return (
    <form
      className="grid gap-3 sm:grid-cols-6"
      onSubmit={async (event) => {
        event.preventDefault();
        setSaving(true);
        try {
          await onSubmit(toInput(draft));
        } catch {
          // The page shows the error; keep the form open so nothing typed is lost.
        } finally {
          setSaving(false);
        }
      }}
    >
      <div className="sm:col-span-3">
        <Label htmlFor="exp-title">Expense</Label>
        <Input
          id="exp-title"
          required
          maxLength={200}
          placeholder="e.g. Travel insurance"
          value={draft.title}
          onChange={(e) => setDraft({ ...draft, title: e.target.value })}
        />
      </div>
      <div className="sm:col-span-3">
        <Label htmlFor="exp-category">Category</Label>
        <select
          id="exp-category"
          className={selectClass}
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value as ExpenseCategory })}
        >
          {EXPENSE_CATEGORIES.map((category) => (
            <option key={category} value={category}>
              {EXPENSE_CATEGORY_LABELS[category]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="exp-amount">Amount (₹)</Label>
        <Input
          id="exp-amount"
          type="number"
          required
          min={0}
          step="0.01"
          value={draft.amount}
          onChange={(e) => setDraft({ ...draft, amount: e.target.value })}
        />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="exp-basis">Charged</Label>
        <select
          id="exp-basis"
          className={selectClass}
          value={draft.cost_basis}
          onChange={(e) => setDraft({ ...draft, cost_basis: e.target.value as CostBasis })}
        >
          {COST_BASES.map((basis) => (
            <option key={basis} value={basis}>
              {COST_BASIS_LABELS[basis]}
            </option>
          ))}
        </select>
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor="exp-qty">
          {draft.cost_basis.includes("night") ? "Nights" : draft.cost_basis.includes("day") ? "Days" : "Quantity"}
        </Label>
        <Input
          id="exp-qty"
          type="number"
          min={0.01}
          step="0.01"
          placeholder={needsQuantity ? "Auto" : "1"}
          value={draft.quantity}
          onChange={(e) => setDraft({ ...draft, quantity: e.target.value })}
        />
      </div>
      <div className="flex justify-end gap-2 sm:col-span-6">
        {onCancel && (
          <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" size="sm" disabled={saving}>
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          {submitLabel}
        </Button>
      </div>
    </form>
  );
}

type Props = {
  expenses: Expense[];
  travelers: number;
  onAdd: (input: ExpenseInput) => Promise<void>;
  onUpdate: (expenseId: string, input: ExpenseInput) => Promise<void>;
  onDelete: (expenseId: string) => Promise<void>;
};

export function ExpensesCard({ expenses, travelers, onAdd, onUpdate, onDelete }: Props) {
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  const grouped = EXPENSE_CATEGORIES.map((category) => ({
    category,
    items: expenses.filter((expense) => expense.category === category),
  })).filter((group) => group.items.length > 0);

  return (
    <Card className="p-6 sm:p-8">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
        <div>
          <h3 className="text-base font-semibold text-neutral-950">Expenses</h3>
          <p className="mt-0.5 text-xs text-neutral-500">
            Every cost counted in the budget. Costs linked to an itinerary stop are edited on the stop itself.
          </p>
        </div>
        {!adding && (
          <Button size="sm" variant="outline" className="no-print shrink-0" onClick={() => setAdding(true)}>
            <Plus className="h-3.5 w-3.5" />
            Add expense
          </Button>
        )}
      </div>

      {adding && (
        <div className="no-print mt-5 rounded-2xl border border-neutral-200 bg-neutral-50 p-4">
          <ExpenseForm
            initial={emptyDraft}
            submitLabel="Add expense"
            onCancel={() => setAdding(false)}
            onSubmit={async (input) => {
              await onAdd(input);
              setAdding(false);
            }}
          />
        </div>
      )}

      {grouped.length === 0 ? (
        <p className="mt-6 text-sm text-neutral-500">No expenses yet.</p>
      ) : (
        <div className="mt-6 space-y-6">
          {grouped.map((group) => (
            <section key={group.category}>
              <h4 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-400">
                {EXPENSE_CATEGORY_LABELS[group.category]}
              </h4>
              <ul className="mt-2 divide-y divide-neutral-100">
                {group.items.map((expense) => {
                  const linked = expense.source === "activity";
                  if (editingId === expense.id) {
                    return (
                      <li key={expense.id} className="py-3">
                        <ExpenseForm
                          initial={{
                            category: expense.category,
                            title: expense.title,
                            amount: String(expense.amount),
                            cost_basis: expense.cost_basis,
                            quantity: String(expense.quantity),
                          }}
                          submitLabel="Save"
                          onCancel={() => setEditingId(null)}
                          onSubmit={async (input) => {
                            await onUpdate(expense.id, input);
                            setEditingId(null);
                          }}
                        />
                      </li>
                    );
                  }
                  const showQuantity = expense.quantity !== 1 && expense.cost_basis !== "per_person";
                  return (
                    <li key={expense.id} className="group flex items-center justify-between gap-3 py-2.5">
                      <div className="min-w-0">
                        <p className="flex items-center gap-2 truncate text-sm font-medium text-neutral-950">
                          {linked && <Link2 className="h-3.5 w-3.5 shrink-0 text-neutral-400" aria-label="From itinerary" />}
                          <span className="truncate">{expense.title}</span>
                          {expense.is_estimate && (
                            <span className="shrink-0 rounded-full bg-neutral-100 px-1.5 py-0.5 text-[10px] font-semibold uppercase text-neutral-500">
                              est.
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-neutral-500">
                          {formatCurrency(expense.amount)} {COST_BASIS_LABELS[expense.cost_basis]}
                          {showQuantity && ` × ${expense.quantity}`}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <span className="text-sm font-semibold tabular-nums text-neutral-950">
                          {formatCurrency(expenseLineTotal(expense, travelers))}
                        </span>
                        {!linked && (
                          <span className="no-print flex items-center opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-within:opacity-100">
                            <button
                              type="button"
                              onClick={() => setEditingId(expense.id)}
                              aria-label={`Edit ${expense.title}`}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-neutral-950"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDelete(expense.id)}
                              aria-label={`Delete ${expense.title}`}
                              className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 hover:text-terracotta"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </span>
                        )}
                        {linked && <span className="w-16" aria-hidden />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>
          ))}
        </div>
      )}
    </Card>
  );
}
