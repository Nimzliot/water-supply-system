import PageHeader from "../../components/PageHeader";
import FeatureListCard from "../../components/FeatureListCard";

export default function AiPredictionsPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="AI Predictions"
        title="Future demand prediction and pump optimization"
        description="Dedicated AI screen for usage forecasting, future demand patterns, and pump schedule recommendations."
      />
      <div className="grid gap-4 xl:grid-cols-2">
        <FeatureListCard
          title="Prediction Outputs"
          items={[
            "Peak-hour demand forecasting",
            "Daily and weekly usage prediction",
            "Pump optimization suggestions",
            "Schedule balancing across zones"
          ]}
          tone="info"
        />
        <FeatureListCard
          title="Data Inputs"
          items={[
            "Historical household consumption",
            "Time-of-day patterns",
            "Distribution schedule windows",
            "Tank refill and pump runtime history"
          ]}
        />
      </div>
    </div>
  );
}

