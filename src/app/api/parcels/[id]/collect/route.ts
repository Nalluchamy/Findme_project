import { NextRequest } from 'next/server';
import { requireAuth, successResponse, errorResponse } from '@/lib/api';
import { ParcelRepository } from '@/repositories/parcel.repository';
import { NotificationService } from '@/services/notification.service';
import { validateStateTransition } from '@/lib/stateMachine';
import { db } from '@/lib/db';

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> | { id: string } }) {
  const { authorized, errorResponse: authError, session } = requireAuth(req, ['DELIVERY_AGENT', 'ADMIN']);
  if (!authorized || !session) return authError!;

  const resolvedParams = await params;
  const id = resolvedParams.id;
  
  const { amount, photoUrl, gpsCoords } = await req.json();

  if (amount === undefined) {
    return errorResponse('INVALID_INPUT', 'Amount is required.');
  }

  const parcelRepo = new ParcelRepository(session);
  const notificationService = new NotificationService(session);

  try {
    const parcel = await parcelRepo.findById(id);
    if (!parcel) {
      return errorResponse('PARCEL_NOT_FOUND', 'Parcel not found.', 404);
    }

    const validation = validateStateTransition(parcel.currentState, 'COD_COLLECTED');
    if (!validation.valid) {
      return errorResponse('INVALID_TRANSITION', validation.error || 'Invalid transition state.', 409);
    }

    const expected = Number(parcel.codAmount);
    const confirmed = Number(amount);

    const result = await db.$transaction(async (tx: any) => {
      if (expected !== confirmed) {
        // Discrepancy mismatch
        await tx.ledgerEvent.create({
          data: {
            parcelId: id,
            eventType: 'COD_COLLECTED',
            fromPartyId: session.id,
            expectedAmount: expected,
            confirmedAmount: confirmed,
            confirmedByFrom: true,
            confirmedByTo: true,
            photoUrl,
            gpsCoords,
            discrepancyNote: `Doorstep collection mismatch: Expected ₹${expected}, Agent collected ₹${confirmed}`,
          },
        });

        await tx.ledgerEvent.create({
          data: {
            parcelId: id,
            eventType: 'DISCREPANCY_FLAGGED',
            expectedAmount: expected,
            confirmedAmount: confirmed,
            discrepancyNote: `Doorstep collection mismatch: Expected ₹${expected}, Agent collected ₹${confirmed}`,
          },
        });

        await tx.parcel.update({
          where: { id },
          data: { currentState: 'DISCREPANCY_FLAGGED' },
        });

        return { flagged: true, message: 'Discrepancy flagged due to amount mismatch.' };
      } else {
        // Success collection
        await tx.ledgerEvent.create({
          data: {
            parcelId: id,
            eventType: 'COD_COLLECTED',
            fromPartyId: session.id,
            expectedAmount: expected,
            confirmedAmount: confirmed,
            confirmedByFrom: true,
            confirmedByTo: true,
            photoUrl,
            gpsCoords,
          },
        });

        await tx.parcel.update({
          where: { id },
          data: { currentState: 'COD_COLLECTED' },
        });

        return { flagged: false, message: 'COD collected successfully.' };
      }
    });

    // Send simulated WhatsApp notification for successful collections
    if (!result.flagged) {
      await notificationService.sendAlert(
        '9876543210', // Target phone number (Mocked customer/seller)
        'COD_COLLECTED',
        id,
        { amount: confirmed.toString() }
      );
    }

    return successResponse(result, result.message);
  } catch (error: any) {
    console.error('Collection error:', error);
    return errorResponse('INTERNAL_ERROR', 'A server error occurred during collection.');
  }
}
