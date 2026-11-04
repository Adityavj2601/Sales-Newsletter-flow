import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="empty" style={{ marginTop: 40 }}>
      <b>Not found</b>
      <span>It may have been deleted, or it belongs to another product.</span>
      <div className="row"><Link className="btn primary" href="/app">Go to Home</Link></div>
    </div>
  );
}
