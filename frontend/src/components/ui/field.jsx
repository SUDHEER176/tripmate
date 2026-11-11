import * as React from "react";
import { cn } from "@/lib/utils";

const Field = React.forwardRef(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("space-y-3 w-full", className)} {...props} />
));
Field.displayName = "Field";

const FieldLabel = React.forwardRef(({ className, ...props }, ref) => (
  <label
    ref={ref}
    className={cn("text-xs sm:text-sm font-medium text-neutral-300", className)}
    {...props}
  />
));
FieldLabel.displayName = "FieldLabel";

const FieldDescription = React.forwardRef(({ className, ...props }, ref) => (
  <p
    ref={ref}
    className={cn("text-xs text-neutral-400 mt-2", className)}
    {...props}
  />
));
FieldDescription.displayName = "FieldDescription";

export { Field, FieldLabel, FieldDescription };
