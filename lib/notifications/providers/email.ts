import { isEmailEnabled } from '@/lib/notifications/config';
import { sendBrevoEmail } from '@/lib/email/brevo';
import type { NotificationMessage, NotificationRecipient, NotificationResult } from '@/lib/notifications/types';

export async function sendEmail(recipient:NotificationRecipient,message:NotificationMessage):Promise<NotificationResult>{
 if(!isEmailEnabled())return{success:false,channel:'email',skipped:true,error:'Email notifications are disabled.'};
 if(!recipient.email)return{success:false,channel:'email',error:'Email recipient has no email address.'};
 if(!message.subject)return{success:false,channel:'email',error:'Email subject is required.'};
 const result=await sendBrevoEmail({to:recipient.email,subject:message.subject,htmlContent:message.html??message.body.replace(/\n/g,'<br />'),senderName:message.senderName,attachments:message.attachments});
 return result.success?{success:true,channel:'email',messageId:result.messageId}:{success:false,channel:'email',error:result.error};
}
