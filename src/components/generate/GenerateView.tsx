import { FileText } from "lucide-react";
import "./generate.css";

// VIDEO step 3. Generating clips needs the scenes and master prompt from step 2, so until those exist this is the whole page.
export default function GenerateView() {
  return (
    <div className="gn-wrap">
      <section className="gn-card" aria-labelledby="gn-title">
        <FileText size={46} strokeWidth={1.4} aria-hidden="true" />
        <h1 id="gn-title">Create your prompts first</h1>
        <p>Finish the Prompts step to write your scenes and a master prompt before you generate.</p>
      </section>
    </div>
  );
}
