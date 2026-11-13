// Builds the static export into out/ (for Cloudflare Pages). Same as `NEXT_OUTPUT=export next build`,
// written as a script so it works in any shell.
import { spawnSync } from "node:child_process";

const result = spawnSync("npx", ["next", "build"], {
  stdio: "inherit",
  shell: true,
  env: { ...process.env, NEXT_OUTPUT: "export" },
});
process.exit(result.status ?? 1);
