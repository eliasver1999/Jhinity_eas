import * as SecureStore from "expo-secure-store";
import { createContext, useCallback, useContext, useEffect, useState } from "react";

const TOKEN_KEY = "eas_api_token";
const BASE_URL_KEY = "eas_base_url";
const DEFAULT_BASE_URL = "http://localhost:3000";

type AuthState = {
  ready: boolean;
  token: string | null;
  baseUrl: string;
  signIn: (token: string, baseUrl: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string>(DEFAULT_BASE_URL);

  useEffect(() => {
    (async () => {
      try {
        const [t, b] = await Promise.all([
          SecureStore.getItemAsync(TOKEN_KEY),
          SecureStore.getItemAsync(BASE_URL_KEY),
        ]);
        setToken(t);
        if (b) setBaseUrl(b);
      } finally {
        setReady(true);
      }
    })();
  }, []);

  const signIn = useCallback(async (newToken: string, newBaseUrl: string) => {
    await SecureStore.setItemAsync(TOKEN_KEY, newToken);
    await SecureStore.setItemAsync(BASE_URL_KEY, newBaseUrl);
    setToken(newToken);
    setBaseUrl(newBaseUrl);
  }, []);

  const signOut = useCallback(async () => {
    await SecureStore.deleteItemAsync(TOKEN_KEY);
    setToken(null);
  }, []);

  return (
    <AuthContext.Provider value={{ ready, token, baseUrl, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used inside AuthProvider");
  return ctx;
}
