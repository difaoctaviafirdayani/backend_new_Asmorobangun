import type { Request } from "express";

// Bentuk req.user yang diisi oleh middleware requireAuth (src/middleware/auth.ts).
export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: "admin" | "member";
}

export type AuthedRequest = Request & { user: AuthUser };

// Memberi tahu TypeScript bahwa Express Request punya field tambahan ini.
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      token?: string;
      tokenExp?: number;
    }
  }
}