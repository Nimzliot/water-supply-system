import PageHeader from "../../components/PageHeader";
import BlessonChat from "../../components/ai/BlessonChat";

export default function AiAssistantPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader
        eyebrow="Blesson AI"
        description="Your operations assistant. It reads the live controller, schedules, usage and bills, and can look at photos of wiring, sensors or the serial monitor. It explains and advises; it never switches the pump or valves."
      />
      <BlessonChat scope="admin" variant="page" />
    </div>
  );
}
