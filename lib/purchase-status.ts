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
