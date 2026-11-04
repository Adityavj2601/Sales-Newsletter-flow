import { Icon } from '@/components/people/Icon';
import { pct, type Metrics } from '@/lib/metrics';

/**
 * One edition number, laid out the same everywhere (Home “Last edition” and Results “Overview”):
 * icon chip, the number, its label, then a share line (“20% of delivered”) and a quiet detail line.
 * Wrap a row of them in `.grid4.res-tiles`.
 */
export function StatTile({ icon, tone = '', value, label, share, meta }: {
  icon: string; tone?: string; value: React.ReactNode; label: string; share?: React.ReactNode; meta?: React.ReactNode;
}) {
  return (
    <div className="stat-tile">
      <span className={`icon-chip ${tone}`} aria-hidden><Icon name={icon} size={16} /></span>
      <div className="sv">{typeof value === 'number' ? value.toLocaleString('en-IN') : value}</div>
      <div className="sk">{label}</div>
      {share ? <div className="sm res-pct">{share}</div> : null}
      {meta ? <div className="sm">{meta}</div> : null}
    </div>
  );
}

/** The four edition numbers (Delivered → Showed interest) both pages show, built from `editionMetrics`. */
export function editionTiles(m: Metrics) {
  const CH: Record<string, string> = { email: 'Email', whatsapp: 'WhatsApp API', wa_manual: 'WhatsApp' };
  const share = (n: number) => (m.delivered ? `${pct(n, m.delivered)} of delivered` : 'Nothing delivered yet');
  return [
    { key: 'delivered', icon: 'send', tone: '', value: m.delivered, label: 'Delivered', share: Object.entries(m.byChannel).map(([c, n]) => `${CH[c] || c}: ${n}`).join(' · ') || 'Nothing delivered yet', meta: m.failed ? `${m.failed} failed` : undefined },
    { key: 'readers', icon: 'eye', tone: '', value: m.readers, label: 'Opened the page', share: share(m.readers), meta: m.anonViews ? `+${m.anonViews} views via shared link` : `${m.opens} email ${m.opens === 1 ? 'open' : 'opens'} (approximate)` },
    { key: 'halfway', icon: 'doc', tone: '', value: m.halfway, label: 'Read past halfway', share: share(m.halfway), meta: `${m.finished} reached the end${m.avgTime ? ` · avg ${m.avgTime}s on page` : ''}` },
    { key: 'intent', icon: 'flame', tone: 'ok', value: m.intentPeople, label: 'Showed interest', share: share(m.intentPeople), meta: m.anonIntents ? `+${m.anonIntents} taps via shared link` : 'Interested, booked or tapped Our work' },
  ];
}
