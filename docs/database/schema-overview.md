# Database Schema Overview

Canonical schema lives at `prisma/schema.prisma`.

| Domain | Models |
| :--- | :--- |
| Identity & Access | `User`, `CustomerProfile`, `StaffProfile`, `PermissionGroup`, `Permission`, `GroupPermission`, `StaffGroupAssignment` |
| Shipments | `Shipment`, `ManifestRevision`, `ManifestItem`, `ShipmentTrackingEvent`, `ShipmentExpense` |
| Receiving | `ReceivingSession`, `ReceiptLine`, `Discrepancy`, `DiscrepancyResolution` |
| Catalogue & Ops | `Product`, `ProductPreparationRecord` (`INSPECTION`, `CLEANING`, `PHOTOGRAPHY`, `WRAPPING`, `PRICING`, `FINAL_REVIEW`), `ProductVariant`, `ProductAttribute`, `ProductVariantAttribute`, `ProductMedia` (`position: 0` = product face), `PricingApproval` |
| Inventory | `StockLot` (`quantity`, `available`, `held`, `unavailable`), `TrackedUnit`, `InventoryMovement`, `StockHold`, `StockHoldLine`, `Stocktake`, `StocktakeLine`, `AdjustmentProposal` |
| Requests, Sourcing & Polls | `ProductRequest`, `RequestGroup`, `RequestGroupMembership`, `ShipmentSourcingItem`, `AllocationOffer`, `ProductPoll`, `PollVote` |
| Reservations & Checkout | `Reservation`, `CheckoutSession` |
| Orders | `SalesOrder` (`orderStatus`, `paymentStatus`, `fulfilmentStatus`), `OrderLine` |
| Payments & Finance | `Payment`, `PaymentAttempt`, `Refund`, `GeneralExpense` |
| Collections & Returns | `CollectionRecord`, `CollectionLine`, `ReturnRequest`, `ReturnLine`, `StoreCreditEntry` |
| Notifications & Consent | `NotificationMessage`, `NotificationPreference`, `NotificationDeliveryAttempt`, `ConsentEvent`, `OutboxEvent` |
| Governance, Audit & Reporting | `ExportJob`, `AuditEvent` (append-only), `OperationalIncident`, `Announcement`, `StaffReport`, `SystemSetting` (operational rules & `WISHLIST:<userId>` persistence) |
