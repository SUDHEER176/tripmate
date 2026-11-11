import * as React from "react";
import { Dot } from "lucide-react";
import { cn } from "@/lib/utils";

const OTPContext = React.createContext(null);

function useOTP() {
  const ctx = React.useContext(OTPContext);
  if (!ctx) throw new Error("InputOTPSlot must be used within InputOTP");
  return ctx;
}

const InputOTP = React.forwardRef(
  (
    {
      className,
      value: controlledValue,
      onChange,
      maxLength = 6,
      id,
      disabled,
      autoFocus = true,
      children,
      ...props
    },
    ref,
  ) => {
    const [internalValue, setInternalValue] = React.useState("");
    const isControlled = controlledValue !== undefined;
    const value = isControlled ? controlledValue : internalValue;
    const [focusedIndex, setFocusedIndex] = React.useState(0);
    const inputRef = React.useRef(null);

    const handleChange = (newVal) => {
      const sanitized = newVal.replace(/\D/g, "").slice(0, maxLength);
      if (!isControlled) {
        setInternalValue(sanitized);
      }
      onChange?.(sanitized);
      setFocusedIndex(Math.min(sanitized.length, maxLength - 1));
    };

    React.useEffect(() => {
      if (autoFocus && inputRef.current) {
        inputRef.current.focus();
      }
    }, [autoFocus]);

    return (
      <OTPContext.Provider
        value={{
          value,
          maxLength,
          focusedIndex,
          setFocusedIndex,
          handleChange,
          inputRef,
        }}
      >
        <div
          ref={ref}
          onClick={() => inputRef.current?.focus()}
          className={cn(
            "relative flex items-center justify-center cursor-text select-none",
            className,
          )}
          {...props}
        >
          {/* Hidden real input capturing all keyboard and clipboard events */}
          <input
            ref={inputRef}
            id={id}
            type="text"
            inputMode="numeric"
            pattern="\d*"
            maxLength={maxLength}
            value={value}
            disabled={disabled}
            onChange={(e) => handleChange(e.target.value)}
            onFocus={() =>
              setFocusedIndex(Math.min(value.length, maxLength - 1))
            }
            className="absolute inset-0 h-full w-full opacity-0 pointer-events-auto cursor-text z-10"
            autoComplete="one-time-code"
          />

          <div className="flex items-center">{children}</div>
        </div>
      </OTPContext.Provider>
    );
  },
);
InputOTP.displayName = "InputOTP";

const InputOTPGroup = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn(
      "flex items-center rounded-xl overflow-hidden border border-neutral-700 bg-[#27272a]/80 shadow-inner",
      className,
    )}
    {...props}
  />
));
InputOTPGroup.displayName = "InputOTPGroup";

const InputOTPSlot = React.forwardRef(({ index, className, ...props }, ref) => {
  const { value, focusedIndex } = useOTP();
  const char = value[index];
  const isFocused = focusedIndex === index;

  return (
    <div
      ref={ref}
      data-slot="input-otp-slot"
      className={cn(
        "relative flex h-12 w-11 items-center justify-center border-r border-neutral-700/80 last:border-r-0 text-xl font-bold text-white transition-all duration-150",
        isFocused && "ring-2 ring-white/60 bg-white/5 z-10",
        className,
      )}
      {...props}
    >
      {char}
      {isFocused && !char && (
        <span className="pointer-events-none absolute inset-0 flex items-center justify-center animate-pulse">
          <span className="h-5 w-0.5 bg-white" />
        </span>
      )}
    </div>
  );
});
InputOTPSlot.displayName = "InputOTPSlot";

const InputOTPSeparator = React.forwardRef(({ className, ...props }, ref) => (
  <div
    ref={ref}
    role="separator"
    className={cn("mx-2 text-neutral-500 font-bold", className)}
    {...props}
  >
    <Dot className="h-6 w-6 text-neutral-500" />
  </div>
));
InputOTPSeparator.displayName = "InputOTPSeparator";

export { InputOTP, InputOTPGroup, InputOTPSlot, InputOTPSeparator };
