import { Suspense } from "react";
import MotionView from "@/components/motion/MotionView";
import PremiumGuard from "@/components/collections/PremiumGuard";

export default function MotionPage() {
  return <PremiumGuard><Suspense><MotionView /></Suspense></PremiumGuard>;
}
