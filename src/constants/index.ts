export const Roles = {
  DELIVERY_AGENT: 'DELIVERY_AGENT',
  BRANCH_STAFF: 'BRANCH_STAFF',
  HUB_OPERATOR: 'HUB_OPERATOR',
  FINANCE_OFFICER: 'FINANCE_OFFICER',
  SELLER: 'SELLER',
  ADMIN: 'ADMIN',
} as const;

export type RoleType = typeof Roles[keyof typeof Roles];

export const ParcelState = {
  CREATED: 'CREATED',
  COD_COLLECTED: 'COD_COLLECTED',
  HANDOVER_TO_DEST_HUB: 'HANDOVER_TO_DEST_HUB',
  HANDOVER_TO_ORIGIN_HUB: 'HANDOVER_TO_ORIGIN_HUB',
  HANDOVER_TO_ORIGIN_BRANCH: 'HANDOVER_TO_ORIGIN_BRANCH',
  SETTLED_TO_SELLER: 'SETTLED_TO_SELLER',
  DISCREPANCY_FLAGGED: 'DISCREPANCY_FLAGGED',
} as const;

export type ParcelStateType = typeof ParcelState[keyof typeof ParcelState];

export const NotificationTemplates = {
  PARCEL_CREATED: 'PARCEL_CREATED',
  OUT_FOR_DELIVERY: 'OUT_FOR_DELIVERY',
  COD_COLLECTED: 'COD_COLLECTED',
  SELLER_PAID: 'SELLER_PAID',
} as const;

export type NotificationTemplateType = typeof NotificationTemplates[keyof typeof NotificationTemplates];
