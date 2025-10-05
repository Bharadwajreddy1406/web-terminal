import { execSync } from "child_process";
import os from "os";

function isExecutable(cmd: string): boolean {
  try {
    if (process.platform === "win32") {
      execSync(`where ${cmd}`, { stdio: "ignore" });
    } else {
      execSync(`which ${cmd}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
}

export function getShells() {
  const platform = os.platform();
  let osName: string;
  let shells: string[] = [];

  if (platform === "win32") {
    osName = "windows";
    const commonWindowsShells = ["cmd.exe", "powershell.exe", "pwsh", "bash"];
    shells = commonWindowsShells.filter(isExecutable);
    // Default to cmd if nothing else found
    if (shells.length === 0) shells.push("cmd.exe");

    // Optional: WSL shells - only show /bin/sh
    if (isExecutable("wsl")) {
      try {
        const wslOutput = execSync(`wsl cat /etc/shells`).toString();
        const wslShells = wslOutput
          .split("\n")
          .map(line => line.trim())
          .filter(line => line && !line.startsWith("#") && line === "/bin/sh");
        shells.push(...wslShells.map(s => `WSL:${s}`));
      } catch {}
    }
  } else {
    osName = "linux"; // also covers macOS for simplicity
    const commonUnixShells = ["bash", "zsh", "sh", "ksh", "fish", "tcsh"];
    shells = commonUnixShells.filter(isExecutable);
    if (shells.length === 0) shells.push("bash"); // default
  }

  return {
    OS: osName,
    shells,
  };
}

// console.log(JSON.stringify(getShells(), null, 2));


// #################################
// region Sample OUTPUTs
// #################################

//  Windows with WSL

// {
//   "OS": "windows",
//   "shells": [
//     "cmd.exe",
//     "powershell.exe",
//     "bash",
//     "WSL:/bin/sh",
//     "WSL:/usr/bin/sh",
//     "WSL:/bin/bash",
//     "WSL:/usr/bin/bash",
//     "WSL:/bin/rbash",
//     "WSL:/usr/bin/rbash",
//     "WSL:/usr/bin/dash",
//     "WSL:/usr/bin/tmux",
//     "WSL:/bin/zsh",
//     "WSL:/usr/bin/zsh",
//     "WSL:/usr/bin/zsh"
//   ]
// }