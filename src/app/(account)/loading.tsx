// Shown at once while a Studio screen is being prepared, so moving between screens feels instant.
export default function Loading() {
  return (
    <div aria-hidden="true" style={{ maxWidth: 760, margin: "0 auto", padding: "24px 0", display: "grid", gap: 14, justifyItems: "center" }}>
      <div className="app-skel" style={{ width: 200, height: 28 }} />
      <div className="app-skel" style={{ width: "min(320px, 70%)", height: 16 }} />
      <div className="app-skel" style={{ width: "min(304px, 80%)", height: 200, borderRadius: 18, marginTop: 8 }} />
    </div>
  );
}
