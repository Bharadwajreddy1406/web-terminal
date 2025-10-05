import { spawn } from "child_process";
import os from "os";
import path from "path";

export function getDefaultStartPath(): string {
  const plat = os.platform();
  if (plat === "win32") {
    // default to os.homedir(); fallback to env vars if needed
    const home = os.homedir() || process.env.USERPROFILE || process.env.HOME || "C:\\";
    // normalize to avoid trailing weirdness
    return path.resolve(home);
  } else {
    // Linux / macOS and others: root
    return "/";
  }
}

// trial
const shell = "cmd.exe";      // Windows default shell
const command = "dir";        // Use "dir" instead of "ls" for cmd

const child = spawn(command, {
  shell,        // run in cmd.exe
  stdio: "pipe"
});

child.stdout.on("data", (data) => {
  console.log(data.toString());
});

child.stderr.on("data", (data) => {
  console.error("Error:", data.toString());
});

child.on("close", (code) => {
  console.log(`Process exited with code ${code}`);
});

