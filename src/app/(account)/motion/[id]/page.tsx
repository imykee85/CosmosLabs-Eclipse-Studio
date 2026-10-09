import { notFound } from "next/navigation";
import MotionDetail from "@/components/motion/MotionDetail";
import { findMotion, motionPrompts } from "@/lib/motion";

export function generateStaticParams() {
  return motionPrompts.filter((p) => p.video || p.preview || p.prompt).map((p) => ({ id: p.id }));
}

export default function MotionDetailPage({ params }: { params: { id: string } }) {
  const item = findMotion(params.id);
  if (!item) notFound();
  return <MotionDetail item={item} />;
}
