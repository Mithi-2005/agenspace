import React, { useEffect, useState } from "react";
import { loginApi, logoutAllApi, logoutApi, refreshApi, registerApi } from "../api/auth";
import { changePasswordApi, updateMeApi } from "../api/users";
import { getAccessToken, setAccessToken } from "../api/client";
import type { User } from "../types/auth";
import { AuthContext, type AuthContextType } from "./authContextDef";

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refreshSession = async (): Promise<boolean> => {
    try {
      const data = await refreshApi();
      setToken(data.access_token);
      setUser(data.user);
      return true;
    } catch {
      setAccessToken(null);
      setToken(null);
      setUser(null);
      return false;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const restoreSession = async () => {
      try {
        const data = await refreshApi();
        if (isMounted) {
          setToken(data.access_token);
          setUser(data.user);
        }
      } catch {
        if (isMounted) {
          setAccessToken(null);
          setToken(null);
          setUser(null);
        }
      } finally {
        if (isMounted) {
          setIsLoading(false);
        }
      }
    };

    void restoreSession();
    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email: string, password: string): Promise<void> => {
    const data = await loginApi({ email, password });
    setToken(data.access_token);
    setUser(data.user);
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
      setToken(null);
      setUser(null);
    }
  };

  const logoutAll = async (): Promise<void> => {
    try {
      await logoutAllApi();
    } finally {
      setToken(null);
      setUser(null);
    }
  };

  const updateProfile = async (displayName: string): Promise<void> => {
    const updated = await updateMeApi({ display_name: displayName });
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
  };

  const value: AuthContextType = {
    user,
    token: token || getAccessToken(),
    isLoading,
    isAuthenticated: !!user,
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
