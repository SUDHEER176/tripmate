import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount, currency = "INR") {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function dayCount(startDate, endDate) {
  const start = new Date(startDate);
  const end = new Date(endDate);
  const diff = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  return Math.max(1, diff);
}

export function addDays(date, days) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next.toISOString().slice(0, 10);
}

export function slugify(value) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function parseDate(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
}

export function formatDate(
  value,
  options = { day: "numeric", month: "short" },
) {
  if (!value) return "";
  return parseDate(value).toLocaleDateString("en-IN", options);
}

export function formatDateRange(startDate, endDate) {
  const start = parseDate(startDate);
  const end = parseDate(endDate);
  const sameYear = start.getFullYear() === end.getFullYear();
  const startLabel = start.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
  const endLabel = end.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  return startDate === endDate ? endLabel : `${startLabel} – ${endLabel}`;
}
