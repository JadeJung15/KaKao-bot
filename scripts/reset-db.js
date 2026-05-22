import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.dirname(__dirname);
const dbPath = process.env.DB_PATH || path.join(root, "data", "pixelgom-db.json");

await mkdir(path.dirname(dbPath), { recursive: true });
await writeFile(dbPath, `${JSON.stringify({ users: {}, rooms: {}, events: [] }, null, 2)}\n`, "utf8");
console.log(`Reset ${dbPath}`);
