import { handleSkill } from "../server.js";

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "method_not_allowed" });
    return;
  }

  try {
    const payload = typeof req.body === "string" ? JSON.parse(req.body || "{}") : req.body || {};
    res.status(200).json(await handleSkill(payload));
  } catch (error) {
    console.error(error);
    res.status(500).json({
      version: "2.0",
      template: {
        outputs: [{ simpleText: { text: "서버 오류가 발생했습니다. 잠시 후 다시 시도해주세요." } }]
      }
    });
  }
}
