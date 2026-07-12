import { defineConfig, globalIgnores } from "eslint/config";
import { createRequire } from "node:module";

// TypeScript 7 intentionally exposes a smaller public compiler API. The current
// ESLint parser still consumes the legacy API, so load its pinned compatibility
// compiler before importing the Next.js rules. Application typechecks keep using
// the root TypeScript 7 binary.
const require = createRequire(import.meta.url);
const typescriptModulePath = require.resolve("typescript");
const legacyTypescript = require("typescript-eslint-compat");
const cachedTypescriptModule = require.cache[typescriptModulePath];

if (cachedTypescriptModule) {
  cachedTypescriptModule.exports = legacyTypescript;
} else {
  require.cache[typescriptModulePath] = {
    children: [],
    exports: legacyTypescript,
    filename: typescriptModulePath,
    id: typescriptModulePath,
    isPreloading: false,
    loaded: true,
    parent: null,
    path: typescriptModulePath.slice(0, typescriptModulePath.lastIndexOf("/")),
    paths: [],
    require,
  };
}

const [{ default: nextVitals }, { default: nextTypescript }] = await Promise.all([
  import("eslint-config-next/core-web-vitals"),
  import("eslint-config-next/typescript"),
]);

export default defineConfig([
  ...nextVitals,
  ...nextTypescript,
  globalIgnores([".next/**", "coverage/**", "playwright-report/**", "test-results/**"]),
]);
