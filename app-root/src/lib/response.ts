// ===== NATURAL RESPONSE GENERATOR =====
// Rich, multi-line recruiter conversation + context-aware follow-up questions

import OpenAI from 'openai';
import { isLLMAvailable } from './openai';

const LLM_MODEL = 'qwen/qwen3.6-plus-preview:free';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface ResponseContext {
  userQuery: string;
  intent: {
    intent?: string;
    explanation?: string;
    requested_count?: number | null;
    semantic?: {
      skills?: string[];
      role?: string;
      domain?: string;
    };
    filters?: {
      location?: string | null;
      experience_min?: number | null;
    };
  };
  candidateCount: number;
  totalInDB?: number;
  topCandidates: { name: string; role: string; finalScore: number; company: string | null; experience: number; location: string; domain: string; skills: string[] }[];
  activeFilters: {
    skills: string[];
    experience_min: number | null;
    location: string | null;
    domain: string | null;
    role: string | null;
  };
  suggestions: string[];
  requestedCount?: number | null;
}

export async function generateResponse(ctx: ResponseContext): Promise<{
  message: string;
  suggestions: string[];
  followUps: string[];
}> {
  if (!isLLMAvailable()) {
    return generateFallbackResponse(ctx);
  }

  const candidateSummary = ctx.topCandidates.slice(0, 5)
    .map(c => `- ${c.name}: ${c.role}, ${c.experience}yrs at ${c.company || 'N/A'}, ${c.location}, domain: ${c.domain}, skills: ${c.skills.slice(0, 4).join(', ')}, ${c.finalScore}% match`)
    .join('\n');

  const filterSummary = [];
  if (ctx.activeFilters.skills.length > 0) filterSummary.push(`skills: ${ctx.activeFilters.skills.join(', ')}`);
  if (ctx.activeFilters.location) filterSummary.push(`location: ${ctx.activeFilters.location}`);
  if (ctx.activeFilters.domain) filterSummary.push(`domain: ${ctx.activeFilters.domain}`);
  if (ctx.activeFilters.experience_min) filterSummary.push(`${ctx.activeFilters.experience_min}+ years`);
  if (ctx.activeFilters.role) filterSummary.push(`role: ${ctx.activeFilters.role}`);

  // Build context for smart follow-up generation
  const candidateDomains = [...new Set(ctx.topCandidates.map(c => c.domain).filter(Boolean))];
  const candidateLocations = [...new Set(ctx.topCandidates.map(c => c.location.split(',')[0].trim()).filter(Boolean))];
  const candidateCompanies = [...new Set(ctx.topCandidates.map(c => c.company).filter(Boolean))];

  const prompt = `You are NestRecruit — a senior AI recruiter assistant who speaks like a real human recruiter.

USER QUERY: "${ctx.userQuery}"

SEARCH DATA:
- Candidates shown: ${ctx.candidateCount}${ctx.totalInDB ? ` (${ctx.totalInDB} total matched)` : ''}
- Active filters: ${filterSummary.length > 0 ? filterSummary.join(', ') : 'none'}
- Candidate domains: ${candidateDomains.join(', ') || 'mixed'}
- Candidate locations: ${candidateLocations.join(', ') || 'various'}
- Companies represented: ${candidateCompanies.join(', ') || 'various'}
${ctx.candidateCount > 0 ? `\nCANDIDATES:\n${candidateSummary}` : '\nNo candidates matched.'}

RESPOND WITH:

1. "message": 2-4 rich sentences (mention candidates by name, their company, and what makes them stand out)

2. "suggestions": 3-4 actionable refinement chips (DIFFERENT from active filters)

3. "followUps": EXACTLY 2-3 context-aware questions that help the recruiter think deeper about their search. These must be:
   - DIFFERENT from each other (cover different dimensions like: company type, domain, experience, availability, remote/onsite, notice period, team fit)
   - RELEVANT to the current search — reference actual data from the candidates shown
   - NOT repeat what's already filtered (don't ask about location if location is already set)
   
   Examples of GOOD follow-up questions based on context:
   ${!ctx.activeFilters.domain ? `- "Are you looking for candidates from a specific domain? I see profiles across ${candidateDomains.slice(0, 2).join(' and ')}."` : ''}
   ${!ctx.activeFilters.location ? `- "These candidates are spread across ${candidateLocations.slice(0, 2).join(' and ')} — do you have a location preference?"` : ''}
   ${ctx.activeFilters.location ? `- "Would you also consider remote candidates, or strictly ${ctx.activeFilters.location}-based?"` : ''}
   - "Do you prefer candidates from product-based companies like ${candidateCompanies[0] || 'Google'}, or are service companies fine too?"
   - "What's more important — deep expertise in ${ctx.activeFilters.skills[0] || 'the primary skill'} or a broader full-stack profile?"
   - "Do you want candidates who can join immediately, or is a 30-60 day notice period acceptable?"
   - "Should I prioritize candidates from tier-1 companies, or is skill match more important?"

Return ONLY valid JSON (no markdown, no code fences, no explanation):
{
  "message": "rich response",
  "suggestions": ["chip1", "chip2", "chip3"],
  "followUps": ["question1", "question2", "question3"]
}

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;

  try {
    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.7,
      max_tokens: 700,
    });

    const raw = res.choices[0].message.content || '{}';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Handle both followUps (array) and followUp (single string) from LLM
    let followUps: string[] = [];
    if (Array.isArray(parsed.followUps)) followUps = parsed.followUps;
    else if (Array.isArray(parsed.followUp)) followUps = parsed.followUp;
    else if (typeof parsed.followUp === 'string') followUps = [parsed.followUp];
    else if (typeof parsed.followUps === 'string') followUps = [parsed.followUps];

    return {
      message: parsed.message || generateFallbackResponse(ctx).message,
      suggestions: Array.isArray(parsed.suggestions) && parsed.suggestions.length > 0
        ? parsed.suggestions.slice(0, 4)
        : ctx.suggestions,
      followUps: followUps.slice(0, 3),
    };
  } catch (error) {
    console.error('Response generation failed:', error);
    return generateFallbackResponse(ctx);
  }
}

// ===== SMART FALLBACK FOLLOW-UP GENERATOR =====
function generateContextFollowUps(ctx: ResponseContext): string[] {
  const followUps: string[] = [];
  const top = ctx.topCandidates;
  const filters = ctx.activeFilters;

  // Analyze candidate data for smart questions
  const domains = [...new Set(top.map(c => c.domain).filter(Boolean))];
  const locations = [...new Set(top.map(c => c.location.split(',')[0].trim()).filter(Boolean))];
  const companies = [...new Set(top.map(c => c.company).filter(Boolean))];
  const avgExp = top.length > 0
    ? Math.round(top.reduce((a, c) => a + c.experience, 0) / top.length)
    : 0;

  // Domain question (only if not already filtered)
  if (!filters.domain && domains.length > 1) {
    followUps.push(`I see candidates from ${domains.slice(0, 2).join(' and ')} domains — do you have a specific industry preference?`);
  } else if (!filters.domain && domains.length === 1) {
    followUps.push(`All matches are in ${domains[0]} — should I also look at candidates from other domains?`);
  }

  // Location question
  if (filters.location) {
    followUps.push(`Would you also consider remote candidates, or strictly ${filters.location}-based?`);
  } else if (locations.length > 1) {
    followUps.push(`These candidates are in ${locations.slice(0, 3).join(', ')} — do you have a location or timezone preference?`);
  }

  // Company type question
  if (companies.length > 0) {
    const hasTopCo = companies.some(c => ['Google', 'Microsoft', 'Amazon', 'Meta', 'Apple', 'Razorpay', 'Freshworks'].includes(c!));
    if (hasTopCo) {
      followUps.push(`Should I prioritize candidates from product-based companies like ${companies[0]}, or is skill match more important?`);
    } else {
      followUps.push(`Do you prefer candidates from product companies, or are service/consulting backgrounds acceptable?`);
    }
  }

  // Experience question (only if not already filtered)
  if (!filters.experience_min && avgExp > 0) {
    followUps.push(`The average experience here is ${avgExp} years — do you need more senior profiles, or is this the right range?`);
  }

  // Availability question
  if (followUps.length < 3) {
    followUps.push(`Do you need candidates who can join immediately, or is a 30-60 day notice period fine?`);
  }

  // Skill depth question
  if (filters.skills.length > 0 && followUps.length < 3) {
    followUps.push(`What's more important — deep expertise in ${filters.skills[0]}, or a broader full-stack profile?`);
  }

  // Deduplicate and return 2-3
  return [...new Set(followUps)].slice(0, 3);
}

