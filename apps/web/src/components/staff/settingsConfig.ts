import { formatStatusLabel } from '@/lib/staffUtils';

export type SettingsTab =
  | 'business'
  | 'shipping'
  | 'finance'
  | 'operations'
  | 'collections'
  | 'payments'
  | 'notifications'
  | 'security';

export type SettingField = {
  key: string;
  label: string;
  type?: 'text' | 'number' | 'textarea' | 'select' | 'list';
  min?: number;
  max?: number;
  step?: string;
  placeholder?: string;
  options?: Array<{ value: string; label: string }>;
};

export type SettingsSection = {
  id: SettingsTab;
  title: string;
  description: string;
  summary: (values: Record<string, string>) => string;
  fields: SettingField[];
  banner?: string;
};

export const SETTINGS_DEFAULTS: Record<string, string> = {
  business_name: 'AmericanHomes',
  support_phone: '+233 24 555 0198',
  support_email: 'support@americanhomes.gh',
  warehouse_address: 'Community 25, Tema, Greater Accra',
  SHIPMENT_PROVIDERS: 'Atlantic Freight & Logistics, OceanBridge Cargo, Tema Express Freight',
  BASE_CURRENCY: 'GHS',
  IMPORT_FX_USD_TO_GHS: '15.50',
  VAT_RATE_PERCENT: '0',
  TAX_INCLUSIVE_PRICING: 'true',
  RECEIPT_PREFIX: 'AH-REC',
  RECEIPT_FOOTER_NOTE:
    'Warehouse collection only. Returns eligible within 7 days of first collection.',
  CHECKOUT_HOLD_MINUTES: '15',
  PENDING_RESERVATION_HOLD_MINUTES: '120',
  APPROVED_RESERVATION_HOURS: '48',
  ALLOCATION_OFFER_HOURS: '24',
  RETURN_WINDOW_DAYS: '7',
  STOCK_ADJUSTMENT_THRESHOLD_QTY: '0',
  LOW_STOCK_ALERT_THRESHOLD: '3',
  INVENTORY_VALUATION_METHOD: 'FIFO',
  HIGH_VALUE_TRACKING_THRESHOLD_GHS: '5000',
  WAREHOUSE_PICKUP_HOURS: 'Mon–Sat, 8:30 AM – 5:30 PM',
  COLLECTION_VERIFICATION_MODE: 'OTP_OR_MANAGER',
  ALLOW_UNPAID_COLLECTION_EXCEPTION: 'MANAGER_ONLY',
  PAYMENT_EVIDENCE_POLICY: 'FLEXIBLE_ANY_CONTACT_OR_EVIDENCE',
  ACCEPTED_MANUAL_CHANNELS: 'MTN MoMo, Telecel Cash, Bank Transfer, Cash at Warehouse',
  MOMO_PAYMENT_INSTRUCTIONS: 'MTN MoMo Merchant: AmericanHomes Ltd (Ref: Order ID)',
  PAYSTACK_MODE: 'TEST',
  staff_alerts: 'enabled',
  CUSTOMER_WHATSAPP_ALERTS: 'enabled',
  CUSTOMER_EMAIL_ALERTS: 'enabled',
  NOTIFICATION_SENDER_NAME: 'AmericanHomes Ghana',
  SESSION_MAX_HOURS: '12',
  REQUIRE_MANAGER_MFA: 'enabled',
};

