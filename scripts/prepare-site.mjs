import { cp, rm, mkdir } from "node:fs/promises";
await rm("out", { recursive: true, force: true });
await mkdir("out", { recursive: true });
await cp("apps/web/out", "out", { recursive: true });
console.log(
  "Static web export prepared in out/. API and worker deploy separately.",
);
