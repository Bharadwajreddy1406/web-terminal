import { spawn } from "child_process";
import { WebSocket } from "ws";
import { ChildProcess } from "child_process";

// session buffer CONFIG
const MAX_BUFFER_MESSAGES = 1000; // Configurable max messages to keep in memory

// Session storage for terminal output
const sessionBuffer: string[] = [];

// Store active terminals per WebSocket
const activeTerminals = new Map<WebSocket, ChildProcess>();
// Store current shell per WebSocket
const activeShells = new Map<WebSocket, string>();

function addToBuffer(data: string) {
  sessionBuffer.push(data);

  if (sessionBuffer.length > MAX_BUFFER_MESSAGES) {
    sessionBuffer.shift();
  }
}

function sendToClient(ws: WebSocket, data: string) {
  // Add to buffer for session persistence
  addToBuffer(data);
  
  // Detect manual shell switches in terminal output
  if (data.includes('Windows PowerShell') || data.includes('PowerShell')) {
    activeShells.set(ws, 'powershell.exe');
    ws.send('__SHELL_CHANGED__:powershell.exe');
  } else if (data.includes('Microsoft Windows') && data.includes('(c) Microsoft Corporation')) {
    activeShells.set(ws, 'cmd.exe');
    ws.send('__SHELL_CHANGED__:cmd.exe');
  }
  
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
function createNewTerminalProcess(ws: WebSocket, shellCommand?: string) {
  // Kill existing terminal if it exists
  const existingTerminal = activeTerminals.get(ws);
  if (existingTerminal) {
    try {
      existingTerminal.kill();
    } catch (error) {
      console.error("Error killing existing terminal:", error);
    }
  }

  // Determine shell command
  let shell: ChildProcess;
  let actualShellCommand: string;
  
  if (shellCommand) {
    if (shellCommand.startsWith("WSL:")) {
      // Handle WSL shells
      const wslShell = shellCommand.replace("WSL:", "");
      actualShellCommand = `WSL: ${wslShell}`;
      shell = spawn("wsl", ["-e", wslShell], {
        stdio: "pipe",
      });
    } else {
      // Handle regular shells
      actualShellCommand = shellCommand;
      shell = spawn(shellCommand, [], {
        stdio: "pipe",
      });
    }
  } else {
    // Default shell
    actualShellCommand = process.platform === "win32" ? "cmd.exe" : "bash";
    shell = spawn(actualShellCommand, [], {
      stdio: "pipe",
    });
  }

  // Store the new terminal and shell info
  activeTerminals.set(ws, shell);
  activeShells.set(ws, actualShellCommand);

  return shell;
}

export function createTerminalSession(ws: WebSocket) {
  const shell = createNewTerminalProcess(ws);

  // Don't send existing buffer to new connection (fresh session on reload)
  // Clear the buffer for new connections
  clearSessionBuffer();

  // send shell stdout and stderr to client
  if (shell.stdout) {
    shell.stdout.on("data", (data) => sendToClient(ws, data.toString()));
  }
  if (shell.stderr) {
    shell.stderr.on("data", (data) => sendToClient(ws, data.toString()));
  }

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
      if (newShell.stdout) {
        newShell.stdout.on("data", (data) => sendToClient(ws, data.toString()));
      }
      if (newShell.stderr) {
        newShell.stderr.on("data", (data) => sendToClient(ws, data.toString()));
      }
      
      // Send clear command to client first, then confirmation
      ws.send("__CLEAR_OUTPUT__");
      const currentShell = activeShells.get(ws) || "default";
      sendToClient(ws, `\n[SYSTEM] New terminal session created with ${currentShell}.\n\n`);
      return;
    }
    
    if (command.startsWith("__SELECT_SHELL__:")) {
      // Extract shell from command
      const selectedShell = command.replace("__SELECT_SHELL__:", "");
      
      // Clear the session buffer
      clearSessionBuffer();
      
      // Create new terminal process with selected shell
      const newShell = createNewTerminalProcess(ws, selectedShell);
      
      // Set up event listeners for the new shell
      if (newShell.stdout) {
        newShell.stdout.on("data", (data) => sendToClient(ws, data.toString()));
      }
      if (newShell.stderr) {
        newShell.stderr.on("data", (data) => sendToClient(ws, data.toString()));
      }
      
      // Send confirmation message
      sendToClient(ws, `\n[SYSTEM] Switched to ${selectedShell} shell.\n\n`);
      
      // Send shell info to client for UI update
      ws.send(`__SHELL_CHANGED__:${selectedShell}`);
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
        activeShells.delete(ws);
      }
    } catch (error) {
      console.error("Error killing shell process:", error);
    }
  });
}
