import { Resend } from 'resend';

// Only instantiate Resend if the API key is provided, allowing graceful degradation
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
// Replace with your verified sender domain when configured
const DEFAULT_FROM = 'Golf Platform <onboarding@resend.dev>'; 

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}) {
  if (!resend) {
    console.warn(`[Email Mock] To: ${to} | Subject: ${subject}`);
    return { success: true, mocked: true };
  }

  try {
    const data = await resend.emails.send({
      from: DEFAULT_FROM,
      to,
      subject,
      html,
    });

    return { success: true, data };
  } catch (error) {
    console.error('Error sending email:', error);
    return { success: false, error };
  }
}
