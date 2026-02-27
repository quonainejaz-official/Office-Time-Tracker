import { app, BrowserWindow } from "electron";
import path from "node:path";
import { fileURLToPath } from "node:url";
import fs from "node:fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getWwwPath() {
  // In packaged app, extraResources go to process.resourcesPath/www
  // In development, www is relative to __dirname
  const packedPath = path.join(process.resourcesPath, "www", "index.html");
  const devPath = path.join(__dirname, "www", "index.html");

  if (fs.existsSync(packedPath)) {
    return packedPath;
  }
  return devPath;
}

function createWindow() {
  const win = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 360,
    minHeight: 640,
    autoHideMenuBar: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      nodeIntegration: false,
    },
  });

  const indexPath = getWwwPath();
  win.loadFile(indexPath);

  // Uncomment for debugging white screen issues:
  // win.webContents.openDevTools();

  win.webContents.on("did-fail-load", (event, errorCode, errorDescription) => {
    console.error("Failed to load:", errorCode, errorDescription);
    // Show fallback error page so user sees something instead of white screen
    win.loadURL(
      `data:text/html,<h2 style="font-family:sans-serif;padding:40px;color:#c00">Load Error ${errorCode}: ${errorDescription}<br><br>Path tried: ${indexPath}</h2>`
    );
  });
}

app.whenReady().then(() => {
  createWindow();

  app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on("window-all-closed", () => {
  if (process.platform !== "darwin") app.quit();
});