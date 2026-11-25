/* Production build: bundles + minifies JS (with code splitting), minifies CSS,
   adds content hashes to file names, rewrites index.html, copies static assets. */
import { build } from "esbuild";
import { cp, mkdir, readdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { join, relative } from "node:path";
import { gzipSync } from "node:zlib";

const OUT = "dist";
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const js = await build({
  entryPoints: ["src/js/main.js"],
  bundle: true, splitting: true, format: "esm", target: "es2020",
  minify: true, legalComments: "none", metafile: true,
  outdir: `${OUT}/assets`, entryNames: "app-[hash]", chunkNames: "chunks/[name]-[hash]",
});
const css = await build({
  entryPoints: ["src/css/main.css"],
  bundle: true, minify: true, metafile: true,
  outdir: `${OUT}/assets`, entryNames: "style-[hash]",
});

const find = (meta, ext) => Object.keys(meta.outputs).find((k) => k.endsWith(ext) && !k.includes("/chunks/"));
const url = (file) => "/" + relative(OUT, file).split("\\").join("/");

let html = await readFile("src/index.html", "utf8");
html = html.replace("/css/main.css", url(find(css.metafile, ".css")))
           .replace("/js/main.js", url(find(js.metafile, ".js")))
           .replace(/>\s+</g, "><")
           .trim();
await writeFile(join(OUT, "index.html"), html);

await cp("src/data", join(OUT, "data"), { recursive: true });
await cp("src/images", join(OUT, "images"), { recursive: true });

// size report
console.log("\nBuild output (raw / gzip):");
for (const file of await readdir(OUT, { recursive: true })) {
  const path = join(OUT, file);
  if (!(await stat(path)).isFile() || file.startsWith("images")) continue;
  const data = await readFile(path);
  console.log(`  ${file.padEnd(34)} ${(data.length / 1024).toFixed(1).padStart(6)} kB / ${(gzipSync(data).length / 1024).toFixed(1).padStart(5)} kB`);
}
console.log("\nDone. Output is in ./dist");
