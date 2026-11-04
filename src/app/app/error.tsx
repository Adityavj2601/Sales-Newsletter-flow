'use client';
import Link from 'next/link';

export default function StudioError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      <b>Something went wrong</b>
      <span>{error.message && !/server-side|digest/i.test(error.message) ? error.message : 'The last action didn’t finish. Nothing else was changed.'}</span>
      <div className="row"><button className="btn primary" onClick={() => reset()}>Try again</button><Link className="btn" href="/app">Go to Home</Link></div>
    </div>
  );
}
