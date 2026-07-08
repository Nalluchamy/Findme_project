import { RoleType } from '../constants';

export interface UserSession {
  id: string;
  username: string;
  name: string;
  role: RoleType;
  locationId: string | null;
  companyId: string | null;
}

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
}

export interface ImportRow {
  id: string;
  codAmount: number;
  originLocationName: string;
  destinationLocationName: string;
  sellerUsername: string;
}

export interface ImportReport {
  imported: number;
  skipped: number;
  errors: {
    row: number;
    parcelId?: string;
    reason: string;
  }[];
}
