import { spawn } from "child_process";
import { WebSocket } from "ws";
import { ChildProcess } from "child_process";

// session buffer CONFIG
const MAX_BUFFER_MESSAGES = 1000; // Configurable max messages to keep in memory

// Session storage for terminal output
const sessionBuffer: string[] = [];

// Store active terminals per WebSocket
const activeTerminals = new Map<WebSocket, ChildProcess>();

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

// Function to create a new terminal session and replace the old one
function createNewTerminalProcess(ws: WebSocket) {
  // Kill existing terminal if it exists
  const existingTerminal = activeTerminals.get(ws);
  if (existingTerminal) {
    try {
      existingTerminal.kill();
    } catch (error) {
      console.error("Error killing existing terminal:", error);
    }
  }

  // Create new terminal process
  const shell = spawn(process.platform === "win32" ? "powershell.exe" : "bash", [], {
    stdio: "pipe",
  });

  // Store the new terminal
  activeTerminals.set(ws, shell);

  return shell;
}

export function createTerminalSession(ws: WebSocket) {
  const shell = createNewTerminalProcess(ws);

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
    const command = msg.toString().trim();
    
    // Handle special commands
    if (command === "__NEW_SESSION__") {
      // Clear the session buffer
      clearSessionBuffer();
      
      // Create new terminal process
      const newShell = createNewTerminalProcess(ws);
      
      // Set up event listeners for the new shell
      newShell.stdout.on("data", (data) => sendToClient(ws, data.toString()));
      newShell.stderr.on("data", (data) => sendToClient(ws, data.toString()));
      
      // Send confirmation message
      sendToClient(ws, "New terminal session created.\n");
      return;
    }
    
    if (command === "__CLEAR__") {
      // Clear the session buffer
      clearSessionBuffer();
      
      // Send clear command to client
      ws.send("__CLEAR_OUTPUT__");
      return;
    }
    
    // Normal command handling
    try {
      const currentShell = activeTerminals.get(ws);
      if (currentShell && currentShell.stdin && currentShell.stdin.writable) {
        currentShell.stdin.write(command + "\n");
      }
    } catch (error) {
      console.error("Error writing to shell:", error);
    }
  });

  // on WebSocket close, kill the shell process
  ws.on("close", () => {
    try {
      const terminal = activeTerminals.get(ws);
      if (terminal) {
        terminal.kill();
        activeTerminals.delete(ws);
      }
    } catch (error) {
      console.error("Error killing shell process:", error);
    }
  });
}