// Fallback response generator
function generateFallbackResponse(ctx: ResponseContext): {
  message: string;
  suggestions: string[];
  followUps: string[];
} {
  const count = ctx.candidateCount;
  const top = ctx.topCandidates;
  const topNames = top.slice(0, 3).map(c => c.name).join(', ');
  const reqCount = ctx.requestedCount;

  let message: string;

  if (ctx.intent.intent === 'greeting') {
    message = `Hello! I'm your AI recruiting assistant. Tell me what you're looking for — skills, experience level, location, domain — and I'll find the best-fit candidates from our database. You can also upload a Job Description to get started instantly.`;
    return {
      message,
      suggestions: ctx.suggestions,
      followUps: [
        'What role are you currently hiring for?',
        'Do you have a Job Description you can upload?',
        'Any specific tech stack or location in mind?',
      ],
    };
  }

  if (ctx.intent.intent === 'reset') {
    message = `All filters cleared — fresh start! What kind of talent are you looking for today?`;
    return {
      message,
      suggestions: ctx.suggestions,
      followUps: [
        'What role or skills are you looking for?',
        'Any preferred location or domain focus?',
      ],
    };
  }

  if (count === 0) {
    const parts: string[] = [];
    if (ctx.activeFilters.skills.length > 0) parts.push(ctx.activeFilters.skills.join(', '));
    if (ctx.activeFilters.location) parts.push(ctx.activeFilters.location);
    if (ctx.activeFilters.domain) parts.push(ctx.activeFilters.domain);
    message = parts.length > 0
      ? `I wasn't able to find exact matches for ${parts.join(' + ')} in our current database. This combination might be too specific — would you like me to relax some of these criteria?`
      : `I couldn't find matches for that query. Try specifying the skills, role, or location you need.`;
    const followUps: string[] = [];
    if (ctx.activeFilters.location) followUps.push(`Would you like me to search across all locations instead of just ${ctx.activeFilters.location}?`);
    if (ctx.activeFilters.skills.length > 0) followUps.push(`Should I broaden the search to include related technologies alongside ${ctx.activeFilters.skills[0]}?`);
    if (ctx.activeFilters.domain) followUps.push(`Want me to drop the ${ctx.activeFilters.domain} domain filter and search across all industries?`);
    if (followUps.length < 2) followUps.push('Should I show the closest available matches instead?');
    return { message, suggestions: ctx.suggestions, followUps: followUps.slice(0, 3) };
  }

  if (reqCount) {
    const topCandidate = top[0];
    message = `Here are the top ${count} candidates I've handpicked for you. ${topCandidate?.name} leads the pack${topCandidate?.company ? ` with their experience at ${topCandidate.company}` : ''} — ${topCandidate?.experience} years of solid experience. ${count > 1 ? `The other profiles bring complementary strengths in ${ctx.activeFilters.skills.length > 0 ? ctx.activeFilters.skills[0] : 'the required stack'}.` : ''} Let me know if you'd like a deeper look.`;
  } else if (count <= 3) {
    const topCandidate = top[0];
    message = `I found ${count} strong candidate${count > 1 ? 's' : ''} that closely match${count === 1 ? 'es' : ''} your requirements. ${topCandidate?.name} is the standout — ${topCandidate?.experience} years${topCandidate?.company ? ` at ${topCandidate.company}` : ''}, with strong alignment on ${ctx.activeFilters.skills.length > 0 ? ctx.activeFilters.skills.slice(0, 2).join(' and ') : 'the key skills'}.${count > 1 ? ` ${topNames.split(', ').slice(1).join(' and ')} also bring impressive profiles.` : ''}`;
  } else {
    const topCandidate = top[0];
    const desc: string[] = [];
    if (ctx.activeFilters.skills.length > 0) desc.push(ctx.activeFilters.skills.join(', '));
    if (ctx.activeFilters.location) desc.push(ctx.activeFilters.location);
    if (ctx.activeFilters.domain) desc.push(ctx.activeFilters.domain);
    message = `Great results — ${count} candidates match${desc.length > 0 ? ` your search for ${desc.join(', ')}` : ''}. ${topCandidate?.name} tops the list${topCandidate?.company ? ` with a strong track record at ${topCandidate.company}` : ''} and ${topCandidate?.experience} years of experience.`;
  }

  return {
    message,
    suggestions: ctx.suggestions,
    followUps: generateContextFollowUps(ctx),
  };
}
