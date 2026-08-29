import Coach, { type ChatBericht } from '@/components/Coach';
import { Card, Empty, Note } from '@/components/ui';
import { getChat } from '@/lib/data';
import { dbConfigured } from '@/lib/db';

/* Het gesprek gaat over vandaag en staat per gebruiker in de database, dus
 * nooit vooraf renderen. */
export const dynamic = 'force-dynamic';

export default async function CoachPagina() {
  if (!dbConfigured()) {
    return (
      <Card>
        <Empty title="Geen database verbonden">
          De coach leest je plan en je metingen uit de database. Zonder verbinding heeft hij niets om over te praten.
        </Empty>
      </Card>
    );
  }

  const eerder = (await getChat()) as ChatBericht[];

  return (
    <div className="flex flex-col gap-4">
      <Coach start={eerder} />
      <Note>
        De coach leest mee met je plan, je activiteiten, je logboek en je ochtendchecks. Hij verandert niets: een
        aanpassing voer je zelf door bij Loggen of Vandaag. De signalen op Analyse worden berekend, niet door hem
        bedacht.
      </Note>
    </div>
  );
}
