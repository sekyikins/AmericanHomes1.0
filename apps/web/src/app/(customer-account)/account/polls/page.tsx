'use client';

import { ArrowLeft, BarChart2, CheckCircle2, Clock } from 'lucide-react';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { BackLink, Button, EmptyState, ErrorState, TableSkeleton } from '@/components/ui';
import { governanceApi } from '@/lib/api';
import { useToast } from '@/providers/toast.provider';

type CustomerPoll = {
  id: string;
  title: string;
  description?: string | null;
  status: string;
  closesAt?: string | null;
  yesVotes: number;
  noVotes: number;
  myChoice: string | null;
};

export default function AccountPollsPage() {
  const { showToast } = useToast();
  const [polls, setPolls] = useState<CustomerPoll[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<'unanswered' | 'answered'>('unanswered');
  const [votingId, setVotingId] = useState<string | null>(null);

  const loadPolls = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await governanceApi.listCustomerPolls();
      const mapped: CustomerPoll[] = (Array.isArray(data) ? data : [])
        .filter((p) => String(p.status || '').toUpperCase() === 'OPEN')
        .map((p) => ({
          id: String(p.id),
          title: String(p.title || 'Product poll'),
          description: p.description ? String(p.description) : null,
          status: String(p.status || 'OPEN'),
          closesAt: p.closesAt ? String(p.closesAt) : null,
          yesVotes: Number(p.yesVotes ?? 0),
          noVotes: Number(p.noVotes ?? 0),
          myChoice: p.myChoice ? String(p.myChoice) : null,
        }));
      setPolls(mapped);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load active product polls.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadPolls();
  }, [loadPolls]);

  const unanswered = polls.filter((p) => !p.myChoice);
  const answered = polls.filter((p) => Boolean(p.myChoice));
  const visible = tab === 'unanswered' ? unanswered : answered;

  const handleVote = async (pollId: string, choice: 'YES' | 'NO') => {
    if (votingId) return;
    setVotingId(pollId);
    try {
      await governanceApi.votePoll(pollId, choice);
      showToast('Your vote has been recorded.', 'success');
      await loadPolls(true);
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Failed to record vote.', 'error');
    } finally {
      setVotingId(null);
    }
  };

  return (
    <main className="acct-shell">
      <BackLink href="/account" className="pdp-back">
        <ArrowLeft size={15} />
        <span>Back to account</span>
      </BackLink>

      <div className="acct-head">
        <div>
          <div className="eyebrow">Community demand</div>
          <h1 className="acct-title">Active polls</h1>
        </div>
        <Link href="/request-product" className="button" style={{ background: '#fff' }}>
          Request a specific item
        </Link>
      </div>

      <div className="notif-tabs" role="tablist" style={{ marginBottom: 16 }}>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'unanswered'}
          className={`notif-tab ${tab === 'unanswered' ? 'active' : ''}`}
          onClick={() => setTab('unanswered')}
        >
          Unanswered ({unanswered.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'answered'}
          className={`notif-tab ${tab === 'answered' ? 'active' : ''}`}
          onClick={() => setTab('answered')}
        >
          Answered ({answered.length})
        </button>
      </div>

      <section className="acct-panel" style={{ padding: '16px 24px' }}>
        {loading ? (
          <TableSkeleton rows={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => loadPolls()} />
        ) : visible.length === 0 ? (
          <EmptyState
            title={tab === 'unanswered' ? 'No unanswered polls' : 'No answered polls yet'}
            description={
              tab === 'unanswered'
                ? 'You are all caught up on active product polls.'
                : 'Active polls you vote on will appear here while they remain open.'
            }
          />
        ) : (
          <div style={{ display: 'grid', gap: 14 }}>
            {visible.map((poll) => {
              const total = poll.yesVotes + poll.noVotes;
              const yesPct = total > 0 ? Math.round((poll.yesVotes / total) * 100) : 0;
              const isVoting = votingId === poll.id;
              return (
                <article
                  key={poll.id}
                  style={{
                    border: '0.8px solid var(--line)',
                    borderRadius: 6,
                    padding: 18,
                    background: '#fff',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 12,
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      gap: 12,
                      flexWrap: 'wrap',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <BarChart2 size={16} color="var(--green)" />
                        <strong style={{ fontSize: 15, color: 'var(--ink)' }}>{poll.title}</strong>
                      </div>
                      {poll.description && (
                        <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--ink-soft)' }}>
                          {poll.description}
                        </p>
                      )}
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      {poll.myChoice && (
                        <span className="acct-pill green">
                          <CheckCircle2 size={12} /> Voted {poll.myChoice}
                        </span>
                      )}
                      {poll.closesAt && (
                        <span className="acct-pill amber">
                          <Clock size={12} /> Closes{' '}
                          {new Date(poll.closesAt).toLocaleString('en-GH', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </span>
                      )}
                    </div>
                  </div>

                  <div>
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        fontSize: 12,
                        color: 'var(--muted)',
                        marginBottom: 6,
                      }}
                    >
                      <span>{poll.yesVotes} Yes ({yesPct}%)</span>
                      <span>{poll.noVotes} No · {total} total votes</span>
                    </div>
                    <div className="acct-progress" style={{ height: 6 }}>
                      <div className="acct-progress-bar" style={{ width: `${yesPct}%` }} />
                    </div>
                  </div>

                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Button
                      type="button"
                      variant={poll.myChoice === 'YES' ? 'primary' : 'secondary'}
                      loading={isVoting}
                      disabled={Boolean(votingId)}
                      onClick={() => handleVote(poll.id, 'YES')}
                    >
                      {poll.myChoice === 'YES' ? 'Voted: Yes, source this' : 'Yes, source this'}
                    </Button>
                    <Button
                      type="button"
                      variant={poll.myChoice === 'NO' ? 'primary' : 'secondary'}
                      loading={isVoting}
                      disabled={Boolean(votingId)}
                      onClick={() => handleVote(poll.id, 'NO')}
                    >
                      {poll.myChoice === 'NO' ? 'Voted: Not interested' : 'Not interested'}
                    </Button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </main>
  );
}
