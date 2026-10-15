import PageHeader from "../../components/PageHeader";
import AiChat from "../../components/ai/AiChat";

const SUGGESTIONS = [
  "How much water have I used today, and how much is left?",
  "When will water come next?",
  "How much is my bill and is it paid?",
  "How can my family save water?",
  "Why is my water not coming?"
];

export default function AiHelpPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Ask AI" description="Ask about your water use, supply times and bills. The answers use your household's own readings." />
      <div className="max-w-3xl">
        <AiChat scope="user" suggestions={SUGGESTIONS} title="Your water assistant" placeholder="Ask about your water, supply times or bills..." />
      </div>
    </div>
  );
}
