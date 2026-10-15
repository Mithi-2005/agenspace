import { createContext } from "react";
import type { User } from "../types/auth";

export interface AuthContextType {
  user: User | null;
  token: string | null;
  status?: "initializing" | "authenticated" | "unauthenticated";
  isLoading: boolean;
  isAuthenticated: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, displayName: string, password: string) => Promise<User>;
  logout: () => Promise<void>;
  logoutAll: () => Promise<void>;
  updateProfile: (displayName: string) => Promise<void>;
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>;
  refreshSession: () => Promise<boolean>;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);
