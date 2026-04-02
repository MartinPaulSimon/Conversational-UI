import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prismaClient';

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { instruction } = body;

    if (!instruction) {
      return NextResponse.json({ error: 'Refinement instruction is required' }, { status: 400 });
    }

    // Get session
    const session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      return NextResponse.json({ error: 'Session not found' }, { status: 404 });
    }

    const q = instruction.toLowerCase();

    // Parse refinement instruction into filter updates
    const updates: Record<string, unknown> = {};

    // Remove filters
    if (/\b(remove|drop|clear)\b.*\b(location|city)\b/.test(q)) {
      updates.filterLocation = null;
    }
    if (/\b(remove|drop|clear)\b.*\b(skill|tech)\b/.test(q)) {
      updates.filterSkills = [];
    }
    if (/\b(remove|drop|clear)\b.*\b(experience|years)\b/.test(q)) {
      updates.filterExperienceMin = null;
      updates.filterExperienceMax = null;
    }
    if (/\b(remove|drop|clear)\b.*\b(domain|industry)\b/.test(q)) {
      updates.filterDomain = null;
    }
    if (/\b(remove|drop|clear)\b.*\b(role|position)\b/.test(q)) {
      updates.filterRole = null;
    }

    // Add location filter
    const locationMap: Record<string, string> = {
      'india': 'India', 'bangalore': 'Bangalore', 'mumbai': 'Mumbai',
      'delhi': 'Delhi', 'usa': 'USA', 'san francisco': 'San Francisco',
      'london': 'London', 'berlin': 'Berlin', 'remote': 'Remote',
    };
    for (const [kw, loc] of Object.entries(locationMap)) {
      if (q.includes(kw) && !/remove|drop|clear/.test(q)) {
        updates.filterLocation = loc;
        break;
      }
    }

    // Add experience filter
    const expMatch = q.match(/(\d+)\+?\s*(?:year|yr)/i);
    if (expMatch && !/remove|drop|clear/.test(q)) {
      updates.filterExperienceMin = parseInt(expMatch[1]);
    }

    // Exclude candidate
    if (/\bexclude\b/.test(q)) {
      const candidateNameMatch = q.match(/exclude\s+(.+)/i);
      if (candidateNameMatch) {
        const name = candidateNameMatch[1].trim();
        const candidate = await prisma.candidate.findFirst({
          where: { name: { contains: name, mode: 'insensitive' } },
        });
        if (candidate) {
          updates.excludedCandidates = [...session.excludedCandidates, candidate.id];
        }
      }
    }

    // Update session
    const updatedSession = await prisma.session.update({
      where: { id },
      data: updates,
    });

    // Re-search with updated filters
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const where: any = {};

    if (updatedSession.excludedCandidates.length > 0) {
      where.id = { notIn: updatedSession.excludedCandidates };
    }
    if (updatedSession.filterSkills.length > 0) {
      where.skills = { hasSome: updatedSession.filterSkills };
    }
    if (updatedSession.filterExperienceMin != null) {
      where.experience = { gte: updatedSession.filterExperienceMin };
    }
    if (updatedSession.filterLocation) {
      where.location = { contains: updatedSession.filterLocation, mode: 'insensitive' };
    }
    if (updatedSession.filterDomain) {
      where.domain = { contains: updatedSession.filterDomain, mode: 'insensitive' };
    }
    if (updatedSession.filterRole) {
      where.role = { contains: updatedSession.filterRole, mode: 'insensitive' };
    }

    const candidates = await prisma.candidate.findMany({
      where, orderBy: { skillScore: 'desc' }, take: 10,
    });

    const ranked = candidates.map(c => {
      const finalScore = Math.round(
        (c.skillScore * 0.25) + (c.roleScore * 0.15) + (c.experienceScore * 0.15) +
        (c.domainScore * 0.10) + (c.trajectoryScore * 0.10) + (c.referralScore * 0.10) -
        (c.riskScore * 0.10)
      );
      return {
        id: c.id, name: c.name, role: c.role, skills: c.skills,
        experience: c.experience, location: c.location, domain: c.domain,
        company: c.company, education: c.education,
        factors: { skill: c.skillScore, role: c.roleScore, experience: c.experienceScore, domain: c.domainScore, trajectory: c.trajectoryScore, referral: c.referralScore, risk: c.riskScore },
        finalScore, reasoning: c.reasoning,
      };
    }).sort((a, b) => b.finalScore - a.finalScore);

    return NextResponse.json({
      message: `Refined search: found ${ranked.length} candidates with updated criteria.`,
      candidates: ranked.slice(0, 5),
      totalResults: ranked.length,
      filters: {
        skills: updatedSession.filterSkills,
        experience_min: updatedSession.filterExperienceMin,
        location: updatedSession.filterLocation,
        domain: updatedSession.filterDomain,
        role: updatedSession.filterRole,
      },
    });
  } catch (error) {
    console.error('Refine API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
