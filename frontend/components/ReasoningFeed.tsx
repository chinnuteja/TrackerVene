import { AnimatePresence } from "framer-motion";
import { DecisionCard } from "./DecisionCard";
import type { Decision } from "@/hooks/useRoutineFeed";

export function ReasoningFeed({ decisions }: { decisions: Decision[] }) {
  return (
    <div className="h-full overflow-y-auto pr-1">
      <h3 className="text-xs tracking-widest text-[var(--muted)] mb-3">
        AGENT REASONING
      </h3>
      <AnimatePresence initial={false}>
        {decisions.map((d, i) => <DecisionCard key={i} d={d} />)}
      </AnimatePresence>
    </div>
  );
}
