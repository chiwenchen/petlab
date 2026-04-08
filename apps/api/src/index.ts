import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env, AppVariables } from "./types";
import authRoutes from "./routes/auth";
import petsRoutes from "./routes/pets";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: (origin) => origin, // permissive for v1 (iOS app + web viewer same project)
    allowHeaders: ["Content-Type", "Authorization"],
    allowMethods: ["GET", "POST", "PATCH", "DELETE", "OPTIONS"],
    credentials: false,
    maxAge: 86400,
  }),
);

app.get("/", (c) =>
  c.json({
    name: c.env.APP_NAME,
    status: "ok",
    version: "0.1.0",
  }),
);

app.route("/auth", authRoutes);
app.route("/pets", petsRoutes);

app.onError((err, c) => {
  console.error("unhandled", err);
  return c.json({ error: "internal_error", message: err.message }, 500);
});

app.notFound((c) => c.json({ error: "not_found" }, 404));

export default app;
