export type NotificationType =
  | 'ORDER_UPDATE'
  | 'RESERVATION_UPDATE'
  | 'PAYMENT_CONFIRMED'
  | 'PRODUCT_AVAILABLE'
  | 'SYSTEM';

export type NotificationMessage = {
  id: string;
  userId: string;
  title: string;
  body: string;
  type: NotificationType;
  referenceId?: string;
  isRead: boolean;
  createdAt: string;
};
