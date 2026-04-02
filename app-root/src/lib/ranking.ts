// ===== DETERMINISTIC RANKING ENGINE =====
// This is the core AI — no LLM needed, pure logic

interface CandidateData {
  id: string;
  name: string;
  role: string;
  skills: string[];
  experience: number;
  location: string;
  domain: string;
  company: string | null;
  education: string | null;
  skillScore: number;
  roleScore: number;
  experienceScore: number;
  domainScore: number;
  trajectoryScore: number;
  referralScore: number;
  riskScore: number;
  reasoning: string[];
}

interface Intent {
  filters?: {
    location?: string | null;
    experience_min?: number | null;
    experience_max?: number | null;
  };
  semantic?: {
    skills?: string[];
    role?: string;
    domain?: string;
  };
}

export function rankCandidates(candidates: CandidateData[], intent: Intent) {
  const requiredSkills = intent?.semantic?.skills || [];
  const targetRole = intent?.semantic?.role || '';
  const targetDomain = intent?.semantic?.domain || '';

  return candidates
    .map(c => {
      // Dynamic skill match based on what user actually asked for
      const skillMatch = matchSkills(c.skills, requiredSkills);

      // Role alignment
      const roleMatch = targetRole
        ? (c.role.toLowerCase().includes(targetRole.toLowerCase()) ? 1.0 : 0.5)
        : 0.7;

      // Experience normalization (0-1 scale, capped at 15 years)
      const expNorm = normalizeExp(c.experience);

      // Domain alignment
      const domainMatch = targetDomain
        ? (c.domain.toLowerCase().includes(targetDomain.toLowerCase()) ? 1.0 : 0.6)
        : 0.7;

      // Trajectory (from pre-scored data)
      const trajectoryNorm = c.trajectoryScore / 100;

      // Referral bonus
      const referralNorm = c.referralScore / 100;

      // Risk penalty
      const riskPenalty = c.riskScore / 100;

      // Weighted final score
      const finalScore = Math.round((
        (skillMatch > 0 ? skillMatch : c.skillScore / 100) * 0.25 +
        roleMatch * 0.15 +
        expNorm * 0.15 +
        domainMatch * 0.10 +
        trajectoryNorm * 0.10 +
        referralNorm * 0.10 -
        riskPenalty * 0.10
      ) * 100);

      return { ...c, finalScore: Math.max(finalScore, 10) };
    })
    .sort((a, b) => b.finalScore - a.finalScore);
}

function matchSkills(candidateSkills: string[], required: string[]): number {
  if (!required?.length) return 0; // Return 0 to fall back to pre-scored skillScore
  const normalizedCandidate = candidateSkills.map(s => s.toLowerCase());
  const normalizedRequired = required.map(s => s.toLowerCase());
  const matches = normalizedRequired.filter(req =>
    normalizedCandidate.some(cs => cs.includes(req) || req.includes(cs))
  ).length;
  return matches / normalizedRequired.length;
}

function normalizeExp(exp: number): number {
  return Math.min(exp / 15, 1);
}

// ===== CONTEXT-AWARE SUGGESTIONS =====
export function generateSmartSuggestions(
  activeFilters: {
    skills: string[];
    experience_min: number | null;
    location: string | null;
    domain: string | null;
    role: string | null;
  },
  candidates: { skills: string[]; domain: string; location: string; role: string; experience: number }[],
): string[] {
  const suggestions: string[] = [];

  // Analyze result data
  const skillCounts = new Map<string, number>();
  const domainCounts = new Map<string, number>();
  const locationCounts = new Map<string, number>();
  const experiences: number[] = [];

  for (const c of candidates) {
    for (const s of c.skills) {
      if (!activeFilters.skills.includes(s)) {
        skillCounts.set(s, (skillCounts.get(s) || 0) + 1);
      }
    }
    if (c.domain && c.domain !== activeFilters.domain) {
      domainCounts.set(c.domain, (domainCounts.get(c.domain) || 0) + 1);
    }
    const city = c.location.split(',')[0].trim();
    if (city && city !== activeFilters.location) {
      locationCounts.set(city, (locationCounts.get(city) || 0) + 1);
    }
    experiences.push(c.experience);
  }

  const sorted = (m: Map<string, number>) => [...m.entries()].sort((a, b) => b[1] - a[1]);
  const topSkills = sorted(skillCounts);
  const topDomains = sorted(domainCounts);
  const topLocations = sorted(locationCounts);

  // Only suggest what's NOT already filtered
  if (topSkills.length > 0 && candidates.length > 3) {
    suggestions.push(activeFilters.skills.length > 0
      ? `Also require ${topSkills[0][0]}`
      : `Filter by ${topSkills[0][0]} expertise`);
  }

  if (!activeFilters.experience_min && experiences.length > 0) {
    const avg = Math.round(experiences.reduce((a, b) => a + b, 0) / experiences.length);
    suggestions.push(`Show only ${Math.max(avg, 5)}+ years experience`);
  }

  if (!activeFilters.domain && topDomains.length > 0 && candidates.length > 2) {
    suggestions.push(`Filter by ${topDomains[0][0]} domain`);
  }

  if (!activeFilters.location && topLocations.length > 0 && candidates.length > 2) {
    suggestions.push(`Only ${topLocations[0][0]}-based candidates`);
  }

  if (candidates.length >= 2 && candidates.length <= 5) {
    suggestions.push('Compare these candidates');
  }

  if (activeFilters.location && candidates.length <= 3) {
    suggestions.push('Remove location filter');
  }

  if (suggestions.length < 2) {
    if (candidates.length === 0) {
      suggestions.push('Show all candidates', 'Reset all filters');
    } else {
      suggestions.push('Show me similar candidates');
    }
  }

  return [...new Set(suggestions)].slice(0, 4);
}
