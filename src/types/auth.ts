import type { Request } from "express";

// Bentuk req.user yang diisi oleh middleware requireAuth (src/middleware/auth.js).
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
}

export type AuthedRequest = Request & { user: AuthUser };