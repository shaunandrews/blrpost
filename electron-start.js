import { spawn } from "child_process";
import electron from "electron";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const child = spawn(electron, [path.join(__dirname, "main.js")], {
  stdio: "inherit",
});

child.on("close", (code) => {
  process.exit(code);
});
