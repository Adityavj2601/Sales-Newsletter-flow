/** Re-mounts on every studio navigation, giving each page a gentle fade-and-rise entrance. */
export default function StudioTemplate({ children }: { children: React.ReactNode }) {
  return <div className="page">{children}</div>;
}
