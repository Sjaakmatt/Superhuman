import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata = { title: "Vandaag" };

export default function VandaagPage() {
  return (
    <PagePlaceholder
      title="Vandaag"
      description="De living core, je attribuut-rings, water en de takenstack van vandaag."
      phase="Komt in Fase 1"
      accent="var(--attr-vitaliteit)"
    />
  );
}
