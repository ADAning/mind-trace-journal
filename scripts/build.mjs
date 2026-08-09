import { fileURLToPath } from "node:url";
import path from "node:path";
import { build } from "esbuild";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const production = process.argv.includes("--production");

await build({
  entryPoints: [path.join(root, "src", "main.ts")],
  outfile: path.join(root, "main.js"),
  bundle: true,
  external: ["obsidian"],
  format: "cjs",
  platform: "browser",
  target: "es2022",
  minify: production,
  legalComments: "inline",
  sourcemap: production ? false : "inline",
  logLevel: "info"
});
