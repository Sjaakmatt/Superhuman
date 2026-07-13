import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata = { title: "Progressie" };

export default function ProgressiePage() {
  return (
    <PagePlaceholder
      title="Progressie"
      description="Je character sheet: superhuman-level, streaks, heatmap en trends."
      phase="Komt in Fase 2"
      accent="var(--attr-focus)"
    />
  );
}
