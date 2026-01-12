export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    const { email } = req.body || {};

    if (!email || typeof email !== 'string') {
        return res.status(400).json({ error: 'Email required' });
    }

    // API Configuration
    const API_KEY = process.env.EO_API_KEY;
    const LIST_ID = process.env.EO_LIST_ID;

    if (!API_KEY || !LIST_ID) {
        console.error("Missing Email Octopus configuration");
        return res.status(500).json({ error: 'Server configuration error' });
    }

    const EO_URL = `https://emailoctopus.com/api/1.6/lists/${LIST_ID}/contacts`;

    try {
        const response = await fetch(EO_URL, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                api_key: API_KEY,
                email_address: email.trim(),
            }),
        });

        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
            // Handle "Member exists" gracefully
            if (data.error && data.error.code === "MEMBER_EXISTS_WITH_EMAIL_ADDRESS") {
                return res.status(200).json({ ok: true, message: "Already subscribed" });
            }

            console.error("Email Octopus Error:", data);
            throw new Error(data.error?.message || "Failed to subscribe");
        }

        return res.status(200).json({ ok: true });
    } catch (error) {
        console.error("Failed to subscribe:", error);
        return res.status(500).json({ error: error.message || "Internal Server Error" });
    }
}
