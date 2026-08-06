import React, { createContext, useContext, useState } from "react";
import { apiFetch, getToken, setToken } from "./api";

interface AdminInfo {
  id: string;
  email: string;
  role: string;
}

interface AuthContextValue {
  isAuthenticated: boolean;
  admin: AdminInfo | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [admin, setAdmin] = useState<AdminInfo | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(Boolean(getToken()));

  const login = async (email: string, password: string) => {
    const result = await apiFetch<{ token: string; admin: AdminInfo }>("/api/admin/login", {
      method: "POST",
      body: { email, password },
    });
    setToken(result.token);
    setAdmin(result.admin);
    setIsAuthenticated(true);
  };

  const logout = () => {
    setToken(null);
    setAdmin(null);
    setIsAuthenticated(false);
  };

  return <AuthContext.Provider value={{ isAuthenticated, admin, login, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
