/**
 * Waits until PostgreSQL accepts TCP connections (DATABASE_URL in repo root .env).
 * Usage (from repo root): node scripts/wait-for-pg.mjs
 */
import { createConnection } from "node:net";
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const envPath = resolve(root, ".env");

function loadDatabaseUrl() {
  if (existsSync(envPath)) {
    const raw = readFileSync(envPath, "utf8");
    const line = raw.split(/\r?\n/).find((l) => /^\s*DATABASE_URL=/.test(l));
    if (line) {
      const v = line.replace(/^\s*DATABASE_URL=\s*/, "").trim().replace(/^["']|["']$/g, "");
      if (v) return v;
    }
  }
  return process.env.DATABASE_URL;
}

const databaseUrl = loadDatabaseUrl();
if (!databaseUrl) {
  console.error("DATABASE_URL not found. Copy .env.example to .env in repo root.");
  process.exit(1);
}

let host = "127.0.0.1";
let port = 5432;
try {
  const u = new URL(databaseUrl.replace(/^postgresql:/i, "http:"));
  host = u.hostname || host;
  port = Number(u.port || 5432);
} catch {
  console.error("Could not parse DATABASE_URL");
  process.exit(1);
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function tryOnce() {
  return new Promise((resolve, reject) => {
    const s = createConnection({ host, port }, () => {
      clearTimeout(t);
      s.end();
      resolve();
    });
    const t = setTimeout(() => {
      s.destroy();
      reject(new Error("timeout"));
    }, 3000);
    s.on("error", () => {
      clearTimeout(t);
      s.destroy();
      reject(new Error("refused"));
    });
  });
}

process.stdout.write(`Waiting for PostgreSQL at ${host}:${port}`);
for (let i = 0; i < 45; i++) {
  try {
    await tryOnce();
    console.log("\nPostgreSQL is accepting connections.");
    process.exit(0);
  } catch {
    if (i % 5 === 0) process.stdout.write(".");
    await sleep(1000);
  }
}
console.error(
  `\n\nPostgreSQL never came up at ${host}:${port}.\n` +
    "- Install Docker Desktop, then from repo root: docker compose up -d\n" +
    "- Or install PostgreSQL for Windows and create database + user matching DATABASE_URL in .env\n",
);
process.exit(1);
