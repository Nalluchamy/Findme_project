import { UserSession } from '@/types';

export class BaseRepository {
  protected session: UserSession;

  constructor(session: UserSession) {
    this.session = session;
  }

  // Enforces companyId constraints automatically on database query arguments
  protected getTenantFilter<T extends Record<string, any>>(where: T = {} as T): T & { companyId?: string } {
    if (this.session.companyId) {
      return {
        ...where,
        companyId: this.session.companyId,
      };
    }
    return where;
  }
}
