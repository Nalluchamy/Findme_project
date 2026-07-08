import { db } from '@/lib/db';
import { BaseRepository } from './base.repository';

export class UserRepository extends BaseRepository {
  async findByUsername(username: string) {
    return db.user.findFirst({
      where: this.getTenantFilter({ username }),
    });
  }

  async count(where: Record<string, any> = {}) {
    return db.user.count({
      where: this.getTenantFilter(where),
    });
  }

  async findMany(where: Record<string, any> = {}) {
    return db.user.findMany({
      where: this.getTenantFilter(where),
      select: {
        id: true,
        username: true,
        name: true,
        role: true,
        locationId: true,
      },
      orderBy: { name: 'asc' },
    });
  }
}
