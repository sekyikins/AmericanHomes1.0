'use client';

import { AlertTriangle, ArrowRight, Clock, Truck, XCircle } from 'lucide-react';
import Link from 'next/link';
import { formatGhs } from '@/lib/staffUtils';

type ActiveShipmentSummary = {
  id: string;
  reference: string;
  providerName: string;
  status: string;
  departureDate: string | null;
  estimatedArrival: string | null;
  manifestCount: number;
  receivedCount: number;
  discrepancyCount: number;
};

type OperationalAlertsSummary = {
  unexpectedHeldCount: number;
  expiringReservationsCount: number;
  expiringReservationsValueCents: number;
  failedInspectionCount: number;
  failedEvatCount?: number;
};

export function DashboardBottomGrid({
  activeShipment,
  operationalAlerts,
}: {
  activeShipment?: ActiveShipmentSummary | null;
  operationalAlerts?: OperationalAlertsSummary;
}) {
  return (
    <div className="dash-grid" style={{ marginTop: 18 }}>
      <section className="acct-panel">
        {activeShipment ? (
          <>
            <div className="acct-panel-head">
              <div>
                <h2>Active shipment</h2>
                <p>{activeShipment.reference}</p>
              </div>
              <span className="acct-pill blue">
                ● {activeShipment.status.replace(/_/g, ' ')}
              </span>
            </div>

            <div className="dash-route">
              <div>
                <strong>{activeShipment.providerName}</strong>
                <span>
                  {activeShipment.departureDate
                    ? `Departed ${new Date(activeShipment.departureDate).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}`
                    : 'Shipping provider'}
                </span>
              </div>
              <div className="dash-route-line">
                <span className="dash-route-truck">
                  <Truck size={15} color="var(--green)" />
                </span>
                <div className="dash-route-bar">
                  <div
                    className="dash-route-fill"
                    style={{
                      width: `${
                        activeShipment.manifestCount > 0
                          ? Math.min(
                              100,
                              Math.round(
                                (activeShipment.receivedCount / activeShipment.manifestCount) * 100,
                              ),
                            )
                          : 50
                      }%`,
                    }}
                  />
                </div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <strong>Tema, Ghana</strong>
                <span>
                  {activeShipment.estimatedArrival
                    ? `ETA ${new Date(activeShipment.estimatedArrival).toLocaleDateString('en-GH', { day: 'numeric', month: 'short' })}`
                    : 'Warehouse'}
                </span>
              </div>
            </div>

            <div className="dash-ship-stats">
              <div>
                <strong>{activeShipment.manifestCount}</strong>
                <span>Manifest items</span>
              </div>
              <div>
                <strong>{activeShipment.receivedCount}</strong>
                <span>Received</span>
              </div>
              <div>
                <strong>{activeShipment.discrepancyCount}</strong>
                <span>Discrepancies</span>
              </div>
            </div>

            <Link
              href={`/staff/receiving?shipmentId=${activeShipment.id}`}
              className="button"
              style={{ width: '100%', minHeight: 42, marginTop: 18, background: '#fff' }}
            >
              <span>Continue receiving</span>
              <ArrowRight size={14} />
            </Link>
          </>
        ) : (
          <>
            <div className="acct-panel-head">
              <div>
                <h2>Active shipment</h2>
                <p>No active shipments in transit or receiving</p>
              </div>
            </div>
            <Link
              href="/staff/shipments"
              className="button"
              style={{ width: '100%', minHeight: 42, marginTop: 18, background: '#fff' }}
            >
              <span>View all shipments</span>
              <ArrowRight size={14} />
            </Link>
          </>
        )}
      </section>

      <section className="acct-panel">
        <div className="acct-panel-head">
          <div>
            <h2>Operational alerts</h2>
            <p>Exceptions requiring attention</p>
          </div>
        </div>

        {(operationalAlerts?.unexpectedHeldCount ?? 0) === 0 &&
        (operationalAlerts?.expiringReservationsCount ?? 0) === 0 &&
        (operationalAlerts?.failedInspectionCount ?? 0) === 0 &&
        (operationalAlerts?.failedEvatCount ?? 0) === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: 13, margin: '24px 0 8px' }}>
            No operational exceptions requiring attention.
          </p>
        ) : (
          <div className="dash-queue">
            {(operationalAlerts?.unexpectedHeldCount ?? 0) > 0 && (
              <Link href="/staff/receiving" className="dash-alert-row">
                <span className="dash-queue-icon amber">
                  <AlertTriangle size={14} />
                </span>
                <div>
                  <strong>{operationalAlerts?.unexpectedHeldCount} unexpected goods held</strong>
                  <span>Management review required</span>
                </div>
              </Link>
            )}

            {(operationalAlerts?.expiringReservationsCount ?? 0) > 0 && (
              <Link href="/staff/reservations" className="dash-alert-row">
                <span className="dash-queue-icon amber">
                  <Clock size={14} />
                </span>
                <div>
                  <strong>
                    {operationalAlerts?.expiringReservationsCount} reservations expire today
                  </strong>
                  <span>
                    {formatGhs(operationalAlerts?.expiringReservationsValueCents ?? 0)} in held
                    stock
                  </span>
                </div>
              </Link>
            )}

            {(operationalAlerts?.failedInspectionCount ?? 0) > 0 && (
              <Link href="/staff/preparation" className="dash-alert-row">
                <span className="dash-queue-icon red">
                  <XCircle size={14} />
                </span>
                <div>
                  <strong>
                    {operationalAlerts?.failedInspectionCount} lots with unavailable stock
                  </strong>
                  <span>Disposition &amp; inspection review</span>
                </div>
              </Link>
            )}

            {(operationalAlerts?.failedEvatCount ?? 0) > 0 && (
              <Link href="/staff/tax-invoices" className="dash-alert-row">
                <span className="dash-queue-icon red">
                  <AlertTriangle size={14} />
                </span>
                <div>
                  <strong>
                    {operationalAlerts?.failedEvatCount} failed GRA E-VAT{' '}
                    {operationalAlerts?.failedEvatCount === 1 ? 'submission' : 'submissions'}
                  </strong>
                  <span>Retry fiscal transmission in Tax Invoices</span>
                </div>
              </Link>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
