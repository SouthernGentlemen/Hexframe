import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

export const ROOT_DIR = resolve(dirname(fileURLToPath(import.meta.url)), "..");
export const ROOT_ENV_PATH = resolve(ROOT_DIR, ".env");

export function loadRootEnv() {
  let source;
  try {
    source = readFileSync(ROOT_ENV_PATH, "utf8");
  } catch {
    throw new Error(`Missing ${ROOT_ENV_PATH}. Copy .env.example to .env and fill it in.`);
  }
  const values = {};
  for (const rawLine of source.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals < 1) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    values[key] = value;
  }
  return values;
}

export function requireEnv(values, keys) {
  for (const key of keys) {
    if (!values[key]) throw new Error(`${key} is missing from ${ROOT_ENV_PATH}`);
  }
}

export function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: ROOT_DIR,
    env: options.env ?? process.env,
    input: options.input,
    stdio: options.input === undefined ? "inherit" : ["pipe", "inherit", "inherit"],
    encoding: "utf8",
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
