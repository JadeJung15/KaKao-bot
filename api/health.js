import { healthPayload } from "../server.js";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  const url = new URL(req.url || "/api/health", "http://localhost");
  res.status(200).json(await healthPayload(Object.fromEntries(url.searchParams.entries())));
}
