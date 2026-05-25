import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const androidRoot = path.join(repoRoot, "pixelgom-bridge-android");
const gradleFile = path.join(androidRoot, "app", "build.gradle");
const aabPath = path.join(androidRoot, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const reportOnly = process.argv.includes("--report-only");
const defaultJavaHome = "C:\\Program Files\\Android\\Android Studio\\jbr";
const defaultAndroidHome = path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk");

function parseVersion(buildGradle) {
  const versionCode = Number(buildGradle.match(/versionCode\s+(\d+)/)?.[1] || 0);
  const versionName = buildGradle.match(/versionName\s+"([^"]+)"/)?.[1] || "";
  if (!versionCode || !versionName) throw new Error("Android versionCode/versionName을 app/build.gradle에서 찾지 못했습니다.");
  return { versionName, versionCode };
}

async function sha256(filePath) {
  const hash = createHash("sha256");
  await new Promise((resolve, reject) => {
    createReadStream(filePath)
      .on("data", (chunk) => hash.update(chunk))
      .on("error", reject)
      .on("end", resolve);
  });
  return hash.digest("hex");
}

function runGradle() {
  if (!process.env.JAVA_HOME && existsSync(path.join(defaultJavaHome, "bin", "java.exe"))) {
    process.env.JAVA_HOME = defaultJavaHome;
  }
  if (!process.env.ANDROID_HOME && defaultAndroidHome && existsSync(defaultAndroidHome)) {
    process.env.ANDROID_HOME = defaultAndroidHome;
  }
  const wrapper = process.platform === "win32" ? "gradlew.bat" : "./gradlew";
  const command = process.platform === "win32"
    ? { bin: process.env.ComSpec || "cmd.exe", args: ["/d", "/s", "/c", `${wrapper} :app:bundleRelease`] }
    : { bin: wrapper, args: [":app:bundleRelease"] };
  const result = spawnSync(command.bin, command.args, {
    cwd: androidRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 1024 * 1024 * 20,
    stdio: "pipe"
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) {
    const reason = result.error ? `: ${result.error.message}` : "";
    throw new Error(`Gradle bundleRelease failed with exit code ${result.status}${reason}`);
  }
}

try {
  const version = parseVersion(await readFile(gradleFile, "utf8"));
  if (!reportOnly) runGradle();
  const file = await stat(aabPath);
  const report = {
    ok: true,
    track: "closed-testing",
    versionName: version.versionName,
    versionCode: version.versionCode,
    aabPath,
    sizeBytes: file.size,
    sha256: await sha256(aabPath),
    note: "Play Console 업로드 기본 트랙은 비공개 테스트입니다."
  };
  console.log(JSON.stringify(report, null, 2));
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
