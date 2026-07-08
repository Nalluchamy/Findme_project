import { db } from '@/lib/db';
import { UserSession } from '@/types';
import { NotificationTemplateType, NotificationTemplates } from '@/constants';

export class NotificationService {
  private session: UserSession;

  constructor(session: UserSession) {
    this.session = session;
  }

  // Persists the notification audit log and triggers simulated dispatch
  async sendAlert(recipientPhone: string, template: NotificationTemplateType, parcelId: string, params: Record<string, string>) {
    let messageBody = '';
    
    switch (template) {
      case NotificationTemplates.PARCEL_CREATED:
        messageBody = `Hi! Your shipment ${parcelId} has been registered with Courier Connect. COD Amount to pay on delivery: ₹${params.codAmount}.`;
        break;
      case NotificationTemplates.OUT_FOR_DELIVERY:
        messageBody = `Your package ${parcelId} is out for delivery. Agent ${params.agentName} will arrive shortly.`;
        break;
      case NotificationTemplates.COD_COLLECTED:
        messageBody = `COD payment of ₹${params.amount} collected successfully for parcel ${parcelId}.`;
        break;
      case NotificationTemplates.SELLER_PAID:
        messageBody = `Payout settled for parcel ${parcelId}. Transaction ID: ${params.txnId}.`;
        break;
      default:
        messageBody = `Update regarding parcel ${parcelId}.`;
    }

    try {
      // Mock network dispatch
      console.log(`[WhatsApp API Simulated Webhook] TO: ${recipientPhone} | TEXT: "${messageBody}"`);

      if (!this.session.companyId) {
        throw new Error('No company context available for notification logging');
      }

      // Persist to database log table
      return await db.notificationLog.create({
        data: {
          companyId: this.session.companyId,
          parcelId,
          recipient: recipientPhone,
          channel: 'WHATSAPP',
          template,
          status: 'SENT',
        },
      });
    } catch (error: any) {
      console.error('Failed to log or send notification:', error.message);
      
      // Save failed log for recovery auditing
      if (this.session.companyId) {
        await db.notificationLog.create({
          data: {
            companyId: this.session.companyId,
            parcelId,
            recipient: recipientPhone,
            channel: 'WHATSAPP',
            template,
            status: 'FAILED',
          },
        }).catch(() => {});
      }
    }
  }
}
