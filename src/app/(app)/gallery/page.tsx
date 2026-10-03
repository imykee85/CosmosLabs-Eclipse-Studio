import { auth } from "@clerk/nextjs/server";
import { db } from "@/lib/db";

export const dynamic = "force-dynamic";

export default async function GalleryPage() {
  const { userId } = auth().protect();
  const generations = await db.generation.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Gallery</h1>
      {generations.length === 0 ? (
        <p className="text-neutral-400">Nothing here yet. Generate something first.</p>
      ) : (
        <ul className="grid grid-cols-2 gap-4 md:grid-cols-3">
          {generations.map((g) => (
            <li key={g.id} className="space-y-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={g.imageUrl} alt={g.prompt} className="aspect-square w-full rounded-lg object-cover" />
              <p className="line-clamp-2 text-sm text-neutral-400">{g.prompt}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
