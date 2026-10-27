import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  fetchSession,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  signInWithOAuth as apiSignInWithOAuth,
  sendOtp as apiSendOtp,
  verifyOtp as apiVerifyOtp,
} from "@/lib/api";
import { supabase, isSupabaseConfigured } from "@/lib/supabase";
import type { UserSession } from "@/lib/types";

type AuthContextValue = {
  user: UserSession | null;
  loading: boolean;
  isConfigured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<{ needsConfirmation?: boolean }>;
  sendOtp: (email: string, fullName?: string) => Promise<void>;
  verifyOtp: (email: string, token: string, type?: "signup" | "email") => Promise<void>;
  signInWithOAuth: (provider: "google" | "github" | "apple") => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<UserSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    if (!supabase) return () => {
      active = false;
    };

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        return;
      }
      setUser({
        id: session.user.id,
        email: session.user.email ?? "",
        fullName: (session.user.user_metadata.full_name as string | undefined) ?? "Traveler",
      });
    });

    return () => {
      active = false;
      data.subscription.unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isConfigured: isSupabaseConfigured,
      signIn: async (email: string, password: string) => {
        await apiSignIn(email, password);
        setUser(await fetchSession());
      },
      signUp: async (email: string, password: string, fullName: string) => {
        const res = await apiSignUp(email, password, fullName);
        const currentSession = await fetchSession();
        setUser(currentSession);
        return {
          needsConfirmation: Boolean(isSupabaseConfigured && !currentSession && res && "user" in res),
        };
      },
      sendOtp: async (email: string, fullName?: string) => {
        await apiSendOtp(email, fullName);
      },
      verifyOtp: async (email: string, token: string, type: "signup" | "email" = "signup") => {
        await apiVerifyOtp(email, token, type);
        const currentSession = await fetchSession();
        setUser(currentSession);
      },
      signInWithOAuth: async (provider: "google" | "github" | "apple") => {
        await apiSignInWithOAuth(provider);
        const currentSession = await fetchSession();
        if (currentSession) setUser(currentSession);
      },
      signOut: async () => {
        await apiSignOut();
        setUser(null);
      },
    }),
    [user, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
