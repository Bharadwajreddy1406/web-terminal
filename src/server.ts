import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import { createTerminalSession } from "./terminal";
import { getShells } from "./utils/shells";
import open from "open";

export function startServer(port: number = 3000) {
  const app = express();
  
  const server = app.listen(port, () => {
      console.log(` Web Terminal running at http://localhost:${port}`);
      open(`http://localhost:${port}`);
    });
    const wss = new WebSocketServer({ server });
  
    app.use(express.static("src/public"));
    
    // API endpoint to get available shells
    app.get("/api/shells", (req, res) => {
      try {
        const shells = getShells();
        res.json(shells);
      } catch (error) {
        console.error("Error getting shells:", error);
        res.status(500).json({ error: "Failed to get shells" });
      }
    });
  
    wss.on("connection", (ws) => {
      createTerminalSession(ws);
    });
}
