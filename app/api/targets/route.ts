import { NextResponse } from 'next/server';
import { targets } from '@/lib/targets';

export async function GET() {
  return NextResponse.json(targets);
}
