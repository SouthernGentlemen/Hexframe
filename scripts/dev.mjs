import { loadRootEnv, requireEnv, run } from "./env.mjs";

const values = loadRootEnv();
requireEnv(values, ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"]);
if (!process.argv.includes("--skip-build")) run("npm", ["run", "build"]);
run("npx", [
  "wrangler", "dev", "--port", "8788",
  "--var", `ADMIN_USERNAME:${values.ADMIN_USERNAME}`,
  "--var", `ADMIN_PASSWORD:${values.ADMIN_PASSWORD}`,
  "--var", `ADMIN_SESSION_SECRET:${values.ADMIN_SESSION_SECRET}`,
]);
