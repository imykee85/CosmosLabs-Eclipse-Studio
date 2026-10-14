import { Suspense } from "react";
import VoiceStudio from "@/components/voice/VoiceStudio";

export const dynamic = "force-dynamic";

export default function VoicePage() {
  return (
    <Suspense>
      <VoiceStudio />
    </Suspense>
  );
}
