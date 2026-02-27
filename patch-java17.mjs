import fs from "node:fs";

const files = [
  "android/app/capacitor.build.gradle",
  "android/capacitor-cordova-android-plugins/build.gradle",
  "node_modules/@capacitor/android/capacitor/build.gradle"
];

for (const file of files) {
  if (!fs.existsSync(file)) continue;
  const src = fs.readFileSync(file, "utf8");
  const out = src.replaceAll("JavaVersion.VERSION_21", "JavaVersion.VERSION_17");
  if (out !== src) {
    fs.writeFileSync(file, out);
    console.log(`Patched Java version in ${file}`);
  } else {
    console.log(`No Java 21 markers found in ${file}`);
  }
}