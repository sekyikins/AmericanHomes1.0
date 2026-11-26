export type PermissionDef = { code: string; label: string };
export type PermissionModuleDef = { module: string; permissions: PermissionDef[] };

export const PERMISSION_MODULES: PermissionModuleDef[] = [
  {
    module: 'Shipments & Receiving',
    permissions: [
      { code: 'shipments.view', label: 'View shipments' },
      { code: 'shipments.create', label: 'Create shipments' },
      { code: 'shipments.update', label: 'Edit shipments, manifests & tracking' },
      { code: 'shipments.close', label: 'Close shipments' },
      { code: 'suppliers.view', label: 'View overseas suppliers' },
      { code: 'suppliers.manage', label: 'Manage suppliers & freeze landed costs' },
      { code: 'receiving.view', label: 'View receiving sessions' },
      { code: 'receiving.create', label: 'Start receiving & record lines' },
      { code: 'receiving.resolve_discrepancy', label: 'Resolve discrepancies' },
    ],
  },
  {
    module: 'Catalogue & Preparation',
    permissions: [
      { code: 'catalogue.view', label: 'View catalogue' },
      { code: 'catalogue.create', label: 'Create products & variants' },
      { code: 'catalogue.update', label: 'Edit products & preparation steps' },
      { code: 'catalogue.approve_price', label: 'Approve pricing' },
      { code: 'catalogue.publish', label: 'Publish & unpublish products' },
    ],
  },
  {
    module: 'Inventory & Stocktakes',
    permissions: [
      { code: 'inventory.view', label: 'View inventory & movements' },
      { code: 'inventory.adjust', label: 'Request stock adjustments' },
      { code: 'inventory.approve_adjustment', label: 'Approve stock adjustments' },
      { code: 'stocktakes.view', label: 'View stocktakes' },
      { code: 'stocktakes.manage', label: 'Create & count stocktakes' },
      { code: 'stocktakes.approve', label: 'Approve stocktakes' },
    ],
  },
  {
    module: 'Orders, Reservations & Collections',
    permissions: [
      { code: 'orders.view', label: 'View orders' },
      { code: 'orders.create_walk_in', label: 'Create walk-in orders' },
      { code: 'orders.approve', label: 'Approve orders' },
      { code: 'orders.cancel', label: 'Cancel orders' },
      { code: 'quotes.view', label: 'View quotations' },
      { code: 'quotes.manage', label: 'Create & convert quotations' },
      { code: 'service_tickets.view', label: 'View warranty & service tickets' },
      { code: 'service_tickets.manage', label: 'Manage warranty & service tickets' },
      { code: 'reservations.view', label: 'View reservations' },
      { code: 'reservations.approve', label: 'Approve & decline reservations' },
      { code: 'collections.view', label: 'View collections' },
      { code: 'collections.manage', label: 'Record item collections' },
      { code: 'returns.view', label: 'View return requests' },
      { code: 'returns.review', label: 'Review return requests' },
      { code: 'returns.approve', label: 'Approve return requests' },
    ],
  },
  {
    module: 'Payments & Expenses',
    permissions: [
      { code: 'payments.view', label: 'View payments' },
      { code: 'payments.record_manual', label: 'Record manual payments' },
      { code: 'payments.approve_manual', label: 'Approve manual payments' },
      { code: 'payments.refund', label: 'Process refunds & reversals' },
      { code: 'tax.view', label: 'View GRA E-VAT tax invoices & credit notes' },
      { code: 'tax.manage', label: 'Issue & retry GRA E-VAT tax invoices' },
      { code: 'shifts.view', label: 'View cashier till shifts' },
      { code: 'shifts.manage', label: 'Open & blind-close cashier till shifts' },
      { code: 'expenses.view', label: 'View expenses' },
      { code: 'expenses.create', label: 'Record expenses' },
      { code: 'expenses.manage', label: 'Edit & manage expenses' },
    ],
  },
  {
    module: 'Requests & Sourcing',
    permissions: [
      { code: 'product_requests.view', label: 'View product requests' },
      { code: 'product_requests.review', label: 'Review product requests & polls' },
      { code: 'sourcing.view', label: 'View sourcing batches' },
      { code: 'sourcing.manage', label: 'Manage sourcing & confirmations' },
      { code: 'allocations.view', label: 'View allocations' },
      { code: 'allocations.manage', label: 'Assign & manage allocations' },
    ],
  },
  {
    module: 'Customers, Reports & Governance',
    permissions: [
      { code: 'customers.view', label: 'View customers' },
      { code: 'reports.view', label: 'View reports' },
      { code: 'reports.export', label: 'Export reports' },
      { code: 'staff.view', label: 'View staff accounts' },
      { code: 'staff.create', label: 'Create staff accounts' },
      { code: 'staff.update', label: 'Edit staff profiles & status' },
      { code: 'staff.deactivate', label: 'Deactivate staff accounts' },
      { code: 'permissions.view', label: 'View permission groups' },
      { code: 'permissions.manage', label: 'Manage permission groups' },
      { code: 'announcements.view', label: 'View announcements' },
      { code: 'announcements.manage', label: 'Create & publish announcements' },
      { code: 'incidents.view', label: 'View operational incidents' },
      { code: 'incidents.manage', label: 'Report & resolve incidents' },
      { code: 'audit.view', label: 'View audit logs' },
      { code: 'staff_reports.view', label: 'View staff reports' },
      { code: 'staff_reports.manage', label: 'Act on staff reports (address / decline)' },
    ],
  },
];

