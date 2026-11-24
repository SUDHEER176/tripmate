import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  fetchSession,
  onSessionChange,
  signIn as apiSignIn,
  signOut as apiSignOut,
  signUp as apiSignUp,
  signInWithOAuth as apiSignInWithOAuth,
  sendOtp as apiSendOtp,
  verifyOtp as apiVerifyOtp,
} from "@/lib/api";
import { isBackendConfigured } from "@/lib/firebase";

const AuthContext = createContext(undefined);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchSession()
      .then((session) => {
        if (active) setUser(session);
      })
      .catch(() => {
        if (active) setUser(null);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    // Keeps the user in sync with Firebase (sign-in in another tab, token expiry).
    const unsubscribe = onSessionChange((session) => {
      if (active) setUser(session);
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, []);

  const value = useMemo(
    () => ({
      user,
      loading,
      isConfigured: isBackendConfigured,
      signIn: async (email, password) => {
        await apiSignIn(email, password);
        setUser(await fetchSession());
      },
      signUp: async (email, password, fullName) => {
        const res = await apiSignUp(email, password, fullName);
        const currentSession = await fetchSession();
        setUser(currentSession);
        return {
          needsConfirmation: Boolean(
            isBackendConfigured && !currentSession && res && "user" in res,
          ),
        };
      },
      sendOtp: async (email, fullName, mode) => {
        await apiSendOtp(email, fullName, mode);
      },
      verifyOtp: async (email, token, type = "signup", fullName) => {
        await apiVerifyOtp(email, token, type, fullName);
        const currentSession = await fetchSession();
        setUser(currentSession);
      },
      signInWithOAuth: async (provider) => {
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
