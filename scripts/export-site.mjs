import { spawnSync } from "node:child_process";
const npm = process.platform === "win32" ? "npm.cmd" : "npm";
const result = spawnSync(npm, ["run", "build", "-w", "@jobnester/web"], {
  stdio: "inherit",
  env: {
    ...process.env,
    WEB_OUTPUT: "export",
    NEXT_PUBLIC_API_URL: "",
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY: "",
    CLERK_SECRET_KEY: "",
  },
  shell: process.platform === "win32",
});
if (result.status !== 0) process.exit(result.status || 1);
await import("./prepare-site.mjs");
