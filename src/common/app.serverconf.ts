import { getBackendCapabilities, type LegacyServerConf } from '~/modules/backend/store-backend-capabilities';


/*
 * Branch seam: `main` and `dev` export the same names and signatures from this file, with
 * different bodies (main: the backend capabilities store, dev: the Cloud Fabric legacy conf).
 * Callers on both branches import from here, so the branches differ in this file only.
 * Keep the exports identical on both branches: a new export lands on main first, dev supplies its body on the rebase.
 */

/** Server-provided configuration: which vendors and features the server holds keys or settings for. Today the legacy flat flags; the alias outlives that shape. */
export type ServerConf = LegacyServerConf;

/** The boolean flags of ServerConf, e.g. 'hasLlmOpenAI', 'hasBrowsing'. */
export type ServerConfFlag = { [K in keyof ServerConf]-?: ServerConf[K] extends boolean ? K : never }[keyof ServerConf];

export function getServerConf(): ServerConf {
  return getBackendCapabilities();
}

export function hasServerConf(flag: ServerConfFlag): boolean {
  // noinspection PointlessBooleanExpressionJS
  return !!getBackendCapabilities()[flag];
}
