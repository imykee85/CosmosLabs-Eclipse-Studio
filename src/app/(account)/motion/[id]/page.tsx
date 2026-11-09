import { notFound } from "next/navigation";
import MotionDetail from "@/components/motion/MotionDetail";
import PremiumGuard from "@/components/collections/PremiumGuard";
import { findMotion, motionPrompts } from "@/lib/motion";
import { motionPromptText } from "@/lib/motion-prompts";

export function generateStaticParams() {
  return motionPrompts.map((p) => ({ id: p.id }));
}

export default async function MotionDetailPage(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const item = findMotion(params.id);
  if (!item) notFound();
  return <PremiumGuard><MotionDetail item={{ ...item, prompt: motionPromptText[item.id] }} /></PremiumGuard>;
}
