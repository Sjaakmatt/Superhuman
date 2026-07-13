import { PagePlaceholder } from "@/components/page-placeholder";

export const metadata = { title: "Voeding" };

export default function VoedingPage() {
  return (
    <PagePlaceholder
      title="Voeding"
      description="Dagelijkse check-in, voedingsplan en de boodschappenlijst."
      phase="Check-in komt in Fase 1"
      accent="var(--attr-voeding)"
    />
  );
}
