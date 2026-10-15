import PageHeader from "../../components/PageHeader";
import AiBriefingCard from "../../components/ai/AiBriefingCard";
import AiChat from "../../components/ai/AiChat";

const SUGGESTIONS = [
  "Why is water not reaching the houses right now?",
  "Is anything wrong with the hardware?",
  "Which household uses the most water, and is anyone close to their limit?",
  "Suggest better supply windows from the usage by hour.",
  "How much is unpaid on bills?",
  "Explain what the controller is doing right now."
];

export default function AiAssistantPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="AI Assistant"
        description="Gemini reads the live controller, schedules, usage and bills, and answers in plain words. It explains and advises; it never switches the pump or valves."
      />
      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr] xl:gap-5">
        <AiChat scope="admin" suggestions={SUGGESTIONS} title="Ask about the system" />
        <div className="self-start">
          <AiBriefingCard />
        </div>
      </div>
    </div>
  );
}
