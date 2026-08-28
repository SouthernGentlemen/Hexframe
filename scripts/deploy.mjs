import { loadRootEnv, requireEnv, run } from "./env.mjs";

const values = loadRootEnv();
requireEnv(values, ["CLOUDFLARE_ACCOUNT_ID", "ADMIN_USERNAME", "ADMIN_PASSWORD", "ADMIN_SESSION_SECRET"]);
const environment = { ...process.env, CLOUDFLARE_ACCOUNT_ID: values.CLOUDFLARE_ACCOUNT_ID };

run("npm", ["run", "build"], { env: environment });
run("npx", ["wrangler", "deploy", "--env", "production"], { env: environment });
run("node", ["scripts/sync-secrets.mjs"], { env: environment });
