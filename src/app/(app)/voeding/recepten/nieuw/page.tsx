import { RecipeForm } from "@/components/recipe-form";

export const metadata = { title: "Nieuw recept" };

export default function NieuwReceptPage() {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-xl font-semibold">Nieuw recept</h1>
        <p className="mt-1 text-sm text-muted">
          Ingrediënten voeden straks automatisch je boodschappenlijst.
        </p>
      </div>
      <RecipeForm />
    </div>
  );
}
