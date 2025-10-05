import express from "express";
import { WebSocketServer } from "ws";
import http from "http";
import { createTerminalSession } from "./terminal";
import open from "open";

export function startServer(port: number = 3000) {
  const app = express();
  
  const server = app.listen(port, () => {
      console.log(`✅ Web Terminal running at http://localhost:${port}`);
      open(`http://localhost:${port}`);
    });
    const wss = new WebSocketServer({ server });
  
    app.use(express.static("src/public"));
  
    wss.on("connection", (ws) => {
      createTerminalSession(ws);
    });
}
