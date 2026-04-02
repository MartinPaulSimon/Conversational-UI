// ===== PER-CANDIDATE REASONING ENGINE =====
// LLM explains WHY each candidate matches — not hardcoded bullets

import OpenAI from 'openai';
import { isLLMAvailable } from './openai';

const LLM_MODEL = 'qwen/qwen3.6-plus-preview:free';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

interface CandidateProfile {
  name: string;
  role: string;
  skills: string[];
  experience: number;
  location: string;
  domain: string;
  company: string | null;
  education: string | null;
  finalScore: number;
}

interface Intent {
  semantic?: {
    skills?: string[];
    role?: string;
    domain?: string;
  };
  explanation?: string;
}

export async function generateReasoning(
  candidate: CandidateProfile,
  intent: Intent
): Promise<string[]> {
  // Fallback: smart template-based reasoning (no LLM cost)
  if (!isLLMAvailable()) {
    return generateFallbackReasoning(candidate, intent);
  }

  try {
    const prompt = `You are a senior recruiter evaluating a candidate.

Candidate:
- Name: ${candidate.name}
- Role: ${candidate.role}
- Skills: ${candidate.skills.join(', ')}
- Experience: ${candidate.experience} years
- Location: ${candidate.location}
- Domain: ${candidate.domain}
- Company: ${candidate.company || 'N/A'}
- Education: ${candidate.education || 'N/A'}
- Match Score: ${candidate.finalScore}%

What the recruiter is looking for:
${intent.explanation || JSON.stringify(intent.semantic || {})}

Give exactly 3 concise bullet points explaining why this candidate is a strong match.
Be specific — mention their actual skills, company, and experience.
Return ONLY a JSON object with a "reasons" key containing an array of 3 strings. No markdown, no code fences.`;

    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.4,
      max_tokens: 300,
    });

    const raw = res.choices[0].message.content || '{}';
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    const parsed = JSON.parse(cleaned);

    // Handle both { "reasons": [...] } and [...] formats
    if (Array.isArray(parsed)) return parsed.slice(0, 3);
    if (parsed.reasons && Array.isArray(parsed.reasons)) return parsed.reasons.slice(0, 3);
    if (parsed.bullets && Array.isArray(parsed.bullets)) return parsed.bullets.slice(0, 3);

    // If it's an object with numbered keys
    const values = Object.values(parsed).filter(v => typeof v === 'string');
    if (values.length > 0) return (values as string[]).slice(0, 3);

    return generateFallbackReasoning(candidate, intent);
  } catch (error) {
    console.error('Reasoning generation failed:', error);
    return generateFallbackReasoning(candidate, intent);
  }
}

// Smart fallback — still contextual, just not LLM-powered
function generateFallbackReasoning(candidate: CandidateProfile, intent: Intent): string[] {
  const reasons: string[] = [];
  const requiredSkills = intent?.semantic?.skills || [];

  // Skill match
  if (requiredSkills.length > 0) {
    const matched = candidate.skills.filter(s =>
      requiredSkills.some(r => s.toLowerCase().includes(r.toLowerCase()))
    );
    if (matched.length > 0) {
      reasons.push(`Strong ${matched.join(', ')} expertise — directly matches requirements`);
    }
  }

  // Company + experience
  if (candidate.company) {
    reasons.push(`${candidate.experience} years at ${candidate.company} — proven ${candidate.domain} domain experience`);
  } else {
    reasons.push(`${candidate.experience} years of ${candidate.role} experience`);
  }

  // Education or trajectory
  if (candidate.education) {
    reasons.push(`${candidate.education} — solid academic foundation`);
  } else {
    reasons.push(`Strong career trajectory with consistent growth`);
  }

  return reasons.slice(0, 3);
}

// Batch reasoning for multiple candidates (with LLM cost control)
export async function generateBatchReasoning(
  candidates: CandidateProfile[],
  intent: Intent,
  maxLLMCalls: number = 3
): Promise<Map<string, string[]>> {
  const reasoningMap = new Map<string, string[]>();

  // Top candidates get LLM reasoning, rest get fallback
  const topCandidates = candidates.slice(0, maxLLMCalls);
  const restCandidates = candidates.slice(maxLLMCalls);

  // LLM reasoning for top candidates (parallel)
  const llmResults = await Promise.all(
    topCandidates.map(async c => ({
      name: c.name,
      reasoning: await generateReasoning(c, intent),
    }))
  );

  for (const r of llmResults) {
    reasoningMap.set(r.name, r.reasoning);
  }

  // Fallback for the rest
  for (const c of restCandidates) {
    reasoningMap.set(c.name, generateFallbackReasoning(c, intent));
  }

  return reasoningMap;
}
