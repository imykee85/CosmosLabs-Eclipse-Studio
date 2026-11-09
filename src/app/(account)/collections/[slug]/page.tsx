import { notFound } from "next/navigation";
import CollectionView from "@/components/collections/CollectionView";
import PremiumGuard from "@/components/collections/PremiumGuard";
import { PREMIUM_COLLECTIONS, findCollection, itemsOf } from "@/lib/premium";

export function generateStaticParams() {
  return PREMIUM_COLLECTIONS.map((c) => ({ slug: c.slug }));
}

export default async function CollectionPage(props: { params: Promise<{ slug: string }> }) {
  const { slug } = await props.params;
  const c = findCollection(slug);
  if (!c) notFound();
  return <PremiumGuard><CollectionView collection={c} items={itemsOf(slug)} /></PremiumGuard>;
}
