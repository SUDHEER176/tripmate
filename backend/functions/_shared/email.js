// Sends sign-in and verification codes. Uses Brevo (https://www.brevo.com) when
// BREVO_API_KEY is set; otherwise prints the code to the server log, which is
// only suitable for local development.
//
// EMAIL_FROM must be a sender verified in Brevo (Senders, Domains & Dedicated IPs
// > Senders), written as "Name <address>" or just "address".

const SUBJECTS = {
  "sign-in": "Your TripMate sign-in code",
  "email-verification": "Verify your TripMate email",
  "forget-password": "Reset your TripMate password",
  "change-email": "Confirm your new TripMate email",
};

export function parseSender(value) {
  const text = String(value ?? "").trim();
  const match = text.match(/^(.*?)\s*<([^<>\s]+@[^<>\s]+)>$/);
  if (match) return { name: match[1].trim() || "TripMate", email: match[2] };
  return { name: "TripMate", email: text };
}

export async function sendOtpEmail(email, otp, type) {
  const subject = SUBJECTS[type] ?? "Your TripMate code";
  const apiKey = process.env.BREVO_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("BREVO_API_KEY is not set: cannot send verification emails.");
      return;
    }
    console.log(`[dev email] ${subject} for ${email}: ${otp}`);
    return;
  }

  const sender = parseSender(process.env.EMAIL_FROM);
  if (!sender.email) {
    console.error("EMAIL_FROM is not set: it must be a sender verified in Brevo.");
    return;
  }

  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email }],
      subject,
      textContent: `Your code is ${otp}. It expires in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
    }),
  });
  if (!response.ok) {
    // Brevo's error body names the problem (e.g. unverified sender); it has no secrets.
    const detail = (await response.text().catch(() => "")).slice(0, 300);
    console.error(`Sending email via Brevo failed with status ${response.status}: ${detail}`);
  }
}
