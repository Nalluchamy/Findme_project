import { db } from '@/lib/db';
import { BaseRepository } from './base.repository';

export class LocationRepository extends BaseRepository {
  async findByName(name: string) {
    return db.location.findFirst({
      where: this.getTenantFilter({
        name: { contains: name, mode: 'insensitive' },
      }),
    });
  }

  async findMany(where: Record<string, any> = {}) {
    return db.location.findMany({
      where: this.getTenantFilter(where),
      orderBy: { name: 'asc' },
    });
  }
}
