// Unified API response envelope.
// All endpoints return: { success: boolean, data?: T, error?: string }

import type { Context } from "hono";
import type { Env, AppVariables } from "../types";

type AppContext = Context<{ Bindings: Env; Variables: AppVariables }>;

type StatusCode = 200 | 201 | 400 | 401 | 404 | 413 | 415 | 429 | 500 | 502;

/** Return a success response with data. */
export function ok<T>(c: AppContext, data: T, status: StatusCode = 200) {
  return c.json({ success: true as const, data }, status);
}

/** Return an error response. */
export function err(c: AppContext, error: string, status: StatusCode = 400) {
  return c.json({ success: false as const, error }, status);
}
