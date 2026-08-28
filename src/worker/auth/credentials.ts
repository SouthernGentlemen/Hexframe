/**
 * The single operator credential, and the only place it is ever compared.
 *
 * There is one account. That is why this is a pair of string comparisons and not a user
 * table: advanced Training tools are private, and inventing a user store for one operator
 * would be more code to get wrong, not less.
 */
import type { Env } from "../env";
import { missingCredentialBindings } from "../env";
import { timingSafeEqual } from "./session";

/** True only when all three `ADMIN_*` bindings are present and non-empty. */
export function credentialsConfigured(env: Env): boolean {
  return missingCredentialBindings(env).length === 0;
}

/**
 * Check a submitted username and password.
 *
 * Both comparisons always run and their results are combined at the end. Returning early
 * on a username mismatch would make a wrong username measurably faster than a wrong
 * password, which hands an attacker a username oracle for free — and once they know the
 * username is right they know every remaining failure is the password.
 *
 * An unconfigured Worker returns false here as well as answering 503 upstream, so that a
 * missing binding can never be mistaken for a match against `undefined`.
 */
export function checkCredentials(env: Env, username: string, password: string): boolean {
  if (!credentialsConfigured(env)) return false;

  const userOk = timingSafeEqual(username, env.ADMIN_USERNAME ?? "");
  const passOk = timingSafeEqual(password, env.ADMIN_PASSWORD ?? "");
  return userOk && passOk;
}