export const SETTINGS_SECTIONS: SettingsSection[] = [
  {
    id: 'business',
    title: 'Business profile',
    description: 'Business identity, support contacts and warehouse address.',
    summary: (v) => `${v.business_name} · ${v.warehouse_address}`,
    fields: [
      { key: 'business_name', label: 'Business name' },
      { key: 'support_phone', label: 'Support phone' },
      { key: 'support_email', label: 'Support email' },
      { key: 'warehouse_address', label: 'Warehouse address' },
    ],
  },
  {
    id: 'shipping',
    title: 'Shipping & logistics',
    description: 'Manage approved shipping providers shown on shipment manifests.',
    summary: (v) => {
      const count = v.SHIPMENT_PROVIDERS.split(',').map((s) => s.trim()).filter(Boolean).length;
      return `${count} configured provider${count === 1 ? '' : 's'}`;
    },
    fields: [
      {
        key: 'SHIPMENT_PROVIDERS',
        label: 'Approved shipping providers',
        type: 'list',
        placeholder: 'Add provider name (e.g. Atlantic Freight & Logistics)',
      },
    ],
  },
  {
    id: 'finance',
    title: 'Currency, tax & receipting',
    description: 'Base currency, import FX rate, tax rules and digital receipt format.',
    summary: (v) =>
      `${v.BASE_CURRENCY} · USD/GHS ${v.IMPORT_FX_USD_TO_GHS} · VAT ${v.VAT_RATE_PERCENT}%`,
    fields: [
      {
        key: 'BASE_CURRENCY',
        label: 'Base operating currency',
        type: 'select',
        options: [
          { value: 'GHS', label: 'GHS (Ghana Cedi)' },
          { value: 'USD', label: 'USD (US Dollar)' },
        ],
      },
      {
        key: 'IMPORT_FX_USD_TO_GHS',
        label: 'Import FX reference rate (1 USD to GHS)',
        type: 'number',
        min: 0,
        step: '0.01',
      },
      {
        key: 'VAT_RATE_PERCENT',
        label: 'VAT / tax rate (%)',
        type: 'number',
        min: 0,
        step: '0.1',
      },
      {
        key: 'TAX_INCLUSIVE_PRICING',
        label: 'Catalogue prices include tax',
        type: 'select',
        options: [
          { value: 'true', label: 'Yes (tax-inclusive)' },
          { value: 'false', label: 'No (added at checkout)' },
        ],
      },
      { key: 'RECEIPT_PREFIX', label: 'Receipt number prefix' },
      { key: 'RECEIPT_FOOTER_NOTE', label: 'Receipt footer note' },
    ],
  },
  {
    id: 'operations',
    title: 'Operational windows & inventory',
    description: 'Hold durations, return window, low-stock alerts and valuation rules.',
    summary: (v) =>
      `Checkout ${v.CHECKOUT_HOLD_MINUTES}m · Low-stock ≤ ${v.LOW_STOCK_ALERT_THRESHOLD} · ${v.INVENTORY_VALUATION_METHOD}`,
    fields: [
      { key: 'CHECKOUT_HOLD_MINUTES', label: 'Checkout stock hold (minutes)', type: 'number', min: 1 },
      {
        key: 'PENDING_RESERVATION_HOLD_MINUTES',
        label: 'Pending reservation hold (minutes)',
        type: 'number',
        min: 1,
      },
      {
        key: 'APPROVED_RESERVATION_HOURS',
        label: 'Approved reservation window (hours)',
        type: 'number',
        min: 1,
      },
      {
        key: 'ALLOCATION_OFFER_HOURS',
        label: 'Allocation offer window (hours)',
        type: 'number',
        min: 1,
      },
      {
        key: 'RETURN_WINDOW_DAYS',
        label: 'Return eligibility window (days from first collection)',
        type: 'number',
        min: 1,
      },
      {
        key: 'LOW_STOCK_ALERT_THRESHOLD',
        label: 'Low-stock reorder alert threshold (units)',
        type: 'number',
        min: 0,
      },
      {
        key: 'STOCK_ADJUSTMENT_THRESHOLD_QTY',
        label: 'Stock adjustment auto-approve max qty (0 = all require approval)',
        type: 'number',
        min: 0,
      },
      {
        key: 'INVENTORY_VALUATION_METHOD',
        label: 'Inventory cost valuation method',
        type: 'select',
        options: [
          { value: 'FIFO', label: 'FIFO (First-In, First-Out)' },
          { value: 'WEIGHTED_AVERAGE', label: 'Weighted Average Cost' },
        ],
      },
      {
        key: 'HIGH_VALUE_TRACKING_THRESHOLD_GHS',
        label: 'High-value unit serial tracking threshold (GHS)',
        type: 'number',
        min: 0,
      },
    ],
  },
  {
    id: 'collections',
    title: 'Collection & fulfilment',
    description: 'Pickup hours, third-party representative OTP & unpaid exception rules.',
    summary: (v) => v.WAREHOUSE_PICKUP_HOURS,
    fields: [
      { key: 'WAREHOUSE_PICKUP_HOURS', label: 'Warehouse collection hours' },
      {
        key: 'COLLECTION_VERIFICATION_MODE',
        label: 'Representative pickup verification (§4.6)',
        type: 'select',
        options: [
          { value: 'OTP_OR_MANAGER', label: 'Customer phone OTP OR management approval' },
          { value: 'OTP_REQUIRED', label: 'Customer phone OTP strictly required' },
        ],
      },
      {
        key: 'ALLOW_UNPAID_COLLECTION_EXCEPTION',
        label: 'Unpaid balance collection release',
        type: 'select',
        options: [
          { value: 'MANAGER_ONLY', label: 'Blocked unless management exception approved' },
          { value: 'STRICTLY_BLOCKED', label: 'Strictly blocked until paid in full' },
        ],
      },
    ],
  },
  {
    id: 'payments',
    title: 'Payment channels & policy',
    description: 'Manual payment channels, MoMo instructions and evidence policy.',
    summary: (v) =>
      `Paystack: ${formatStatusLabel(v.PAYSTACK_MODE)} · ${formatStatusLabel(v.PAYMENT_EVIDENCE_POLICY)}`,
    fields: [
      {
        key: 'PAYMENT_EVIDENCE_POLICY',
        label: 'Manual payment evidence policy (§4.4)',
        type: 'select',
        options: [
          {
            value: 'FLEXIBLE_ANY_CONTACT_OR_EVIDENCE',
            label: 'Flexible (require receipt/reference OR payer contact)',
          },
          {
            value: 'STRICT_RECEIPT_REQUIRED',
            label: 'Strict (require receipt upload and payer contact)',
          },
        ],
      },
      {
        key: 'ACCEPTED_MANUAL_CHANNELS',
        label: 'Accepted manual payment channels',
        type: 'list',
        placeholder: 'Add payment channel (e.g. MTN MoMo)',
      },
      { key: 'MOMO_PAYMENT_INSTRUCTIONS', label: 'MoMo / Bank payment instructions' },
      {
        key: 'PAYSTACK_MODE',
        label: 'Paystack gateway mode',
        type: 'select',
        options: [
          { value: 'TEST', label: 'Test / Sandbox' },
          { value: 'LIVE', label: 'Live Production' },
        ],
      },
    ],
  },
  {
    id: 'notifications',
    title: 'Notifications & channels',
    description: 'Operational alerts, customer WhatsApp/email channels and sender ID.',
    summary: (v) =>
      `Staff ${v.staff_alerts} · WhatsApp ${v.CUSTOMER_WHATSAPP_ALERTS} · Email ${v.CUSTOMER_EMAIL_ALERTS}`,
    fields: [
      {
        key: 'staff_alerts',
        label: 'Staff operational alerts',
        type: 'select',
        options: [
          { value: 'enabled', label: 'Enabled' },
          { value: 'disabled', label: 'Disabled' },
        ],
      },
      {
        key: 'CUSTOMER_WHATSAPP_ALERTS',
        label: 'Customer WhatsApp notifications',
        type: 'select',
        options: [
          { value: 'enabled', label: 'Enabled' },
          { value: 'disabled', label: 'Disabled' },
        ],
      },
      {
        key: 'CUSTOMER_EMAIL_ALERTS',
        label: 'Customer email notifications',
        type: 'select',
        options: [
          { value: 'enabled', label: 'Enabled' },
          { value: 'disabled', label: 'Disabled' },
        ],
      },
      { key: 'NOTIFICATION_SENDER_NAME', label: 'Notification sender name' },
    ],
  },
  {
    id: 'security',
    title: 'Security & governance',
    description: 'Staff session lifetime, MFA enforcement and self-approval prohibition.',
    summary: (v) => `Max session: ${v.SESSION_MAX_HOURS}h · Manager MFA: ${v.REQUIRE_MANAGER_MFA}`,
    fields: [
      {
        key: 'SESSION_MAX_HOURS',
        label: 'Max staff session duration (hours, §4.1.5)',
        type: 'number',
        min: 1,
        max: 24,
      },
      {
        key: 'REQUIRE_MANAGER_MFA',
        label: 'Require MFA for Owner & Manager accounts (§4.1.2)',
        type: 'select',
        options: [
          { value: 'enabled', label: 'Enabled (enforced)' },
          { value: 'optional', label: 'Optional (dev/testing only)' },
        ],
      },
    ],
    banner:
      'Self-approval is permanently prohibited for non-owner staff across approvals and adjustments (§4.1.6).',
  },
];
