import { AlertTriangle, CheckCircle2, Info } from "lucide-react";
import { Card } from "@/components/ui/card";
import type { BudgetSummary, ExpenseCategory } from "@/lib/budget";
import { cn, formatCurrency } from "@/lib/utils";

const colors: Record<ExpenseCategory, string> = {
  accommodation: "bg-neutral-950",
  transport: "bg-neutral-700",
  food: "bg-neutral-500",
  activities: "bg-neutral-400",
  local_travel: "bg-neutral-300",
  miscellaneous: "bg-neutral-200",
};

export function BudgetBreakdownCard({ summary }: { summary: BudgetSummary }) {
  const over = summary.is_over_budget;
  const usedPct = summary.utilization_pct ?? 0;

  return (
    <Card className="flex h-full flex-col p-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-base font-semibold text-neutral-950">Budget planner</h3>
          <p className="mt-0.5 text-xs text-neutral-500">Calculated from your expenses, in INR</p>
        </div>
        <span
          className={cn(
            "rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums",
            over ? "bg-terracotta/10 text-terracotta" : "bg-success/10 text-success",
          )}
        >
          {Math.round(usedPct)}% used
        </span>
      </div>

      <p className="mt-5 font-display text-4xl tracking-tight text-neutral-950">
        {formatCurrency(summary.estimated_total)}
      </p>
      <p className="text-xs text-neutral-500">
        of {formatCurrency(summary.total_budget)} budget · {formatCurrency(summary.cost_per_traveler)} per traveler
      </p>

      {/* Stacked breakdown bar */}
      <div className="mt-5 flex h-3 gap-0.5 overflow-hidden rounded-full bg-neutral-100">
        {summary.categories.map((row) =>
          row.share_pct > 0 ? (
            <div
              key={row.category}
              className={cn("h-full transition-all duration-500", colors[row.category])}
              style={{ width: `${row.share_pct}%` }}
              title={`${row.label}: ${formatCurrency(row.total)}`}
            />
          ) : null,
        )}
      </div>

      <ul className="mt-5 space-y-2.5">
        {summary.categories.map((row) => (
          <li key={row.category} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2.5 text-neutral-600">
              <span className={cn("h-2.5 w-2.5 rounded-full", colors[row.category])} />
              {row.label}
              <span className="text-xs text-neutral-400">{Math.round(row.share_pct)}%</span>
            </span>
            <span className="font-medium tabular-nums text-neutral-950">{formatCurrency(row.total)}</span>
          </li>
        ))}
      </ul>

      <div className="min-h-5 flex-1" />
      <div
        className={cn(
          "flex items-start gap-2 rounded-xl p-3 text-xs leading-relaxed",
          over ? "bg-terracotta/5 text-terracotta" : "bg-success/5 text-success",
        )}
      >
        {over ? (
          <>
            <AlertTriangle className="mt-px h-4 w-4 shrink-0" />
            {formatCurrency(-summary.remaining)} over your budget. Trim a stay or activity to fit.
          </>
        ) : (
          <>
            <CheckCircle2 className="mt-px h-4 w-4 shrink-0" />
            Within budget, with {formatCurrency(summary.remaining)} to spare.
          </>
        )}
      </div>
      {summary.includes_estimates && (
        <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-neutral-500">
          <Info className="mt-px h-3.5 w-3.5 shrink-0" />
          Includes AI estimates. Prices are unverified until you confirm them.
        </p>
      )}
    </Card>
  );
}
