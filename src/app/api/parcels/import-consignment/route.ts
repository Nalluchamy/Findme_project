import { NextRequest } from 'next/server';
import { requireAuth, successResponse, errorResponse } from '@/lib/api';
import { ParcelRepository } from '@/repositories/parcel.repository';
import { NotificationService } from '@/services/notification.service';
import { db } from '@/lib/db';
import { ParcelState } from '@/constants';

export async function POST(req: NextRequest) {
  const { authorized, errorResponse: authError, session } = requireAuth(req, ['BRANCH_STAFF', 'ADMIN']);
  if (!authorized || !session) return authError!;

  try {
    const {
      trackingNumber,
      carrier,
      sellerId,
      codAmount,
      originLocationId,
      destinationLocationId,
      photoUrl,
    } = await req.json();

    if (!trackingNumber || !carrier || !sellerId || !codAmount || !originLocationId || !destinationLocationId) {
      return errorResponse('INVALID_INPUT', 'All fields are required.');
    }

    const parcelRepo = new ParcelRepository(session);
    const notificationService = new NotificationService(session);

    // 1. Uniqueness check within carrier/tenant
    const existing = await db.parcel.findFirst({
      where: {
        trackingNumber,
        carrier,
        companyId: session.companyId,
      },
    });

    if (existing) {
      return errorResponse('DUPLICATE_PARCEL', 'This tracking number has already been imported for your carrier.');
    }

    const parcelId = `${carrier}_${trackingNumber}`;

    const newParcel = await db.$transaction(async (tx: any) => {
      // 2. Create Parcel
      const parcel = await tx.parcel.create({
        data: {
          id: parcelId,
          trackingNumber,
          carrier,
          sellerId,
          codAmount: parseFloat(codAmount),
          originLocationId,
          destinationLocationId,
          currentState: ParcelState.CREATED,
          companyId: session.companyId,
        },
      });

      // 3. Create Receipt photo entry if supplied
      if (photoUrl) {
        await tx.receipt.create({
          data: {
            parcelId: parcel.id,
            photoUrl,
            uploadedBy: session.id,
            deviceType: 'WEB_MOBILE_CAM',
          },
        });
      }

      // 4. Create Ledger Audit trace
      await tx.ledgerEvent.create({
        data: {
          parcelId: parcel.id,
          eventType: 'COD_COLLECTED', // Using COD_COLLECTED to track creation/booking handover internally for the MVP state
          fromPartyId: session.id,
          expectedAmount: parseFloat(codAmount),
          confirmedAmount: parseFloat(codAmount),
          confirmedByFrom: true,
          confirmedByTo: true,
          discrepancyNote: `Receipt Scan Import by ${session.name}. Carrier: ${carrier}`,
        },
      });

      return parcel;
    });

    // 5. Trigger WhatsApp updates
    await notificationService.sendAlert(
      '9876543210',
      'PARCEL_CREATED',
      parcelId,
      { codAmount: codAmount.toString() }
    );

    return successResponse(newParcel, 'Consignment imported successfully.');
  } catch (error: any) {
    console.error('Import consignment API error:', error);
    return errorResponse('INTERNAL_ERROR', 'A server error occurred during import.');
  }
}
