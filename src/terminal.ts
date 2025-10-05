import { spawn } from "child_process";
import { WebSocket } from "ws";

// session buffer CONFIG
const MAX_BUFFER_MESSAGES = 1000; // Configurable max messages to keep in memory

// Session storage for terminal output
const sessionBuffer: string[] = [];

function addToBuffer(data: string) {
  sessionBuffer.push(data);

  if (sessionBuffer.length > MAX_BUFFER_MESSAGES) {
    sessionBuffer.shift();
  }
}

function sendToClient(ws: WebSocket, data: string) {
  // Add to buffer for session persistence
  addToBuffer(data);
  // Send to client
  if (ws.readyState === WebSocket.OPEN) {
    ws.send(data);
  }
}

// Function to clear session buffer for future purposes 
export function clearSessionBuffer() {
  sessionBuffer.length = 0;
}

export function createTerminalSession(ws: WebSocket) {
  const shell = spawn(process.platform === "win32" ? "cmd.exe" : "bash", [], {
    stdio: "pipe",
  });

  // Send existing buffer to new connection
  sessionBuffer.forEach(data => {
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(data);
    }
  });

  // send shell stdout and stderr to client
  shell.stdout.on("data", (data) => sendToClient(ws, data.toString()));
  shell.stderr.on("data", (data) => sendToClient(ws, data.toString()));

  // write message to shell stdin
  ws.on("message", (msg) => {
    try {
      shell.stdin.write(msg + "\n");
    } catch (error) {
      console.error("Error writing to shell:", error);
    }
  });

  // on WebSocket close, kill the shell process
  ws.on("close", () => {
    try {
      shell.kill();
    } catch (error) {
      console.error("Error killing shell process:", error);
    }
  });
}
