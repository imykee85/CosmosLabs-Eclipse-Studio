import { getAdmin } from "@/lib/admin";
import { manifestSize, translationCounts } from "@/lib/i18n/translate-server";
import TranslationsAdmin from "@/components/admin/TranslationsAdmin";

export const dynamic = "force-dynamic";

// Owner only: translate the whole interface into a language ahead of time, so the first visitors from that country do not wait.
export default async function AdminTranslationsPage() {
  const admin = await getAdmin();
  if (!admin) return <p className="app-muted">This page is not available.</p>;
  return (
    <main style={{ padding: 16, maxWidth: 720, margin: "0 auto" }}>
      <h1 style={{ fontSize: 20, fontWeight: 700 }}>Translations</h1>
      <p className="app-muted" style={{ margin: "6px 0 14px" }}>Every interface text ({manifestSize.toLocaleString("en-US")} strings) is translated once and kept. Press a language to prepare it; it runs in the background of this page.</p>
      <TranslationsAdmin total={manifestSize} initial={await translationCounts()} />
    </main>
  );
}
