import path from "node:path";
import { existsSync } from "node:fs";
import express, { type Express, type NextFunction, type Request, type Response } from "express";
import cors from "cors";
import session from "express-session";
import pinoHttp from "pino-http";
import router from "./routes";
import { logger } from "./lib/logger";

const app: Express = express();

const isProduction = process.env.NODE_ENV === "production";

/** Behind nginx/Caddy; needed for correct `req.secure` and session cookies over HTTPS. */
if (process.env.TRUST_PROXY === "1" || process.env.TRUST_PROXY === "true") {
  app.set("trust proxy", 1);
}

function resolveStaticRoot(): string | null {
  const fromEnv = process.env.STATIC_DIST?.trim();
  if (fromEnv) return fromEnv;
  const candidate = path.resolve(process.cwd(), "artifacts/pharma-pos/dist/public");
  return existsSync(candidate) ? candidate : null;
}

const staticRoot = resolveStaticRoot();

function sessionCookieSecure(): boolean {
  const v = process.env.SESSION_COOKIE_SECURE?.toLowerCase();
  if (v === "true" || v === "1") return true;
  if (v === "false" || v === "0") return false;
  return isProduction;
}

app.use(
  pinoHttp({
    logger,
    serializers: {
      req(req) {
        return {
          id: req.id,
          method: req.method,
          url: req.url?.split("?")[0],
        };
      },
      res(res) {
        return {
          statusCode: res.statusCode,
        };
      },
    },
  }),
);

app.use(cors({
  origin: true,
  credentials: true,
}));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(session({
  secret: process.env.SESSION_SECRET || "pharma-pos-secret-2024",
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: sessionCookieSecure(),
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    sameSite: "lax",
  },
}));

app.use((_req, res, next) => {
  res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate");
  res.setHeader("X-Frame-Options", "ALLOWALL");
  next();
});

app.use("/api", router);

/** Production: serve Vite build (`pnpm --filter @workspace/pharma-pos run build`) from one process. */
if (staticRoot) {
  app.use(express.static(staticRoot, { fallthrough: true }));
  app.use((req: Request, res: Response, next: NextFunction) => {
    if (req.path.startsWith("/api")) {
      next();
      return;
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
      next();
      return;
    }
    res.sendFile(path.join(staticRoot, "index.html"), (err) => next(err));
  });
} else if (isProduction) {
  logger.warn(
    "STATIC_DIST not set and default frontend dist missing — only /api is served. Run pharma-pos build or set STATIC_DIST.",
  );
}

// Never return Express HTML error pages to the SPA — always JSON under /api
app.use((err: unknown, req: Request, res: Response, next: NextFunction) => {
  const url = req.originalUrl ?? req.url ?? "";
  if (!url.startsWith("/api")) {
    next(err);
    return;
  }
  if (res.headersSent) {
    next(err);
    return;
  }
  const message = err instanceof Error ? err.message : "Server error";
  logger.error({ err, url }, "unhandled api error");
  const dev = process.env.NODE_ENV !== "production";
  res.status(500).json({
    error: "Server error",
    hint:
      /relation .* does not exist|Failed query/i.test(message)
        ? "Database tables may be missing. Set DATABASE_URL, then from repo root run: pnpm --filter @workspace/db run push"
        : undefined,
    detail: dev ? message.slice(0, 500) : undefined,
  });
});

export default app;
