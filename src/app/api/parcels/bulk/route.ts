import { NextRequest } from 'next/server';
import { requireAuth, successResponse, errorResponse } from '@/lib/api';
import { ImportService } from '@/services/import.service';

export async function POST(req: NextRequest) {
  const { authorized, errorResponse: authError, session } = requireAuth(req, ['ADMIN', 'SELLER']);
  if (!authorized || !session) return authError!;

  try {
    const { action, data } = await req.json();

    if (!action || !Array.isArray(data)) {
      return errorResponse('INVALID_INPUT', 'Required fields: action ("validate" | "import") and data array.');
    }

    const importService = new ImportService(session);

    if (action === 'validate') {
      const report = await importService.validateCSV(data);
      return successResponse(report, 'CSV data validated successfully.');
    } else if (action === 'import') {
      const report = await importService.executeImport(data);
      return successResponse(report, `${report.imported} parcels imported successfully.`);
    } else {
      return errorResponse('INVALID_ACTION', 'Allowed actions: "validate", "import".');
    }
  } catch (error: any) {
    console.error('Bulk API Error:', error);
    return errorResponse('INTERNAL_ERROR', 'A server error occurred during CSV parsing.');
  }
}
