/** Een gladde lijn door een reeks punten, via Catmull-Rom omgezet naar cubic
 *  bezier. Geen grafiekbibliotheek: de vormen in deze app zijn eenvoudig genoeg
 *  en een bibliotheek kost meer dan hij oplevert, in kilobytes en in afwijking
 *  van het ontwerp. */
export function smoothPath(points: { x: number; y: number }[], tension = 0.5): string {
  if (points.length === 0) return '';
  if (points.length === 1) return `M ${points[0]!.x} ${points[0]!.y}`;

  const at = (i: number) => points[Math.max(0, Math.min(points.length - 1, i))]!;
  let d = `M ${at(0).x} ${at(0).y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = at(i - 1);
    const p1 = at(i);
    const p2 = at(i + 1);
    const p3 = at(i + 2);
    const c1 = { x: p1.x + ((p2.x - p0.x) / 6) * tension, y: p1.y + ((p2.y - p0.y) / 6) * tension };
    const c2 = { x: p2.x - ((p3.x - p1.x) / 6) * tension, y: p2.y - ((p3.y - p1.y) / 6) * tension };
    d += ` C ${round(c1.x)} ${round(c1.y)}, ${round(c2.x)} ${round(c2.y)}, ${round(p2.x)} ${round(p2.y)}`;
  }
  return d;
}

const round = (n: number) => Math.round(n * 100) / 100;

/** Lineaire schaal van een waardebereik naar een pixelbereik. */
export function scale(domain: [number, number], range: [number, number]) {
  const [d0, d1] = domain;
  const [r0, r1] = range;
  const span = d1 - d0 || 1;
  return (value: number) => r0 + ((value - d0) / span) * (r1 - r0);
}
