export function StatusCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <article style={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: 12, padding: 20 }}>
      <p style={{ color: "var(--muted)", margin: 0 }}>{label}</p>
      <strong style={{ display: "block", fontSize: 28, marginTop: 8 }}>{value}</strong>
    </article>
  );
}
