import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";
import { api, clearTokens, loadTokens, saveTokens, setLoggedOutHandler } from "@/src/api";

type User = { id: string; name: string; email: string };
type Ctx = {
  user: User | null | false; // null = loading, false = logged out
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<Ctx>(null as any);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null | false>(null);

  useEffect(() => {
    setLoggedOutHandler(() => setUser(false));
    (async () => {
      if (!(await loadTokens())) return setUser(false);
      try {
        setUser(await api<User>("/auth/me"));
      } catch {
        setUser(false);
      }
    })();
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const d = await api("/auth/login", { method: "POST", body: { email: email.trim(), password } });
    await saveTokens(d.access_token, d.refresh_token);
    setUser(d);
  }, []);

  const register = useCallback(async (name: string, email: string, password: string) => {
    const d = await api("/auth/register", { method: "POST", body: { name: name.trim(), email: email.trim(), password } });
    await saveTokens(d.access_token, d.refresh_token);
    setUser(d);
  }, []);

  const logout = useCallback(async () => {
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    await clearTokens();
    setUser(false);
  }, []);

  return <AuthContext.Provider value={{ user, login, register, logout }}>{children}</AuthContext.Provider>;
}

export const useAuth = () => useContext(AuthContext);
