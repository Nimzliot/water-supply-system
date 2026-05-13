import { useParams } from "react-router-dom";
import PageHeader from "../../components/PageHeader";
import FeatureListCard from "../../components/FeatureListCard";

export default function BillDetailsPage() {
  const { id } = useParams();

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Bill Details"
        title={`Bill Breakdown ${id}`}
        description="Detailed monthly bill including water consumed, LPCD usage, tariff, and total amount."
      />
      <FeatureListCard
        title="Bill Components"
        items={[
          "Water consumed during billing cycle",
          "LPCD used against household size",
          "Configured tariff rate",
          "Final bill amount calculation"
        ]}
        tone="info"
      />
    </div>
  );
}

