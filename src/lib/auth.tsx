import { createContext, useContext, useState, type ReactNode } from "react";
import type { User } from "@supabase/supabase-js";
export type AuthState = { user: User | null; pronto: boolean; setUser: (u: User | null) => void; setPronto: (v: boolean) => void };
const AuthContext = createContext<AuthState>({ user: null, pronto: false, setUser: () => {}, setPronto: () => {} });
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null); const [pronto, setPronto] = useState(false);
  return <AuthContext.Provider value={{ user, pronto, setUser, setPronto }}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);