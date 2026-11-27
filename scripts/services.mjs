#!/usr/bin/env node
import {parseEnv} from "node:util";
import { spawn, spawnSync } from "node:child_process";
import { readFile, writeFile, chmod } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import { fileURLToPath } from "node:url";
import { join } from "node:path";

const root = fileURLToPath(new URL("../", import.meta.url));
const action = process.argv[2] || "start";
const extra = process.argv.slice(3);
const supported = ["start", "stop", "restart", "status", "logs", "config"];
function probe(command, args) {
  return (
    spawnSync(command, args, {
      cwd: root,
      stdio: "ignore",
      windowsHide: true,
      timeout: 10000,
    }).status === 0
  );
}
function run(command, args) {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: root,
      stdio: "inherit",
      windowsHide: true,
    });
    const interrupt = () => child.kill("SIGINT");
    process.once("SIGINT", interrupt);
    child.once("error", reject);
    child.once("exit", (code, signal) => {
      process.removeListener("SIGINT", interrupt);
      if (code === 0) resolve();
      else
        reject(
          new Error(`${command} ${args[0] || ""} exited ${signal || code}.`),
        );
    });
  });
}
const compose = (args) =>
  run("docker", [
    "compose",
    "--project-directory",
    root,
    "--file",
    join(root, "compose.yaml"),
    ...args,
  ]);
async function ensureDocker(allowStart = true) {
  const check = spawnSync("docker", ["--version"], {
    stdio: "ignore",
    windowsHide: true,
  });
  if (check.error?.code === "ENOENT")
    throw new Error(
      "Docker is not installed. Install Docker Desktop (macOS/Windows) or Docker Engine + Compose v2 (Linux), then run npm start again.",
    );
  if (!probe("docker", ["compose", "version"]))
    throw new Error(
      "Docker Compose v2 is required. Update Docker Desktop or install the Compose plugin.",
    );
  if (probe("docker", ["info"])) return;
  if (!allowStart)
    throw new Error("Docker is not running. Run npm start to start it.");
  console.log("Starting Docker…");
  if (process.platform === "darwin") await run("open", ["-a", "Docker"]);
  else if (process.platform === "win32")
    await run("powershell.exe", [
      "-NoProfile",
      "-NonInteractive",
      "-Command",
      'Start-Process -FilePath (Join-Path $env:ProgramFiles "Docker/Docker/Docker Desktop.exe")',
    ]);
  else if (
    !probe("systemctl", ["--user", "start", "docker"]) &&
    !probe("systemctl", ["--no-ask-password", "start", "docker"])
  )
    throw new Error(
      "Docker could not start. Start your Docker daemon (for example: sudo systemctl start docker), then rerun npm start.",
    );
  const deadline = Date.now() + 120000;
  while (Date.now() < deadline) {
    if (probe("docker", ["info"])) return;
    await new Promise((r) => setTimeout(r, 2000));
  }
  throw new Error(
    "Docker did not become ready within 120 seconds. Open Docker Desktop, check its status, and rerun npm start.",
  );
}
async function configure() {
  const path = join(root, ".env");
  let env;
  try {
    env = await readFile(path, "utf8");
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    env = await readFile(join(root, ".env.example"), "utf8");
    console.log("Creating local .env from .env.example.");
  }
  function ensure(key, fallback) {
    const pattern = new RegExp(`^${key}=(.*)$`, "m"),
      found = env.match(pattern);
    if (found && found[1].trim() && !['""', "''"].includes(found[1].trim()))
      return;
    const value = typeof fallback === "function" ? fallback() : fallback;
    if (found) env = env.replace(pattern, () => `${key}=${value}`);
    else env += `\n${key}=${value}\n`;
  }
  for (const key of ["AUTH_SECRET", "TOKEN_ENCRYPTION_KEY", "AI_SERVICE_TOKEN"])
    ensure(key, () => randomBytes(32).toString("hex"));
  ensure("NEXT_PUBLIC_API_URL", "http://localhost:4000");
  ensure("AI_SERVICE_URL", "http://localhost:8000");
  await writeFile(path, env, { mode: 0o600 });
  if (process.platform !== "win32") await chmod(path, 0o600);
  if (!/^OWNER_EMAIL=\S+/m.test(env) || !/^CLERK_SECRET_KEY=\S+/m.test(env))
    console.log(
      "Services can start now. Fill OWNER_EMAIL and Clerk credentials in .env to sign into the private dashboard.",
    );
}
async function main() {
  if (!supported.includes(action)) {
    console.log(
      "Usage: ./start.sh start|stop|restart|status|logs [service]|config\n   or: node scripts/services.mjs start|stop|restart|status|logs [service]|config",
    );
    process.exitCode = 1;
    return;
  }
  if (
    extra.some(
      (x) =>
        x.startsWith("-") ||
        !["web", "api", "ai", "worker", "db", "redis"].includes(x),
    )
  )
    throw new Error(
      "Optional arguments must be service names: web api ai worker db redis.",
    );
  if (action === "config") {
    await configure();
    console.log(
      "Local environment ready. Secrets are preserved and never printed.",
    );
    return;
  }
  // Reuse the CLI-linked Clerk app without printing or persisting its keys elsewhere.
  try{const keys=parseEnv(await readFile(join(root,'apps/web/.env.local'),'utf8'));for(const key of ['CLERK_SECRET_KEY','NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY'])if(!process.env[key]&&keys[key])process.env[key]=keys[key];}catch(error){if(error.code!=='ENOENT')throw error;}
  await ensureDocker(action === "start" || action === "restart");
  if (action === "start" || action === "restart") {
    await configure();
    if (action === "restart") await compose(["stop"]);
    console.log(
      "Docker-first startup: building PostgreSQL, Redis, Python AI (Gemini), NestJS API, worker, and Next.js…",
    );
    try {
      await compose([
        "up",
        "--build",
        "--detach",
        "--remove-orphans",
        "--wait",
        "--wait-timeout",
        "300",
      ]);
    } catch (error) {
      console.error(
        "Startup did not complete. Run ./start.sh status and ./start.sh logs <service> to inspect it. Existing data volumes are preserved.",
      );
      throw error;
    }
    console.log(
      "\nJobNester is ready (Docker).\n  Next.js web  http://localhost:3000\n  NestJS API   http://localhost:4000/api/health\n  Python AI    http://localhost:8000/health\n\nStop:   ./stop.sh   or   npm stop\nLogs:   ./start.sh logs api\nStatus: ./start.sh status\n",
    );
  } else if (action === "stop") {
    await compose(["stop"]);
    console.log("Services stopped. Database and Redis volumes are preserved.");
  } else if (action === "status") await compose(["ps", "--all"]);
  else if (action === "logs")
    await compose(["logs", "--follow", "--tail", "100", ...extra]);
}
main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
