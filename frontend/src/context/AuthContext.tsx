import React, { useEffect, useState } from "react";
import { loginApi, logoutAllApi, logoutApi, refreshApi, registerApi } from "../api/auth";
import { changePasswordApi, updateMeApi } from "../api/users";
import { getAccessToken, setAccessToken } from "../api/client";
import type { User } from "../types/auth";
import { AuthContext, type AuthContextType } from "./authContextDef";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [authStatus, setAuthStatus] = useState<
    "initializing" | "authenticated" | "unauthenticated"
  >("initializing");

  const refreshSession = async (): Promise<boolean> => {
    try {
      const data = await refreshApi();
      setToken(data.access_token);
      setUser(data.user);
      setAuthStatus("authenticated");
      return true;
    } catch {
      setAccessToken(null);
      setToken(null);
      setUser(null);
      setAuthStatus("unauthenticated");
      return false;
    }
  };

  // Restore session on mount using the unified refreshSession code path.
  // This ensures that session restoration and 401 recovery both go through
  // requestTokenRefresh(), which deduplicates concurrent calls via a shared
  // in-flight promise. Using refreshSession() (rather than a separate
  // restoreSession implementation) prevents the bug where two independent
  // callers bypass the deduplication guard under React StrictMode or when
  // API requests fire immediately after mount.
  useEffect(() => {
    let isCancelled = false;

    const restoreSession = async () => {
      // refreshSession updates React state only after await; guard with
      // isCancelled to avoid setting state on an unmounted provider (e.g.
      // during React StrictMode double-invoke teardown).
      const result = await refreshApi();
      if (!isCancelled) {
        setToken(result.access_token);
        setUser(result.user);
        setAuthStatus("authenticated");
      }
    };

    restoreSession().catch(() => {
      if (!isCancelled) {
        setAccessToken(null);
        setToken(null);
        setUser(null);
        setAuthStatus("unauthenticated");
      }
    });

    return () => {
      isCancelled = true;
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const data = await loginApi({ email, password });
    setToken(data.access_token);
    setUser(data.user);
    setAuthStatus("authenticated");
  };

  const register = async (
    email: string,
    displayName: string,
    password: string,
  ): Promise<User> => {
    return registerApi({
      email,
      display_name: displayName,
      password,
    });
  };

  const logout = async (): Promise<void> => {
    try {
      await logoutApi();
    } finally {
      setAccessToken(null);
      setToken(null);
      setUser(null);
      setAuthStatus("unauthenticated");
    }
  };

  const logoutAll = async (): Promise<void> => {
    try {
      await logoutAllApi();
    } finally {
      setAccessToken(null);
      setToken(null);
      setUser(null);
      setAuthStatus("unauthenticated");
    }
  };

  const updateProfile = async (displayName: string, timezone?: string | null): Promise<void> => {
    const updated = await updateMeApi({ display_name: displayName, timezone });
    setUser(updated);
  };

  const changePassword = async (
    currentPassword: string,
    newPassword: string,
  ): Promise<void> => {
    await changePasswordApi({
      current_password: currentPassword,
      new_password: newPassword,
    });
    setAccessToken(null);
    setToken(null);
    setUser(null);
    setAuthStatus("unauthenticated");
  };

  const value: AuthContextType = {
    user,
    token: token || getAccessToken(),
    status: authStatus,
    isLoading: authStatus === "initializing",
    isAuthenticated: authStatus === "authenticated" && !!user,
    login,
    register,
    logout,
    logoutAll,
    updateProfile,
    changePassword,
    refreshSession,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
