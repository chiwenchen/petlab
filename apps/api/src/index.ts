import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import type { Env, AppVariables } from "./types";
import authRoutes from "./routes/auth";
import petsRoutes from "./routes/pets";
import reportsRoutes from "./routes/reports";
import shareRoutes from "./routes/share";
import publicRoutes from "./routes/public";

const app = new Hono<{ Bindings: Env; Variables: AppVariables }>();

app.use("*", logger());
app.use(
  "*",
  cors({
    origin: ["https://petlab.redarch.dev", "http://localhost:3000"],
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
app.route("/", publicRoutes);
app.route("/", reportsRoutes);
app.route("/", shareRoutes);

app.onError((err, c) => {
  console.error("unhandled", err);
  return c.json({ success: false, error: "internal_error" }, 500);
});

app.notFound((c) => c.json({ success: false, error: "not_found" }, 404));

export default app;