export const KNOWN_PERMISSION_CODES = new Set(
  PERMISSION_MODULES.flatMap((m) => m.permissions.map((p) => p.code)),
);

const IMPLIED_BY: Record<string, string[]> = {
  'shipments.create': ['shipments.manage'],
  'shipments.update': ['shipments.manage'],
  'shipments.close': ['shipments.manage'],
  'receiving.create': ['receiving.manage'],
  'catalogue.create': ['catalogue.manage'],
  'catalogue.update': ['catalogue.manage'],
  'stocktakes.view': ['stocktakes.manage', 'inventory.view'],
  'collections.view': ['collections.manage'],
  'returns.view': ['returns.review', 'returns.approve'],
  'expenses.create': ['expenses.manage'],
  'sourcing.view': ['sourcing.manage'],
  'allocations.view': ['allocations.manage'],
  'orders.cancel': ['orders.approve'],
  'staff.create': ['staff.manage'],
  'staff.update': ['staff.manage'],
  'staff.deactivate': ['staff.manage'],
  'permissions.view': ['permissions.manage'],
  'announcements.view': ['announcements.manage', 'catalogue.view'],
  'announcements.manage': ['catalogue.publish'],
  'incidents.view': ['incidents.manage', 'inventory.view'],
  'incidents.manage': ['inventory.approve_adjustment'],
  'staff_reports.view': ['staff_reports.manage'],
  'tax.view': ['tax.manage', 'payments.view'],
  'tax.manage': ['payments.approve_manual'],
  'quotes.view': ['quotes.manage', 'orders.view'],
  'quotes.manage': ['orders.create_walk_in'],
  'shifts.view': ['shifts.manage', 'payments.view'],
  'shifts.manage': ['payments.record_manual'],
  'service_tickets.view': ['service_tickets.manage', 'orders.view'],
  'service_tickets.manage': ['returns.review'],
  'suppliers.view': ['suppliers.manage', 'shipments.view'],
  'suppliers.manage': ['shipments.create', 'shipments.manage'],
};

export function hasStaffPermission(
  user: { isOwner?: boolean; permissions?: string[] } | null | undefined,
  code?: string,
): boolean {
  if (!user) return false;
  if (user.isOwner) return true;
  if (!code) return true;
  const perms = user.permissions ?? [];
  if (perms.includes(code)) return true;
  const implied = IMPLIED_BY[code] ?? [];
  return implied.some((p) => perms.includes(p));
}
