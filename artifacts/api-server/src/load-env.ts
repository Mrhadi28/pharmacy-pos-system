import { config } from "dotenv";
import { resolve } from "node:path";

const repoRoot = process.cwd();
config({ path: resolve(repoRoot, ".env") });
