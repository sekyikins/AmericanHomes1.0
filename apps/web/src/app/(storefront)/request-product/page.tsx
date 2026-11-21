'use client';

import { ArrowRight, Check, ImagePlus, Info, X } from 'lucide-react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { useUnsavedChanges } from '@/hooks/use-unsaved-changes';
import { requestsApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';
import { useAuth } from '@/store/auth.store';

function RequestProductContent() {
  const { user, setLoginOpen } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [productName, setProductName] = useState(() => searchParams.get('product') ?? '');
  const [description, setDescription] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [budget, setBudget] = useState(() => searchParams.get('budget') ?? '');
  const [notes, setNotes] = useState('');
  const [fileName, setFileName] = useState<string | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [submittedRef, setSubmittedRef] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const isDirty = Boolean(
    !submittedRef &&
      (productName.trim() || description.trim() || budget.trim() || notes.trim() || fileName),
  );
  useUnsavedChanges(isDirty);

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setFileName(file.name);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearImage = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFileName(null);
  };

  const [submitError, setSubmitError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user) {
      setLoginOpen(true);
      return;
    }
    if (!acknowledged) {
      setSubmitError('Please confirm that you understand this is a sourcing request, not an order or reservation.');
      return;
    }
    if (submitting || !productName.trim() || !description.trim()) return;
    setSubmitError(null);
    setSubmitting(true);
    const parsedBudget = Number(budget.replace(/[^0-9.]/g, ''));
    try {
      const res = (await requestsApi.submit({
        productName: productName.trim(),
        description: description.trim(),
        quantity: Number(quantity) || 1,
        ...(Number.isFinite(parsedBudget) && parsedBudget > 0
          ? { budgetCents: Math.round(parsedBudget * 100) }
          : {}),
        notes: notes.trim() || undefined,
      })) as { id?: string } | null;
      setSubmittedRef(res?.id ?? 'SUBMITTED');
      showToast('Product request submitted', 'success');
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : 'Failed to submit product request. Please try again.';
      setSubmitError(msg);
      showToast(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  };

  if (submittedRef) {
    return (
      <main className="request-shell" data-node-id="2:9273">
        <div className="request-check-circle" aria-hidden="true">
          <Check size={28} strokeWidth={2.5} />
        </div>

        <div className="eyebrow" style={{ textAlign: 'center' }}>
          Request submitted
        </div>

        <h1 className="request-title">We’ll take it from here.</h1>

        <p className="request-subtitle">
          Your request <strong>{submittedRef}</strong> is now under review. This is not an order,
          reservation or guarantee that we can source the item.
        </p>

        <section className="request-card" aria-label="What happens next">
          <h3>What happens next</h3>
          <div className="timeline">
            <div className="timeline-step">
              <span className="timeline-dot active" aria-hidden="true">
                <Check size={13} strokeWidth={2.5} />
              </span>
              <div>
                <strong>Submitted</strong>
                <small>Today, 10:42 AM</small>
              </div>
            </div>

            <div className="timeline-step">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <strong>Under review</strong>
                <small>Our sourcing team will assess your request</small>
              </div>
            </div>

            <div className="timeline-step">
              <span className="timeline-dot" aria-hidden="true" />
              <div>
                <strong>Decision shared</strong>
                <small>You’ll receive an in-app and WhatsApp update</small>
              </div>
            </div>
          </div>
        </section>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <Link
            href="/account/product-requests"
            className="button primary"
            style={{ minHeight: 46, padding: '0 19px' }}
          >
            View my requests
          </Link>
          <button
            type="button"
            className="button"
            style={{ minHeight: 46 }}
            onClick={() => {
              setSubmittedRef(null);
              setProductName('');
              setDescription('');
              setQuantity('1');
              setBudget('');
              setNotes('');
              clearImage();
              setAcknowledged(false);
            }}
          >
            New request
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className="request-form-shell" data-node-id="2:8985">
      <div className="eyebrow">Product sourcing request</div>
      <h1 className="request-form-title">What can we find for you?</h1>
      <p className="request-form-sub">
        Share what you need and our team will consider it for a future shipment. No payment is
        required.
      </p>

      <div className="request-info-banner">
        <Info size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div>
          <strong>A request is not a purchase.</strong>
          <span>It does not reserve stock or guarantee that the product will be sourced.</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="request-form-card">
        <div className="req-field">
          <label htmlFor="req-name">
            <strong>Product name</strong>
            <small>Required</small>
          </label>
          <input
            id="req-name"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="e.g. KitchenAid stand mixer"
          />
        </div>

        <div className="req-field">
          <label htmlFor="req-desc">
            <strong>Describe what you’re looking for</strong>
            <small>Required</small>
          </label>
          <textarea
            id="req-desc"
            rows={4}
            required
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Include the preferred brand, model, colour or size..."
          />
        </div>

        <div className="req-row-2">
          <div className="req-field">
            <label htmlFor="req-qty">
              <strong>Quantity</strong>
            </label>
            <input
              id="req-qty"
              type="number"
              min={1}
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
            />
          </div>

          <div className="req-field">
            <label htmlFor="req-budget">
              <strong>Preferred budget (optional)</strong>
            </label>
            <input
              id="req-budget"
              type="number"
              min={0}
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="GHS 0.00"
            />
          </div>
        </div>

        <div className="req-field">
          <label>
            <strong>Reference image</strong>
            <small>Optional</small>
          </label>
          {previewUrl ? (
            <div
              className="req-upload-zone"
              style={{ padding: 14, gap: 10, cursor: 'default' }}
            >
              <img
                src={previewUrl}
                alt={fileName ?? 'Reference preview'}
                style={{
                  maxHeight: 220,
                  maxWidth: '100%',
                  objectFit: 'contain',
                  borderRadius: 4,
                }}
              />
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 12,
                  fontSize: 12,
                }}
              >
                <span style={{ color: 'var(--ink)' }}>{fileName}</span>
                <label
                  style={{
                    color: 'var(--green)',
                    fontWeight: 700,
                    cursor: 'pointer',
                    margin: 0,
                  }}
                >
                  Change
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp"
                    onChange={handleFileChange}
                    style={{ display: 'none' }}
                  />
                </label>
                <button
                  type="button"
                  onClick={clearImage}
                  aria-label="Remove image"
                  style={{
                    border: 0,
                    background: 'transparent',
                    color: 'var(--alert)',
                    fontWeight: 700,
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 4,
                    padding: 0,
                  }}
                >
                  <X size={13} /> Remove
                </button>
              </div>
            </div>
          ) : (
            <label className="req-upload-zone">
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
              <ImagePlus size={20} color="var(--green)" />
              <strong>Upload a photo</strong>
              <span>PNG or JPG, up to 10MB</span>
            </label>
          )}
        </div>

        <div className="req-field">
          <label htmlFor="req-notes">
            <strong>Additional notes</strong>
            <small>Optional</small>
          </label>
          <textarea
            id="req-notes"
            rows={3}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Anything else we should know?"
          />
        </div>

        <label className="req-checkbox-row">
          <input
            type="checkbox"
            checked={acknowledged}
            onChange={(e) => {
              setAcknowledged(e.target.checked);
              if (submitError) setSubmitError(null);
            }}
          />
          <span>I understand this is a sourcing request, not an order or reservation.</span>
        </label>

        {submitError && (
          <div
            role="alert"
            style={{
              marginTop: 14,
              padding: '10px 12px',
              borderRadius: 4,
              border: '1px solid #f0c2bd',
              background: '#fdf3f2',
              color: '#b42318',
              fontSize: 13,
            }}
          >
            {submitError}
          </div>
        )}

        <button
          type="submit"
          className="button primary"
          disabled={submitting}
          aria-busy={submitting || undefined}
          style={{ width: '100%', minHeight: 46, marginTop: 18 }}
        >
          <span>{submitting ? 'Submitting request…' : 'Submit request'}</span>
          <ArrowRight size={15} strokeWidth={2.2} />
        </button>
      </form>
    </main>
  );
}

export default function RequestProductPage() {
  return (
    <Suspense fallback={<main className="request-shell">Loading…</main>}>
      <RequestProductContent />
    </Suspense>
  );
}
