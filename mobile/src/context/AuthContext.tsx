import React, { createContext, useCallback, useContext, useEffect, useState } from "react";
import { getToken, setToken as persistToken } from "../api/client";
import { getMe, Profile } from "../api/profile";

interface AuthContextValue {
  loading: boolean;
  isAuthenticated: boolean;
  profile: Profile | null;
  signIn: (token: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);

  const refreshProfile = useCallback(async () => {
    try {
      const me = await getMe();
      setProfile(me);
      setIsAuthenticated(true);
    } catch {
      setProfile(null);
      setIsAuthenticated(false);
      await persistToken(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      const token = await getToken();
      if (token) {
        await refreshProfile();
      }
      setLoading(false);
    })();
  }, [refreshProfile]);

  const signIn = useCallback(
    async (token: string) => {
      await persistToken(token);
      await refreshProfile();
    },
    [refreshProfile]
  );

  const signOut = useCallback(async () => {
    await persistToken(null);
    setProfile(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ loading, isAuthenticated, profile, signIn, signOut, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
