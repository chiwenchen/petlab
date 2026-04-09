import type { MiddlewareHandler } from "hono";
import type { Env, AppVariables } from "../types";
import { verifyJwt } from "../lib/jwt";

export const requireAuth: MiddlewareHandler<{ Bindings: Env; Variables: AppVariables }> = async (c, next) => {
  const header = c.req.header("Authorization");
  if (!header || !header.startsWith("Bearer ")) {
    return c.json({ success: false, error: "missing_token" }, 401);
  }
  const token = header.slice(7);
  const payload = await verifyJwt(token, c.env.JWT_SECRET);
  if (!payload) return c.json({ success: false, error: "invalid_token" }, 401);

  c.set("auth", { userId: payload.sub, email: payload.email });
  await next();
};
