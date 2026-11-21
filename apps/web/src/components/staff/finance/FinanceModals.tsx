'use client';

import { REPORT_TYPES } from '@/components/staff/finance/FinancePanels';
import { StaffModal } from '@/components/staff/StaffModal';
import { Button } from '@/components/ui';
import { ArrowRight } from 'lucide-react';
import type { FormEvent } from 'react';

type ExportModalProps = {
  open: boolean;
  onClose: () => void;
  exportType: string;
  setExportType: (v: string) => void;
  exportFormat: 'CSV' | 'XLSX' | 'PDF';
  setExportFormat: (v: 'CSV' | 'XLSX' | 'PDF') => void;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
};

export function FinanceExportModal({
  open,
  onClose,
  exportType,
  setExportType,
  exportFormat,
  setExportFormat,
  submitting,
  onSubmit,
}: ExportModalProps) {
  return (
    <StaffModal open={open} label="Export report" onClose={onClose}>
      <div className="ship-eyebrow">EXPORT</div>
      <h2 style={{ marginTop: 6 }}>Generate report export</h2>
      <form onSubmit={onSubmit}>
        <label className="login-field">
          <span>Report type</span>
          <select
            className="staff-field-select"
            value={exportType}
            onChange={(e) => setExportType(e.target.value)}
          >
            {REPORT_TYPES.map((r) => (
              <option key={r.id} value={r.id}>
                {r.title}
              </option>
            ))}
          </select>
        </label>

        <div className="login-field">
          <span>Format</span>
          <div style={{ display: 'flex', gap: 8 }}>
            {(['CSV', 'XLSX', 'PDF'] as const).map((fmtOpt) => (
              <button
                key={fmtOpt}
                type="button"
                className={`fin-format-btn${exportFormat === fmtOpt ? ' active' : ''}`}
                onClick={() => setExportFormat(fmtOpt)}
              >
                {fmtOpt}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
          <Button type="submit" variant="primary" loading={submitting} loadingText="Generating…">
            <span>Download export</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}

type ExpenseModalProps = {
  open: boolean;
  onClose: () => void;
  expCategory: string;
  setExpCategory: (v: string) => void;
  expAmount: string;
  setExpAmount: (v: string) => void;
  expDesc: string;
  setExpDesc: (v: string) => void;
  expDate: string;
  setExpDate: (v: string) => void;
  submitting: boolean;
  onSubmit: (e: FormEvent) => void;
};

export function FinanceExpenseModal({
  open,
  onClose,
  expCategory,
  setExpCategory,
  expAmount,
  setExpAmount,
  expDesc,
  setExpDesc,
  expDate,
  setExpDate,
  submitting,
  onSubmit,
}: ExpenseModalProps) {
  return (
    <StaffModal open={open} label="Record expense" onClose={onClose}>
      <div className="ship-eyebrow">EXPENSES</div>
      <h2 style={{ marginTop: 6 }}>Record expense</h2>
      <form onSubmit={onSubmit}>
        <div className="req-row-2">
          <label className="login-field">
            <span>Category</span>
            <select
              className="staff-field-select"
              value={expCategory}
              onChange={(e) => setExpCategory(e.target.value)}
            >
              <option value="Customs">Customs</option>
              <option value="Freight">Freight</option>
              <option value="Salaries">Salaries</option>
              <option value="Packaging">Packaging</option>
              <option value="Utilities">Utilities</option>
              <option value="Other">Other</option>
            </select>
          </label>
          <label className="login-field">
            <span>Amount (GHS)</span>
            <input
              type="number"
              step="0.01"
              min={0.01}
              required
              value={expAmount}
              onChange={(e) => setExpAmount(e.target.value)}
              placeholder="500.00"
            />
          </label>
        </div>
        <label className="login-field">
          <span>Description</span>
          <input
            required
            value={expDesc}
            onChange={(e) => setExpDesc(e.target.value)}
            placeholder="e.g. Tema Port haulage"
          />
        </label>
        <label className="login-field">
          <span>Date</span>
          <input type="date" value={expDate} onChange={(e) => setExpDate(e.target.value)} />
        </label>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 12 }}>
          <Button type="submit" variant="primary" loading={submitting} loadingText="Saving…">
            <span>Save expense</span>
            <ArrowRight size={15} />
          </Button>
        </div>
      </form>
    </StaffModal>
  );
}
