import { all, get } from './db';

/** One definition of every reader metric, shared by Home, Editions and Results. People are counted once each. */
export type Metrics = {
  delivered: number; failed: number; byChannel: Record<string, number>;
  readers: number; anonViews: number; opens: number;
  halfway: number; finished: number; avgTime: number;
  intentPeople: number; cta: Record<string, number>; showcase: { value: string; n: number }[]; unsubscribes: number;
};

const n = (sql: string, ...a: any[]) => Number(get(sql, ...a)?.n || 0);
const inList = (ids: string[]) => (ids.length ? ids.map(() => '?').join(',') : "''");
// A "person" is a delivery; shared-link (anonymous) events count once per event row.
const WHO = "COALESCE(delivery_id, 'anon:' || id)";

export function editionMetrics(editionIds: string[]): Metrics {
  const q = inList(editionIds);
  const ids = editionIds;
  const byChannel: Record<string, number> = {};
  for (const r of all(`SELECT channel, COUNT(*) AS n FROM deliveries WHERE edition_id IN (${q}) AND channel <> 'test' AND status NOT IN ('failed','queued','skipped') GROUP BY channel`, ...ids)) byChannel[r.channel] = r.n;
  const delivered = Object.values(byChannel).reduce((a, b) => a + b, 0);
  const cta: Record<string, number> = {};
  for (const r of all(`SELECT type, COUNT(DISTINCT ${WHO}) AS n FROM events WHERE edition_id IN (${q}) AND type IN ('interested','book','more','share','notnow','unsubscribe') GROUP BY type`, ...ids)) cta[r.type] = r.n;
  return {
    delivered,
    failed: n(`SELECT COUNT(*) AS n FROM deliveries WHERE edition_id IN (${q}) AND status = 'failed'`, ...ids),
    byChannel,
    readers: n(`SELECT COUNT(DISTINCT delivery_id) AS n FROM events WHERE edition_id IN (${q}) AND type = 'view' AND delivery_id IS NOT NULL`, ...ids),
    anonViews: n(`SELECT COUNT(*) AS n FROM events WHERE edition_id IN (${q}) AND type = 'view' AND delivery_id IS NULL`, ...ids),
    opens: n(`SELECT COUNT(DISTINCT ev.delivery_id) AS n FROM events ev JOIN deliveries d ON d.id = ev.delivery_id WHERE ev.edition_id IN (${q}) AND ev.type = 'open' AND d.channel <> 'test'`, ...ids),
    // Each page view sends the 50/100 milestone once, so anonymous rows with that exact value are distinct page views.
    halfway: n(`SELECT COUNT(DISTINCT delivery_id) AS n FROM events WHERE edition_id IN (${q}) AND type = 'scroll' AND value IN ('50','75','100') AND delivery_id IS NOT NULL`, ...ids)
      + n(`SELECT COUNT(*) AS n FROM events WHERE edition_id IN (${q}) AND type = 'scroll' AND value = '50' AND delivery_id IS NULL`, ...ids),
    finished: n(`SELECT COUNT(DISTINCT delivery_id) AS n FROM events WHERE edition_id IN (${q}) AND type = 'scroll' AND value = '100' AND delivery_id IS NOT NULL`, ...ids)
      + n(`SELECT COUNT(*) AS n FROM events WHERE edition_id IN (${q}) AND type = 'scroll' AND value = '100' AND delivery_id IS NULL`, ...ids),
    avgTime: Math.round(Number(get(`SELECT AVG(t) AS n FROM (SELECT MAX(CAST(value AS INTEGER)) AS t FROM events WHERE edition_id IN (${q}) AND type = 'time' GROUP BY ${WHO}) WHERE t BETWEEN 3 AND 1800`, ...ids)?.n || 0)),
    intentPeople: n(`SELECT COUNT(DISTINCT ${WHO}) AS n FROM events WHERE edition_id IN (${q}) AND type IN ('interested','book','showcase')`, ...ids),
    cta,
    showcase: all(`SELECT value, COUNT(DISTINCT ${WHO}) AS n FROM events WHERE edition_id IN (${q}) AND type = 'showcase' GROUP BY value ORDER BY n DESC`, ...ids) as any,
    unsubscribes: cta.unsubscribe || 0,
  };
}

/** Poll results: each person's latest vote per poll block. */
export function pollResults(editionId: string, blockId: string): { value: string; n: number }[] {
  return all(`SELECT value, COUNT(*) AS n FROM (
      SELECT ${WHO} AS who, value, MAX(created_at) AS at FROM events
      WHERE edition_id = ? AND type = 'poll' AND value IS NOT NULL AND (json_extract(meta, '$.block') = ? OR json_extract(meta, '$.block') IS NULL)
      GROUP BY who
    ) GROUP BY value ORDER BY n DESC`, editionId, blockId) as any;
}

export const pct = (a: number, b: number) => (b ? `${Math.round((a / b) * 100)}%` : '–');
