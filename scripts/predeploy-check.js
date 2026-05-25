import { readdir } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";

function run(command, args) {
  let spawnCommand = command;
  let spawnArgs = args;
  if (process.platform === "win32" && command.endsWith(".cmd")) {
    spawnCommand = process.env.ComSpec || "cmd.exe";
    spawnArgs = ["/d", "/s", "/c", `${command} ${args.join(" ")}`];
  }
  const result = spawnSync(spawnCommand, spawnArgs, {
    cwd: repoRoot,
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 20,
    stdio: "pipe"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const reason = result.error ? `: ${result.error.message}` : "";
    throw new Error(`${command} ${args.join(" ")} failed with exit code ${result.status}${reason}`);
  }
}

async function jsFiles(dir) {
  const names = await readdir(path.join(repoRoot, dir));
  return names
    .filter((name) => name.endsWith(".js"))
    .map((name) => path.join(dir, name));
}

try {
  const files = [
    "server.js",
    ...(await jsFiles("public")),
    ...(await jsFiles("scripts"))
  ];
  for (const file of files) run(process.execPath, ["--check", file]);
  run("git", ["diff", "--check"]);
  run(npmCommand, ["run", "test:local"]);
  console.log("Predeploy checks passed.");
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
