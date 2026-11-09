import { notFound } from "next/navigation";
import CollectionItem from "@/components/collections/CollectionItem";
import PremiumGuard from "@/components/collections/PremiumGuard";
import { findCollection, findItem } from "@/lib/premium";

export default async function CollectionItemPage(props: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await props.params;
  const c = findCollection(slug);
  const item = c ? findItem(slug, id) : null;
  if (!c || !item) notFound();
  return <PremiumGuard><CollectionItem collection={c} item={item} /></PremiumGuard>;
}
