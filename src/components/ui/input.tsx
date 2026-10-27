import type { InputHTMLAttributes, TextareaHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      className={cn(
        "h-11 w-full rounded-xl border border-neutral-200 bg-white px-3.5 text-sm shadow-xs outline-none transition placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5",
        className,
      )}
      {...props}
    />
  );
}

export function Textarea({ className, ...props }: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      className={cn(
        "min-h-24 w-full rounded-xl border border-neutral-200 bg-white px-3.5 py-2.5 text-sm shadow-xs outline-none transition placeholder:text-neutral-400 hover:border-neutral-300 focus:border-neutral-950 focus:ring-4 focus:ring-neutral-950/5",
        className,
      )}
      {...props}
    />
  );
}

export function Label({ className, ...props }: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <label className={cn("mb-1.5 block text-sm font-semibold text-neutral-800", className)} {...props} />;
}
