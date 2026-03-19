import React, { createContext, useContext, useEffect, useState, ReactNode } from "react";

const API_BASE = import.meta.env.BASE_URL.replace(/\/$/, "") + "/api";

export interface AuthUser {
  id: number;
  pharmacyId: number;
  username: string;
  fullName: string;
  role: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
}

export interface AuthPharmacy {
  id: number;
  name: string;
  address?: string;
  phone?: string;
  ownerName?: string;
  licenseNumber?: string;
  email?: string;
  city?: string;
  isActive: boolean;
  createdAt: string;
}

interface AuthContextType {
  user: AuthUser | null;
  pharmacy: AuthPharmacy | null;
  isLoading: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [pharmacy, setPharmacy] = useState<AuthPharmacy | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refresh = async () => {
    try {
      const res = await fetch(`${API_BASE}/auth/me`, { credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        setUser(data.user);
        setPharmacy(data.pharmacy);
      } else {
        setUser(null);
        setPharmacy(null);
      }
    } catch {
      setUser(null);
      setPharmacy(null);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => { refresh(); }, []);

  const login = async (username: string, password: string) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ username, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || "Login failed");
    }
    const data = await res.json();
    setUser(data.user);
    setPharmacy(data.pharmacy);
  };

  const logout = async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: "POST", credentials: "include" });
    setUser(null);
    setPharmacy(null);
  };

  return (
    <AuthContext.Provider value={{ user, pharmacy, isLoading, login, logout, refresh }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
