export const NOTIFICATION_CHANNELS = ['email', 'sms', 'push'] as const;
export type NotificationChannel = (typeof NOTIFICATION_CHANNELS)[number];
export type NotificationRecipient = {
  email?: string | null;
  phone?: string | null;
  userId?: string | null;
};
export type NotificationAttachment = { content: string; name: string };
export type NotificationMessage = {
  subject?: string;
  body: string;
  html?: string;
  senderName?: string;
  attachments?: NotificationAttachment[];
};
export type NotificationResult =
  | { success: true; channel: NotificationChannel; messageId?: string }
  | {
      success: false;
      channel: NotificationChannel;
      skipped?: boolean;
      error: string;
    };
