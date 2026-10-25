// Values match the PurchaseStatus enum in prisma/schema.prisma
export const PURCHASE_STATUS_VALUES = [
  "PENDING_PURCHASE",
  "PAID",
  "IN_DELIVERY",
  "RECEIVED",
  "COMPLETED",
] as const;

export type PurchaseStatusValue = (typeof PURCHASE_STATUS_VALUES)[number];

export const PURCHASE_STATUS_LABELS: Record<PurchaseStatusValue, string> = {
  PENDING_PURCHASE: "Pending purchase",
  PAID: "Paid",
  IN_DELIVERY: "In delivery",
  RECEIVED: "Received",
  COMPLETED: "Completed",
};

// Why units of a purchase are out of service (matches UnavailableReason in schema.prisma)
export const UNAVAILABLE_REASON_VALUES = ["MAINTENANCE", "DEPRECATED"] as const;

export type UnavailableReasonValue = (typeof UNAVAILABLE_REASON_VALUES)[number];

export const UNAVAILABLE_REASON_LABELS: Record<UnavailableReasonValue, string> = {
  MAINTENANCE: "In maintenance",
  DEPRECATED: "Deprecated / retired",
};
