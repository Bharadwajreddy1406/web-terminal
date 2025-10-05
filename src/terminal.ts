import { spawn } from "child_process";
import { WebSocket } from "ws";

export function createTerminalSession(ws: WebSocket) {
  const shell = spawn(process.platform === "win32" ? "cmd.exe" : "bash", [], {
    stdio: "pipe",
  });

  shell.stdout.on("data", (data) => ws.send(data.toString()));
  shell.stderr.on("data", (data) => ws.send(data.toString()));
  ws.on("message", (msg) => shell.stdin.write(msg + "\n"));
  ws.on("close", () => shell.kill());
}
