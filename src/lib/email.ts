import { Resend } from 'resend';

// Only instantiate Resend if the API key is provided, allowing graceful degradation in dev/test
const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const SENDER_EMAIL = process.env.EMAIL_FROM || (
  process.env.NODE_ENV === 'production'
    ? 'Golf Platform <notifications@golfcharity.org>'
    : 'Golf Platform <onboarding@resend.dev>'
);

export async function sendEmail({
  to,
  subject,
  html,
}: {
  to: string;
  subject: string;
  html: string;
}): Promise<{ success: boolean; data?: unknown; error?: unknown; mocked?: boolean }> {
  if (!resend) {
    if (process.env.NODE_ENV === 'production') {
      const err = 'Email service not configured: RESEND_API_KEY is required in production.';
      return { success: false, error: err, mocked: false };
    }

    return { success: true, mocked: true };
  }

  try {
    const data = await resend.emails.send({
      from: SENDER_EMAIL,
      to,
      subject,
      html,
    });

    return { success: true, data };
  } catch (error) {
    return { success: false, error, mocked: false };
  }
}
