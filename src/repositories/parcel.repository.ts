import { db } from '@/lib/db';
import { BaseRepository } from './base.repository';
import { ParcelStateType } from '@/constants';

export class ParcelRepository extends BaseRepository {
  async findById(id: string) {
    return db.parcel.findFirst({
      where: this.getTenantFilter({ id }),
      include: {
        originLocation: true,
        destinationLocation: true,
        ledgerEvents: {
          orderBy: { timestamp: 'desc' },
          include: { fromParty: true, toParty: true },
        },
      },
    });
  }

  async findMany(where: Record<string, any>, skip: number, take: number) {
    const filter = this.getTenantFilter(where);
    return db.parcel.findMany({
      where: filter,
      skip,
      take,
      include: {
        originLocation: true,
        destinationLocation: true,
        ledgerEvents: {
          orderBy: { timestamp: 'desc' },
          include: { fromParty: true, toParty: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(where: Record<string, any>) {
    return db.parcel.count({
      where: this.getTenantFilter(where),
    });
  }

  async create(data: {
    id: string;
    sellerId: string;
    codAmount: number;
    originLocationId: string;
    destinationLocationId: string;
    currentState: ParcelStateType;
  }) {
    return db.parcel.create({
      data: {
        ...data,
        companyId: this.session.companyId,
      },
    });
  }

  async createMany(parcels: any[]) {
    // Inserts list in a transactional batch mapping to tenant ID
    return db.$transaction(
      parcels.map(p =>
        db.parcel.create({
          data: {
            ...p,
            companyId: this.session.companyId,
          },
        })
      )
    );
  }

  async updateState(id: string, newState: ParcelStateType) {
    const target = await this.findById(id);
    if (!target) throw new Error('Parcel not found or access denied');
    
    return db.parcel.update({
      where: { id },
      data: { currentState: newState },
    });
  }
}
