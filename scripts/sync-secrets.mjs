import { loadRootEnv, requireEnv, run } from "./env.mjs";

const values = loadRootEnv();
const secretKeys = ["ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"];
requireEnv(values, ["CLOUDFLARE_ACCOUNT_ID", ...secretKeys]);
const environment = { ...process.env, CLOUDFLARE_ACCOUNT_ID: values.CLOUDFLARE_ACCOUNT_ID };

for (const key of secretKeys) {
  run("npx", ["wrangler", "secret", "put", key, "--env", "production"], {
    env: environment,
    input: values[key],
  });
}
