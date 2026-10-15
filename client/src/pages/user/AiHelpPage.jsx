import PageHeader from "../../components/PageHeader";
import BlessonChat from "../../components/ai/BlessonChat";

export default function AiHelpPage() {
  return (
    <div className="space-y-5 sm:space-y-6">
      <PageHeader eyebrow="Blesson AI" description="Ask about your water, supply times and bills, in English or Tamil. You can send a photo too." />
      <BlessonChat scope="user" variant="page" />
    </div>
  );
}
