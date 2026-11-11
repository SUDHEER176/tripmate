import React, { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion } from "framer-motion";
import { Sparkles, ArrowLeft, Mail, Check, Loader2 } from "lucide-react";
import { InputOTPForm } from "./InputOTPForm";
import { useAuth } from "@/context/AuthContext";
import { fetchSession } from "@/lib/api";
import { TripMateLogo } from "@/components/brand/TripMateLogo";
import blueAmbientBg from "@/assets/images/auth-ambient-bg.jpg";

export function Auth3Block({ mode = "signin" }) {
  const {
    user,
    signIn,
    signUp,
    sendOtp,
    verifyOtp,
    signInWithOAuth,
    isConfigured,
  } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from || "/my-trips";

  // If user is already authenticated (or clicked email confirmation link), redirect immediately
  useEffect(() => {
    if (user) {
      navigate(from, { replace: true });
    }
  }, [user, navigate, from]);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [step, setStep] = useState("email");
  const [otpMode, setOtpMode] = useState(
    mode === "signup" ? "signup" : "email",
  );
  const [otpValue, setOtpValue] = useState("");
  const [resendCountdown, setResendCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [infoMessage, setInfoMessage] = useState(null);

  const isSignIn = mode === "signin";

  // Countdown timer for resend OTP
  useEffect(() => {
    if (resendCountdown <= 0) return;
    const timer = setInterval(() => {
      setResendCountdown((prev) => prev - 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCountdown]);

  const handleContinue = (e) => {
    e.preventDefault();
    setError(null);
    setInfoMessage(null);

    if (!email.trim() || !email.includes("@")) {
      setError("Please enter a valid email address.");
      return;
    }

    if (step === "email" && isSignIn) {
      setStep("password");
      return;
    }

    handleSubmit();
  };

  const handleSubmit = async () => {
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      if (isSignIn) {
        await signIn(email, password || "password123");
        navigate(from, { replace: true });
      } else {
        await signUp(email, password || "password123", fullName || "Traveler");
        // Seamlessly switch to OTP verification screen
        setOtpMode("signup");
        setStep("otp");
        setResendCountdown(60);
        setInfoMessage(`We've sent a verification code to ${email}.`);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Sign In with OTP instead of password
  const handleRequestSignInOtp = async () => {
    if (!email.trim() || !email.includes("@")) {
      setError("Please enter your email address first.");
      return;
    }
    setLoading(true);
    setError(null);
    setInfoMessage(null);
    try {
      await sendOtp(email);
      setOtpMode("email");
      setStep("otp");
      setResendCountdown(60);
      setInfoMessage(`We've sent a 6-digit sign-in code to ${email}.`);
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to send verification code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Verify OTP submission
  const handleVerifyOtp = async (codeOverride) => {
    const code = (codeOverride || otpValue).trim();
    if (code.length < 6) {
      setError("Please enter the 6-digit verification code.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      await verifyOtp(email, code, otpMode);
      navigate(from, { replace: true });
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Invalid or expired verification code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  // Resend code handler
  const handleResendOtp = async () => {
    if (resendCountdown > 0) return;
    setLoading(true);
    setError(null);
    try {
      if (otpMode === "signup") {
        await signUp(email, password || "password123", fullName || "Traveler");
      } else {
        await sendOtp(email);
      }
      setResendCountdown(60);
      setInfoMessage(
        "A fresh 6-digit verification code has been sent to your email.",
      );
      setOtpValue("");
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : "Failed to resend verification code.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOAuth = async (provider) => {
    setError(null);
    setInfoMessage(null);
    setLoading(true);
    try {
      await signInWithOAuth(provider);
      if (!isConfigured) {
        navigate(from, { replace: true });
      }
    } catch (err) {
      const msg =
        err instanceof Error
          ? err.message
          : `Could not sign in with ${provider}.`;
      setError(msg);
      setLoading(false);
    }
  };

  return (
    <div className="relative h-screen max-h-screen w-full overflow-hidden bg-neutral-950 font-sans flex flex-col justify-between p-3 sm:p-5 select-none">
      {/* 1. Deep Atmospheric Blue Silk Background */}
      <div className="absolute inset-0 z-0 overflow-hidden">
        <img
          src={blueAmbientBg}
          alt="Atmospheric Blue Background"
          className="h-full w-full object-cover object-center scale-100"
        />
        <div className="absolute inset-0 bg-neutral-950/45 backdrop-blur-[1px]" />
      </div>

      {/* Top Floating Logo & Back Link - Compact Header */}
      <header className="relative z-20 flex items-center justify-between px-3 sm:px-8 py-2">
        <div className="flex items-center gap-3">
          <TripMateLogo variant="white" className="h-6 sm:h-7" />
        </div>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 text-xs font-medium text-white/75 hover:text-white transition-colors bg-white/10 hover:bg-white/15 px-3 py-1 rounded-full backdrop-blur-md border border-white/10"
        >
          <ArrowLeft className="h-3 w-3" />
          <span>Back to Home</span>
        </Link>
      </header>

      {/* 2. Main Two-Column Centered Layout */}
      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col lg:flex-row items-center justify-center gap-6 lg:gap-14 my-auto px-2">
        {step === "otp" ? (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-md"
          >
            <InputOTPForm
              email={email}
              value={otpValue}
              onChange={(val) => {
                setOtpValue(val);
                if (val.length === 6) handleVerifyOtp(val);
              }}
              onVerify={handleVerifyOtp}
              onResend={handleResendOtp}
              onChangeEmail={() => {
                setStep(isSignIn ? "email" : "password");
                setError(null);
                setInfoMessage(null);
              }}
              loading={loading}
              error={error}
              resendCountdown={resendCountdown}
              onConfirmedViaLink={async () => {
                setLoading(true);
                setError(null);
                try {
                  const session = await fetchSession();
                  if (session) {
                    navigate(from, { replace: true });
                  } else {
                    setError(
                      "Email not confirmed yet. Please click 'Confirm email address' in your email, or enter the 6-digit code.",
                    );
                  }
                } finally {
                  setLoading(false);
                }
              }}
            />
          </motion.div>
        ) : (
          <motion.div
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
            className="w-full max-w-[400px] rounded-[22px] bg-[#18181b]/95 backdrop-blur-2xl border border-neutral-800/90 p-5 sm:p-6 shadow-[0_20px_50px_rgba(0,0,0,0.6)]"
          >
            {/* Card Title & Header */}
            <div className="text-left mb-3.5">
              <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-white leading-tight">
                {isSignIn ? "Sign in" : "Create account"}
              </h2>
              <p className="mt-1 text-xs text-neutral-400">
                {isSignIn ? (
                  <>
                    New user?{" "}
                    <Link
                      to="/signup"
                      onClick={() => {
                        setStep("email");
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="text-white font-semibold hover:underline transition-all"
                    >
                      Create an account
                    </Link>
                  </>
                ) : (
                  <>
                    Already have an account?{" "}
                    <Link
                      to="/login"
                      onClick={() => {
                        setStep("email");
                        setError(null);
                        setInfoMessage(null);
                      }}
                      className="text-white font-semibold hover:underline transition-all"
                    >
                      Sign in
                    </Link>
                  </>
                )}
              </p>
            </div>

            {/* Error Alert */}
            {error && (
              <div className="mb-3 rounded-lg border border-rose-500/30 bg-rose-500/10 p-2.5 text-[11px] text-rose-300">
                {error}
              </div>
            )}

            {/* Info Alert */}
            {infoMessage && (
              <div className="mb-3 rounded-lg border border-emerald-500/30 bg-emerald-500/10 p-2.5 text-[11px] text-emerald-300 flex items-center gap-2">
                <Mail className="h-3.5 w-3.5 shrink-0" />
                <span>{infoMessage}</span>
              </div>
            )}

            {/* STEP = EMAIL & PASSWORD FORM */}
            <form onSubmit={handleContinue} className="space-y-2.5">
              {!isSignIn && (
                <div>
                  <input
                    type="text"
                    placeholder="Full name"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-[#27272a]/70 px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
                    required
                  />
                </div>
              )}

              <div>
                <input
                  type="email"
                  placeholder="Email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-neutral-800 bg-[#27272a]/70 px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
                  required
                />
              </div>

              {/* Password input shown if on signup or if step is password */}
              {(!isSignIn || step === "password") && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  transition={{ duration: 0.2 }}
                >
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-neutral-800 bg-[#27272a]/70 px-3.5 py-2 text-xs sm:text-sm text-white placeholder:text-neutral-500 focus:outline-none focus:border-neutral-500 transition-colors"
                    required
                  />
                </motion.div>
              )}

              {/* Continue / Sign In / Create Account Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-white text-neutral-950 font-semibold py-2.5 text-xs sm:text-sm hover:bg-neutral-200 active:scale-[0.99] transition-all shadow-md flex items-center justify-center gap-1.5 cursor-pointer disabled:opacity-60"
              >
                {loading ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-neutral-950" />
                    <span>Processing...</span>
                  </>
                ) : isSignIn && step === "email" ? (
                  "Continue"
                ) : isSignIn ? (
                  "Sign in"
                ) : (
                  "Create account (with OTP)"
                )}
              </button>

              {/* Sign In with OTP Option */}
              {isSignIn && (
                <div className="text-center pt-1">
                  <button
                    type="button"
                    onClick={handleRequestSignInOtp}
                    disabled={loading}
                    className="text-[11px] text-neutral-400 hover:text-white transition-colors cursor-pointer underline underline-offset-2"
                  >
                    Or sign in with 6-digit OTP code
                  </button>
                </div>
              )}
            </form>

            {/* Horizontal Divider with "Or" */}
            <div className="relative flex items-center justify-center my-3">
              <div className="border-t border-neutral-800 w-full" />
              <span className="absolute bg-[#18181b] px-2.5 text-[10px] font-medium text-neutral-500 uppercase tracking-widest">
                Or
              </span>
            </div>

            {/* Social Sign-in Buttons */}
            <div className="space-y-2">
              {/* Google */}
              <button
                type="button"
                onClick={() => handleOAuth("google")}
                disabled={loading}
                className="w-full rounded-lg border border-neutral-800 bg-[#27272a]/60 hover:bg-[#27272a] text-white text-xs font-medium py-2 px-3 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg className="h-3.5 w-3.5 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
                <span>Sign in with Google</span>
              </button>

              {/* Apple */}
              <button
                type="button"
                onClick={() => handleOAuth("apple")}
                disabled={loading}
                className="w-full rounded-lg border border-neutral-800 bg-[#27272a]/60 hover:bg-[#27272a] text-white text-xs font-medium py-2 px-3 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg
                  className="h-3.5 w-3.5 fill-current shrink-0"
                  viewBox="0 0 24 24"
                >
                  <path d="M18.71 19.5c-.83 1.24-1.71 2.45-3.05 2.47-1.34.03-1.77-.79-3.29-.79-1.53 0-2 .77-3.27.82-1.31.05-2.3-1.32-3.14-2.53C4.25 17 2.94 12.45 4.7 9.39c.87-1.52 2.43-2.48 4.12-2.51 1.28-.02 2.5.87 3.29.87.78 0 2.26-1.07 3.81-.91.65.03 2.47.26 3.64 1.98-.09.06-2.17 1.28-2.15 3.81.03 3.02 2.65 4.03 2.68 4.04-.03.07-.42 1.44-1.38 2.83M15.97 6.89c.66-.82 1.11-1.96.99-3.1-.96.04-2.13.65-2.81 1.45-.6.69-1.13 1.83-.99 2.95 1.07.08 2.15-.48 2.81-1.3" />
                </svg>
                <span>Sign in with Apple</span>
              </button>

              {/* GitHub */}
              <button
                type="button"
                onClick={() => handleOAuth("github")}
                disabled={loading}
                className="w-full rounded-lg border border-neutral-800 bg-[#27272a]/60 hover:bg-[#27272a] text-white text-xs font-medium py-2 px-3 flex items-center justify-center gap-2.5 transition-colors cursor-pointer"
              >
                <svg
                  className="h-3.5 w-3.5 fill-current shrink-0"
                  viewBox="0 0 24 24"
                >
                  <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.1-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33.85 0 1.71.11 2.5.33 1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2" />
                </svg>
                <span>Sign in with GitHub</span>
              </button>
            </div>

            {/* Footer help link */}
            <div className="mt-3 text-center text-[11px] text-neutral-500">
              Can&apos;t sign in?{" "}
              <a
                href="mailto:support@tripmate.ai"
                className="text-white hover:underline font-medium"
              >
                Get help
              </a>
            </div>
          </motion.div>
        )}

        {/* Right Side: Compact Typography */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, delay: 0.1 }}
          className="text-center lg:text-left max-w-sm"
        >
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/10 backdrop-blur-md border border-white/15 px-3 py-0.5 text-[11px] font-medium text-white/90 mb-3 shadow-sm">
            <Sparkles className="h-3 w-3 text-amber-400" />
            <span>AI Travel Intelligence</span>
          </div>

          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-white leading-tight">
            TripMate
          </h1>
          <p className="mt-2 text-xs sm:text-sm text-neutral-300 leading-relaxed font-normal">
            Beautiful, production-ready travel itineraries tailored for your
            next unforgettable journey.
          </p>

          <div className="mt-4 flex flex-col sm:flex-row items-center gap-3 text-xs text-neutral-400">
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Instant AI planning</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5 text-emerald-400" />
              <span>Budget breakdowns</span>
            </div>
          </div>
        </motion.div>
      </div>

      {/* Subtle bottom copyright / indicator */}
      <footer className="relative z-20 text-center py-1">
        <span className="text-[10px] text-neutral-500">
          ©2024 TripMate AI. Secure 256-bit SSL encryption.
        </span>
      </footer>
    </div>
  );
}

export default Auth3Block;
