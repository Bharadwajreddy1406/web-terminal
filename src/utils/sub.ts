import { spawn } from "child_process";

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
