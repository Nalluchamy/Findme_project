import { NextRequest } from 'next/server';
import { requireAuth, successResponse, errorResponse } from '@/lib/api';
import { ParcelRepository } from '@/repositories/parcel.repository';
import { NotificationService } from '@/services/notification.service';
import { validateStateTransition } from '@/lib/stateMachine';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { authorized, errorResponse: authError, session } = requireAuth(req, ['FINANCE_OFFICER', 'ADMIN']);
  if (!authorized || !session) return authError!;

  const resolvedParams = await params;
  const id = resolvedParams.id;
  const { referenceId } = await req.json();

  if (!referenceId) {
    return errorResponse('INVALID_INPUT', 'Payout Reference ID is required.');
  }

  const parcelRepo = new ParcelRepository(session);
  const notificationService = new NotificationService(session);

  try {
    const parcel = await parcelRepo.findById(id);
    if (!parcel) {
      return errorResponse('PARCEL_NOT_FOUND', 'Parcel not found.', 404);
    }

    const validation = validateStateTransition(parcel.currentState, 'SETTLED_TO_SELLER');
    if (!validation.valid) {
      return errorResponse('INVALID_TRANSITION', validation.error || 'Invalid transition state.', 400);
    }

    await db.$transaction(async (tx: any) => {
      await tx.ledgerEvent.create({
        data: {
          parcelId: id,
          eventType: 'SETTLED_TO_SELLER',
          fromPartyId: session.id,
          toPartyId: parcel.sellerId,
          expectedAmount: parcel.codAmount,
          confirmedAmount: parcel.codAmount,
          confirmedByFrom: true,
          confirmedByTo: true,
          discrepancyNote: `Payout Completed. Ref ID: ${referenceId}`,
        },
      });

      await tx.parcel.update({
        where: { id },
        data: {
          currentState: 'SETTLED_TO_SELLER',
        },
      });
    });

    // Send simulated WhatsApp notification for successful payouts
    await notificationService.sendAlert(
      '9876543210', // Target phone number (Mocked customer/seller)
      'SELLER_PAID',
      id,
      { txnId: referenceId }
    );

    return successResponse({ success: true }, 'Payout issued successfully.');
  } catch (error: any) {
    console.error('Payout error:', error);
    return errorResponse('INTERNAL_ERROR', 'A server error occurred during payout.');
  }
}
