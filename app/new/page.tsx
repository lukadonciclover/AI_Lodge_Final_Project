import { AnalysisForm } from "@/components/analysis-form";
import { PageHeading } from "@/components/page-heading";

export default function NewAnalysisPage() {
  return <><PageHeading eyebrow="New coverage" title="Create company analysis" description="Build the financial foundation for your investment pitch. You can add and refine the thesis after setup." /><AnalysisForm /></>;
}
