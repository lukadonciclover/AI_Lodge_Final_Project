import { NewAnalysisWorkflow } from "@/components/new-analysis-workflow";
import { PageHeading } from "@/components/page-heading";

export default function NewAnalysisPage() {
  return <><PageHeading eyebrow="New coverage" title="Create company analysis" description="Import public-company filings or enter the financial history manually." /><NewAnalysisWorkflow /></>;
}
