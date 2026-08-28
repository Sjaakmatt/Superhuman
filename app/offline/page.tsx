import { Card, CardTitle } from '@/components/ui';

export const metadata = { title: 'Geen verbinding — Ultra100' };

export default function Offline() {
  return (
    <div className="mx-auto max-w-[460px] pt-8">
      <Card>
        <CardTitle>Geen verbinding</CardTitle>
        <p className="text-[14px] leading-relaxed">
          De app toont bewust geen oude cijfers. Zodra je weer verbinding hebt, staat de sessie van vandaag er weer.
        </p>
      </Card>
    </div>
  );
}
