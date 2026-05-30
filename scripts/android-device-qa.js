import { createHash } from "node:crypto";
import { createReadStream, existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const androidRoot = path.join(repoRoot, "pixelgom-bridge-android");
const gradleFile = path.join(androidRoot, "app", "build.gradle");
const aabPath = path.join(androidRoot, "app", "build", "outputs", "bundle", "release", "app-release.aab");
const defaultAdb = path.join(process.env.LOCALAPPDATA || "", "Android", "Sdk", "platform-tools", process.platform === "win32" ? "adb.exe" : "adb");

function run(command, args) {
  const result = spawnSync(command, args, { encoding: "utf8", maxBuffer: 1024 * 1024 * 8 });
  return {
    ok: result.status === 0,
    status: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
    error: result.error ? result.error.message : ""
  };
}

function parseVersion(buildGradle) {
  return {
    versionCode: Number(buildGradle.match(/versionCode\s+(\d+)/)?.[1] || 0),
    versionName: buildGradle.match(/versionName\s+"([^"]+)"/)?.[1] || ""
  };
}

function parseInstalledVersion(text) {
  return {
    versionCode: Number(text.match(/versionCode=(\d+)/)?.[1] || 0),
    versionName: text.match(/versionName=([^\s]+)/)?.[1] || "",
    lastUpdateTime: text.match(/lastUpdateTime=([^\r\n]+)/)?.[1]?.trim() || ""
  };
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

function firstMatch(text, pattern) {
  return text.split(/\r?\n/).find((line) => pattern.test(line))?.trim() || "";
}

try {
  const expected = parseVersion(await readFile(gradleFile, "utf8"));
  const aab = existsSync(aabPath)
    ? { exists: true, sizeBytes: (await stat(aabPath)).size, sha256: await sha256(aabPath) }
    : { exists: false };
  const adb = process.env.ADB_PATH || defaultAdb;
  const adbAvailable = existsSync(adb);
  const report = {
    ok: false,
    expected,
    aab,
    adb,
    adbAvailable,
    device: null,
    installed: null,
    screen: null,
    focus: null,
    nextAction: ""
  };

  if (!adbAvailable) {
    report.nextAction = "Android SDK platform-tools adb 경로를 확인하세요.";
    console.log(JSON.stringify(report, null, 2));
    process.exitCode = 1;
  } else {
    const devicesResult = run(adb, ["devices"]);
    const deviceLine = devicesResult.stdout.split(/\r?\n/).find((line) => /\tdevice$/.test(line));
    report.device = {
      connected: Boolean(deviceLine),
      serial: deviceLine ? deviceLine.split(/\s+/)[0] : "",
      raw: devicesResult.stdout.trim()
    };

    if (!deviceLine) {
      report.nextAction = "봇폰을 USB 디버깅 허용 상태로 연결하세요.";
      console.log(JSON.stringify(report, null, 2));
      process.exitCode = 1;
    } else {
      const packageResult = run(adb, ["shell", "dumpsys", "package", "com.pixgom.bridge"]);
      const powerResult = run(adb, ["shell", "dumpsys", "power"]);
      const windowResult = run(adb, ["shell", "dumpsys", "window"]);
      report.installed = parseInstalledVersion(packageResult.stdout);
      report.screen = {
        wakefulness: firstMatch(powerResult.stdout, /mWakefulness=/),
        displayState: firstMatch(powerResult.stdout, /mState=/),
        awakeLine: firstMatch(windowResult.stdout, /mAwake=|mScreenOn/)
      };
      report.focus = {
        current: firstMatch(windowResult.stdout, /mCurrentFocus=/),
        app: firstMatch(windowResult.stdout, /mFocusedApp=/),
        lockscreen: firstMatch(windowResult.stdout, /DreamingLockscreen|mShowingLockscreen/)
      };
      const installedMatches = report.installed.versionCode === expected.versionCode
        && report.installed.versionName === expected.versionName;
      report.ok = Boolean(report.device.connected && aab.exists && installedMatches);
      report.nextAction = installedMatches
        ? "최신 내부 테스트 앱이 설치되어 있습니다. 화면 잠금 해제 후 UI 캡처 QA를 진행하세요."
        : `봇폰은 ${report.installed.versionName || "미설치"}(${report.installed.versionCode || "-"})입니다. Play 내부 테스트에서 ${expected.versionName}(${expected.versionCode}) 업데이트 설치가 필요합니다.`;
      console.log(JSON.stringify(report, null, 2));
      if (!report.ok) process.exitCode = 1;
    }
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
