export type EmailAttachment = { content: string; name: string };
export type EmailSendResult =
  | { success: true; messageId?: string }
  | { success: false; error: string; errorCode: string };

function getBrevoConfig() {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.SENDER_EMAIL ?? process.env.BREVO_FROM_EMAIL;
  if (!apiKey || !senderEmail) throw new Error('Brevo is not configured.');
  return { apiKey, senderEmail };
}

function sanitizeSenderName(name: string) {
  return (
    name
      .replace(/[<>\r\n]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 70) || 'Silentra'
  );
}

export async function sendBrevoEmail(input: {
  to: string;
  toName?: string;
  subject: string;
  htmlContent: string;
  senderName?: string;
  attachments?: EmailAttachment[];
  contactPixelTrackingConsent?: boolean;
}): Promise<EmailSendResult> {
  if (!input.to || !input.subject || !input.htmlContent)
    return {
      success: false,
      error: 'Email recipient, subject and content are required.',
      errorCode: 'EMAIL_INPUT_INVALID',
    };

  let config: ReturnType<typeof getBrevoConfig>;
  try {
    config = getBrevoConfig();
  } catch {
    return {
      success: false,
      error: 'Brevo is not configured.',
      errorCode: 'BREVO_CONFIGURATION_MISSING',
    };
  }

  try {
    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
        'api-key': config.apiKey,
      },
      body: JSON.stringify({
        sender: {
          name: sanitizeSenderName(
            input.senderName ?? process.env.BREVO_FROM_NAME ?? 'Silentra',
          ),
          email: config.senderEmail,
        },
        to: [
          {
            email: input.to,
            ...(input.toName ? { name: input.toName } : {}),
            ...(input.contactPixelTrackingConsent === undefined
              ? {}
              : {
                  contactPixelTrackingConsent:
                    input.contactPixelTrackingConsent,
                }),
          },
        ],
        subject: input.subject,
        htmlContent: input.htmlContent,
        ...(input.attachments?.length
          ? {
              attachment: input.attachments.map((a) => ({
                content: a.content,
                name: a.name,
              })),
            }
          : {}),
      }),
    });

    const data = (await response.json().catch(() => null)) as
      | { messageId?: string; message?: string }
      | null;

    if (!response.ok)
      return {
        success: false,
        error: data?.message ?? 'Brevo email request failed.',
        errorCode: `BREVO_HTTP_${response.status}`,
      };

    return { success: true, messageId: data?.messageId };
  } catch (error) {
    console.error('[BREVO_EMAIL_ERROR]', {
      reason: error instanceof Error ? error.name : 'UNKNOWN',
      errorCode: 'BREVO_NETWORK_ERROR',
    });
    return {
      success: false,
      error: 'Unable to send email.',
      errorCode: 'BREVO_NETWORK_ERROR',
    };
  }
}
