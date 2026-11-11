import { cva } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 rounded-full text-sm font-semibold cursor-pointer transition-all active:scale-[0.98] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-950/30 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-neutral-950 text-white hover:bg-neutral-800 shadow-sm",
        gold: "bg-neutral-900 text-white hover:bg-neutral-700 shadow-sm",
        outline:
          "border border-neutral-300 bg-white text-neutral-900 hover:bg-neutral-100",
        ghost: "text-neutral-900 hover:bg-neutral-100",
        danger: "bg-red-600 text-white hover:bg-red-700",
      },
      size: {
        default: "h-11 px-5",
        xs: "h-7 px-2.5 text-[11px] gap-1",
        sm: "h-9 px-3 text-xs",
        lg: "h-12 px-6",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: { variant: "default", size: "default" },
  },
);

export function Button({ className, variant, size, ...props }) {
  return (
    <button
      className={cn(buttonVariants({ variant, size }), className)}
      {...props}
    />
  );
}
