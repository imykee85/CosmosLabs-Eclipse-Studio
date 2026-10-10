import { notFound } from "next/navigation";
import MotionDetail from "@/components/motion/MotionDetail";
import { findMotion, motionPrompts } from "@/lib/motion";
import { motionPromptText } from "@/lib/motion-prompts";

export function generateStaticParams() {
  return motionPrompts.map((p) => ({ id: p.id }));
}

export default function MotionDetailPage({ params }: { params: { id: string } }) {
  const item = findMotion(params.id);
  if (!item) notFound();
  return <MotionDetail item={{ ...item, prompt: motionPromptText[item.id] }} />;
}
