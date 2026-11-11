import React, { useState } from "react";
import { RefreshCwIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";

export function InputOTPForm({
  email = "m@example.com",
  value: controlledValue,
  onChange,
  onVerify,
  onResend,
  onChangeEmail,
  loading = false,
  error = null,
  resendCountdown = 0,
  className = "",
  onConfirmedViaLink,
} = {}) {
  const [internalValue, setInternalValue] = useState("");
  const isControlled = controlledValue !== undefined;
  const value = isControlled ? controlledValue : internalValue;

  const handleValueChange = (newVal) => {
    if (!isControlled) {
      setInternalValue(newVal);
    }
    onChange?.(newVal);
    if (newVal.length === 6) {
      onVerify?.(newVal);
    }
  };

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (value.length === 6) {
      onVerify?.(value);
    }
  };

  return (
    <Card
      className={`mx-auto max-w-md w-full bg-[#18181b]/95 border-neutral-800 text-white shadow-2xl ${className}`}
    >
      <CardHeader>
        <CardTitle>Verify your login</CardTitle>
        <CardDescription>
          Enter the verification code we sent to your email address:{" "}
          <span className="font-medium text-white">{email}</span>.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {error && (
          <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-xs text-rose-300">
            {error}
          </div>
        )}
        <Field>
          <div className="flex items-center justify-between mb-2">
            <FieldLabel htmlFor="otp-verification">
              Verification code
            </FieldLabel>
            <Button
              type="button"
              variant="outline"
              size="xs"
              onClick={onResend}
              disabled={resendCountdown > 0 || loading}
              className="border-neutral-700 bg-neutral-800/80 text-white hover:bg-neutral-700 hover:text-white"
            >
              <RefreshCwIcon
                className={`h-3 w-3 ${loading ? "animate-spin" : ""}`}
              />
              <span>
                {resendCountdown > 0
                  ? `Resend (${resendCountdown}s)`
                  : "Resend Code"}
              </span>
            </Button>
          </div>
          <InputOTP
            maxLength={6}
            id="otp-verification"
            value={value}
            onChange={handleValueChange}
            required
            autoFocus
          >
            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
            </InputOTPGroup>
            <InputOTPSeparator className="mx-2" />
            <InputOTPGroup className="*:data-[slot=input-otp-slot]:h-12 *:data-[slot=input-otp-slot]:w-11 *:data-[slot=input-otp-slot]:text-xl">
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
          <FieldDescription>
            <a
              href="#change-email"
              onClick={(e) => {
                e.preventDefault();
                onChangeEmail?.();
              }}
              className="text-neutral-400 hover:text-white transition-colors underline underline-offset-4 cursor-pointer text-xs"
            >
              I no longer have access to this email address.
            </a>
          </FieldDescription>
        </Field>
      </CardContent>
      <CardFooter>
        <Field>
          <Button
            type="submit"
            onClick={handleSubmit}
            disabled={loading || value.length < 6}
            className="w-full bg-white text-neutral-950 font-semibold hover:bg-neutral-200 h-10 transition-colors"
          >
            {loading ? "Verifying..." : "Verify"}
          </Button>

          {onConfirmedViaLink && (
            <button
              type="button"
              onClick={onConfirmedViaLink}
              disabled={loading}
              className="w-full mt-2 rounded-lg border border-neutral-800 bg-[#27272a]/60 hover:bg-[#27272a] text-white text-xs font-medium py-2 px-3 flex items-center justify-center gap-2 transition-colors cursor-pointer"
            >
              <span>I clicked the link in my email</span>
            </button>
          )}

          <div className="text-sm text-neutral-400 text-center mt-2">
            Having trouble signing in?{" "}
            <a
              href="mailto:support@tripmate.ai"
              className="underline underline-offset-4 transition-colors hover:text-white"
            >
              Contact support
            </a>
          </div>
        </Field>
      </CardFooter>
    </Card>
  );
}

export default InputOTPForm;
