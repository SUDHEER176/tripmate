// Sends sign-in and verification codes. Uses Resend (https://resend.com) when
// RESEND_API_KEY is set; otherwise prints the code to the server log, which is
// only suitable for local development.

const SUBJECTS = {
  "sign-in": "Your TripMate sign-in code",
  "email-verification": "Verify your TripMate email",
  "forget-password": "Reset your TripMate password",
  "change-email": "Confirm your new TripMate email",
};

export async function sendOtpEmail(email, otp, type) {
  const subject = SUBJECTS[type] ?? "Your TripMate code";
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      console.error("RESEND_API_KEY is not set: cannot send verification emails.");
      return;
    }
    console.log(`[dev email] ${subject} for ${email}: ${otp}`);
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: process.env.EMAIL_FROM || "TripMate <onboarding@resend.dev>",
      to: [email],
      subject,
      text: `Your code is ${otp}. It expires in 10 minutes.\n\nIf you didn't ask for this, you can ignore this email.`,
    }),
  });
  if (!response.ok) {
    console.error(`Sending email failed with status ${response.status}.`);
  }
}
