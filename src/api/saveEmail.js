// api/saveEmail.js

import { promises as fs } from "fs";
import path from "path";

// Location of the JSON file where we store the latest email submission
const EMAIL_FILE = path.resolve("data/client_email.json");

export default async function handler(req, res) {
  // Accept POST only
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  // Parse email from body
  const { email } = req.body || {};
  if (!email || typeof email !== "string") {
    res.status(400).json({ error: "Email required" });
    return;
  }

  const payload = {
    client_email: email.trim(),
    saved_at: new Date().toISOString(),
  };

  try {
    // Make sure directory exists
    await fs.mkdir(path.dirname(EMAIL_FILE), { recursive: true });

    // Write JSON file (overwrites with the latest submission)
    await fs.writeFile(EMAIL_FILE, JSON.stringify(payload, null, 2), "utf-8");

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error("Failed to save email", error);
    res.status(500).json({ error: "Failed to save email" });
  }
}