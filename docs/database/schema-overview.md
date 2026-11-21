# Database Schema Overview

Canonical schema lives at `prisma/schema.prisma`.

| Domain | Models |
| :--- | :--- |
| Identity & Access | `User`, `CustomerProfile`, `StaffProfile`, `PermissionGroup`, `Permission`, `GroupPermission`, `StaffGroupAssignment` |
| Shipments | `Shipment`, `ManifestRevision`, `ManifestItem`, `ShipmentTrackingEvent`, `ShipmentExpense` |
| Receiving | `ReceivingSession`, `ReceiptLine`, `Discrepancy`, `DiscrepancyResolution` |
| Catalogue & Ops | `Product`, `ProductVariant`, `ProductAttribute`, `ProductVariantAttribute`, `ProductMedia`, `PricingApproval` |
| Inventory | `StockLot`, `InventoryMovement`, `StockHold`, `StockHoldLine`, `Stocktake`, `StocktakeLine`, `AdjustmentProposal` |
| Requests & Sourcing | `ProductRequest`, `RequestGroup`, `RequestGroupMembership`, `ShipmentSourcingItem`, `AllocationOffer` |
| Reservations | `Reservation` |
| Orders | `SalesOrder`, `OrderLine` |
| Payments & Finance | `Payment`, `PaymentAttempt`, `Refund`, `GeneralExpense` |
| Collections & Returns | `CollectionRecord`, `CollectionLine`, `ReturnRequest`, `ReturnLine` |
| Notifications | `NotificationMessage`, `OutboxEvent` |
| Audit & Reporting | `ExportJob`, `AuditEvent`, `OperationalIncident` |
