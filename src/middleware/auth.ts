// ===========================================================================
// MIDDLEWARE AUTH — cek token login (JWT) dan hak akses admin.
// Data akun dibaca dari MySQL.
// ===========================================================================
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { JWT_SECRET } from "../config/env";
import { findById, isTokenRevoked } from "../database/users.repo";
import type { AuthUser } from "../types/auth";

interface Resolved {
  user: AuthUser;
  exp?: number;
}

type TokenPayload = jwt.JwtPayload & { id: string; tv?: number };

function getToken(req: Request): string | null {
  const header = req.headers.authorization || "";
  return header.startsWith("Bearer ") ? header.slice(7) : null;
}

// Verifikasi token, pastikan belum logout, akunnya masih ada, dan token belum dicabut
// (token lama otomatis tidak berlaku setelah password diganti).
async function resolveUser(token: string): Promise<Resolved | null> {
  const payload = jwt.verify(token, JWT_SECRET) as TokenPayload;
  if (await isTokenRevoked(token)) return null; // sudah logout
  const user = await findById(payload.id);
  if (!user) return null;
  if ((payload.tv || 0) !== (user.tokenVersion || 0)) return null;
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role },
    exp: payload.exp,
  };
}

export async function requireAuth(req: Request, res: Response, next: NextFunction): Promise<void> {
  const token = getToken(req);
  if (!token) {
    res.status(401).json({ error: "Kamu harus login untuk melakukan ini." });
    return;
  }
  try {
    const resolved = await resolveUser(token);
    if (!resolved) {
      res.status(401).json({ error: "Sesi login sudah tidak berlaku. Silakan login ulang." });
      return;
    }
    req.user = resolved.user;
    req.token = token;
    req.tokenExp = resolved.exp;
    next();
  } catch (err: any) {
    if (err.name === "JsonWebTokenError" || err.name === "TokenExpiredError" || err.name === "NotBeforeError") {
      res.status(401).json({ error: "Sesi login tidak valid atau sudah kedaluwarsa." });
      return;
    }
    next(err); // error lain (misal MySQL mati) -> errorHandler
  }
}

// Menempelkan req.user kalau token valid, tapi tidak memblokir kalau tidak login.
export async function optionalAuth(req: Request, _res: Response, next: NextFunction): Promise<void> {
  const token = getToken(req);
  if (token) {
    try {
      const resolved = await resolveUser(token);
      if (resolved) {
        req.user = resolved.user;
        req.token = token;
        req.tokenExp = resolved.exp;
      }
    } catch {
      // token tidak valid -> dianggap belum login
    }
  }
  next();
}

export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== "admin") {
    res.status(403).json({ error: "Khusus admin sanggar." });
    return;
  }
  next();
}