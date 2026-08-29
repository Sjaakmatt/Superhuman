import { describe, expect, it } from 'vitest';
import { inHetNederlands, keurWachtwoord, MINIMALE_WACHTWOORDLENGTE } from '@/lib/auth';

describe('foutmeldingen', () => {
  it('vertaalt de melding die je het vaakst ziet', () => {
    expect(inHetNederlands('Invalid login credentials')).toBe(
      'Dat e-mailadres en wachtwoord horen niet bij elkaar.',
    );
  });

  it('neemt getallen uit de oorspronkelijke melding over', () => {
    expect(inHetNederlands('Password should be at least 6 characters')).toBe(
      'Je wachtwoord moet minstens 6 tekens hebben.',
    );
    expect(inHetNederlands('For security purposes, you can only request this after 47 seconds')).toBe(
      'Even wachten — probeer het over 47 seconden opnieuw.',
    );
  });

  it('laat een onbekende melding staan in plaats van te gokken', () => {
    expect(inHetNederlands('Something nobody anticipated')).toBe('Something nobody anticipated');
  });

  it('herkent een verlopen herstel-link', () => {
    expect(inHetNederlands('Token has expired or is invalid')).toMatch(/verlopen of al gebruikt/);
  });
});

describe('wachtwoordkeuring', () => {
  it('wijst een te kort wachtwoord af', () => {
    expect(keurWachtwoord('kort')).toMatch(/minstens 10 tekens/i);
  });

  it('laat een wachtwoord van precies de ondergrens door', () => {
    expect(keurWachtwoord('a'.repeat(MINIMALE_WACHTWOORDLENGTE))).toBeNull();
  });

  it('laat een zin door', () => {
    expect(keurWachtwoord('honderd kilometer op twee oktober')).toBeNull();
  });
});
