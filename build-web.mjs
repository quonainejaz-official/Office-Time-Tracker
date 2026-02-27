import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const webDir = path.join(root, "www");
if (!fs.existsSync(webDir)) fs.mkdirSync(webDir, { recursive: true });

const files = ["index.html", "app.js", "styles.css", "manifest.json", "sw.js"];
for (const f of files) {
  fs.copyFileSync(path.join(root, f), path.join(webDir, f));
}

const srcIcons = path.join(root, "icons");
const dstIcons = path.join(webDir, "icons");
if (!fs.existsSync(dstIcons)) fs.mkdirSync(dstIcons, { recursive: true });
for (const f of fs.readdirSync(srcIcons)) {
  const s = path.join(srcIcons, f);
  const d = path.join(dstIcons, f);
  if (fs.statSync(s).isFile()) fs.copyFileSync(s, d);
}

console.log("Web assets copied to www/.");