import { loadRootEnv, requireEnv, run } from "./env.mjs";

const values = loadRootEnv();
requireEnv(values, ["CLOUDFLARE_ACCOUNT_ID"]);
const environment = { ...process.env, CLOUDFLARE_ACCOUNT_ID: values.CLOUDFLARE_ACCOUNT_ID };

run("npx", ["wrangler", "deploy", "--config", "wrangler.shadowmoney-retirement.jsonc"], {
  env: environment,
});
