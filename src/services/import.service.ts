import { ParcelRepository } from '@/repositories/parcel.repository';
import { LocationRepository } from '@/repositories/location.repository';
import { UserRepository } from '@/repositories/user.repository';
import { UserSession, ImportRow, ImportReport } from '@/types';
import { ParcelState } from '@/constants';

export class ImportService {
  private session: UserSession;
  private parcelRepo: ParcelRepository;
  private locationRepo: LocationRepository;
  private userRepo: UserRepository;

  constructor(session: UserSession) {
    this.session = session;
    this.parcelRepo = new ParcelRepository(session);
    this.locationRepo = new LocationRepository(session);
    this.userRepo = new UserRepository(session);
  }

  // Performs validations without writing to the database
  async validateCSV(rows: ImportRow[]): Promise<ImportReport> {
    const report: ImportReport = {
      imported: 0,
      skipped: 0,
      errors: [],
    };

    const seenIds = new Set<string>();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      const rowNum = idx + 1;

      // 1. Validation for empty values
      if (!row.id || !row.codAmount || !row.originLocationName || !row.destinationLocationName || !row.sellerUsername) {
        report.skipped += 1;
        report.errors.push({ row: rowNum, reason: 'Row contains missing fields.' });
        continue;
      }

      // 2. Validate duplicates inside the uploaded file itself
      if (seenIds.has(row.id)) {
        report.skipped += 1;
        report.errors.push({ row: rowNum, parcelId: row.id, reason: 'Duplicate Parcel ID found within the uploaded file.' });
        continue;
      }
      seenIds.add(row.id);

      // 3. Validate duplicate ID in DB
      const existing = await this.parcelRepo.findById(row.id);
      if (existing) {
        report.skipped += 1;
        report.errors.push({ row: rowNum, parcelId: row.id, reason: 'Parcel ID already exists in the database.' });
        continue;
      }

      // 4. Validate matching locations in DB
      const origin = await this.locationRepo.findByName(row.originLocationName);
      if (!origin) {
        report.skipped += 1;
        report.errors.push({ row: rowNum, parcelId: row.id, reason: `Unknown origin branch/hub: "${row.originLocationName}".` });
        continue;
      }

      const dest = await this.locationRepo.findByName(row.destinationLocationName);
      if (!dest) {
        report.skipped += 1;
        report.errors.push({ row: rowNum, parcelId: row.id, reason: `Unknown destination branch/hub: "${row.destinationLocationName}".` });
        continue;
      }

      // 5. Validate Seller username in DB
      const seller = await this.userRepo.findByUsername(row.sellerUsername);
      if (!seller || seller.role !== 'SELLER') {
        report.skipped += 1;
        report.errors.push({ row: rowNum, parcelId: row.id, reason: `Invalid seller username: "${row.sellerUsername}".` });
        continue;
      }

      report.imported += 1;
    }

    return report;
  }

  // Executes the actual database creation batch for validated lines
  async executeImport(rows: ImportRow[]): Promise<ImportReport> {
    const validation = await this.validateCSV(rows);
    
    // Filter out invalid rows to insert only the verified subset
    const validRowsToInsert: any[] = [];
    const seenIds = new Set<string>();

    for (let idx = 0; idx < rows.length; idx++) {
      const row = rows[idx];
      if (seenIds.has(row.id)) continue;

      const existing = await this.parcelRepo.findById(row.id);
      if (existing) continue;

      const origin = await this.locationRepo.findByName(row.originLocationName);
      const dest = await this.locationRepo.findByName(row.destinationLocationName);
      const seller = await this.userRepo.findByUsername(row.sellerUsername);

      if (origin && dest && seller && seller.role === 'SELLER') {
        seenIds.add(row.id);
        validRowsToInsert.push({
          id: row.id,
          sellerId: seller.id,
          codAmount: row.codAmount,
          originLocationId: origin.id,
          destinationLocationId: dest.id,
          currentState: ParcelState.CREATED,
        });
      }
    }

    if (validRowsToInsert.length > 0) {
      await this.parcelRepo.createMany(validRowsToInsert);
    }

    return validation;
  }
}
