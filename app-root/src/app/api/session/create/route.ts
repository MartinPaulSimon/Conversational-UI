import { NextResponse } from 'next/server';
import prisma from '@/lib/prismaClient';

export async function POST() {
  try {
    const session = await prisma.session.create({ data: {} });

    return NextResponse.json({
      sessionId: session.id,
      message: 'Session created',
    });
  } catch (error) {
    console.error('Session create error:', error);
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 });
  }
}
