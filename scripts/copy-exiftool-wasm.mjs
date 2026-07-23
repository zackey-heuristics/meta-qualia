// @uswriting/exiftool's runtime fetches "./zeroperl.wasm" relative to the page's
// document URL — bundlers can't detect that string reference, so the wasm binary
// has to be placed in public/ by hand (regenerated on install, not committed).
import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const rootDir = dirname(dirname(fileURLToPath(import.meta.url)));
const src = join(rootDir, "node_modules/@6over3/zeroperl-ts/dist/esm/zeroperl.wasm");
const destDir = join(rootDir, "public");
const dest = join(destDir, "zeroperl.wasm");

if (!existsSync(src)) {
  console.warn("[copy-exiftool-wasm] source wasm not found, skipping:", src);
  process.exit(0);
}

mkdirSync(destDir, { recursive: true });
copyFileSync(src, dest);
console.log("[copy-exiftool-wasm] copied to", dest);
