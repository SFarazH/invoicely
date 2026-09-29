import jwt from "jsonwebtoken";

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error("Please define the JWT_SECRET environment variable in .env.local");
}

export const COOKIE_NAME = "token";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 7; // 7 days

export const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax",
  path: "/",
  maxAge: MAX_AGE_SECONDS,
};

export function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: MAX_AGE_SECONDS });
}

// Returns the decoded payload, or null if the token is missing/invalid/expired.
export function verifyToken(token) {
  if (!token) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

// Helper for Route Handlers: pulls the userId out of the request's cookie.
// Returns null if there is no valid session — callers must treat that as
// "unauthenticated" and never trust a userId from anywhere else (e.g. the
// request body).
export function getUserId(request) {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  const payload = verifyToken(token);
  return payload?.userId || null;
}
