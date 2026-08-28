import { NextResponse } from 'next/server';
import { searchDays } from '@/lib/plan';

export async function GET(request: Request) {
  const q = new URL(request.url).searchParams.get('q') ?? '';
  return NextResponse.json({ hits: await searchDays(q) });
}
