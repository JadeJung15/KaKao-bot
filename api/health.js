export default function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }
  res.status(200).json({ ok: true, service: "pixelgom-chatroom-bot" });
}
