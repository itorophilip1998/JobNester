import { spawn } from "node:child_process";
const child = spawn(
  process.platform === "win32" ? "npm.cmd" : "npm",
  ["run", "dev", "-w", "@jobnester/web"],
  {
    stdio: "inherit",
    env: {
      ...process.env,
      NEXT_PUBLIC_API_URL: "",
      NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
      CLERK_SECRET_KEY: "",
    },
    shell: process.platform === "win32",
  },
);
process.on("SIGINT", () => child.kill("SIGINT"));
process.on("SIGTERM", () => child.kill("SIGTERM"));
child.on("error", (error) => {
  console.error(error.message);
  process.exitCode = 1;
});
child.on("exit", (code) => {
  process.exitCode = code || 0;
});
