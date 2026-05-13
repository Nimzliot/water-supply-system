import PageHeader from "../../components/PageHeader";

export default function SupportPage() {
  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow="Support"
        title="Complaints, contact, and FAQs"
        description="Simple support center for rural users to contact administrators and raise service issues."
      />
      <div className="panel max-w-3xl p-5">
        <div className="grid gap-4">
          <input className="input" placeholder="Subject" />
          <textarea className="input min-h-32" placeholder="Describe your issue or complaint" />
          <button className="btn-primary w-full md:w-auto">Submit Complaint</button>
        </div>
      </div>
    </div>
  );
}

