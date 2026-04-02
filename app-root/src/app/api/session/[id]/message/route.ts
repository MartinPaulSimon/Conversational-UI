import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prismaClient';
import { extractIntent, isLLMAvailable } from '@/lib/openai';
import { rankCandidates, generateSmartSuggestions } from '@/lib/ranking';
import { generateBatchReasoning } from '@/lib/reasoning';
import { generateResponse } from '@/lib/response';

// ===== TYPES =====
interface Filters {
  skills: string[];
  experience_min: number | null;
  experience_max: number | null;
  location: string | null;
  domain: string | null;
  role: string | null;
}

// ===== FALLBACK INTENT EXTRACTION (no LLM) =====
const SKILL_MAP: Record<string, string> = {
  'react': 'React', 'reactjs': 'React', 'react.js': 'React',
  'node': 'Node.js', 'nodejs': 'Node.js', 'node.js': 'Node.js',
  'python': 'Python', 'java': 'Java', 'typescript': 'TypeScript', 'javascript': 'JavaScript',
  'aws': 'AWS', 'docker': 'Docker', 'kubernetes': 'Kubernetes', 'k8s': 'Kubernetes',
  'go': 'Go', 'golang': 'Go', 'rust': 'Rust', 'sql': 'SQL',
  'postgresql': 'PostgreSQL', 'mongodb': 'MongoDB', 'redis': 'Redis', 'graphql': 'GraphQL',
  'tensorflow': 'TensorFlow', 'pytorch': 'PyTorch', 'next.js': 'Next.js', 'nextjs': 'Next.js',
  'spring boot': 'Spring Boot', 'microservices': 'Microservices',
  'terraform': 'Terraform', 'kafka': 'Kafka', 'airflow': 'Airflow', 'spark': 'Spark',
  'machine learning': 'Machine Learning', 'ml': 'Machine Learning',
  'nlp': 'NLP', 'llm': 'LLM', 'llms': 'LLM', 'fastapi': 'FastAPI',
  'vue': 'Vue', 'angular': 'Angular', 'figma': 'Figma',
  'selenium': 'Selenium', 'cypress': 'Cypress', 'solidity': 'Solidity',
  'swift': 'Swift', 'kotlin': 'Kotlin', 'flutter': 'Flutter',
  'react native': 'React Native', 'ci/cd': 'CI/CD', 'devops': 'DevOps',
  'langchain': 'LangChain', 'rag': 'RAG',
};

const LOCATIONS: Record<string, string> = {
  'bangalore': 'Bangalore', 'bengaluru': 'Bangalore', 'mumbai': 'Mumbai',
  'delhi': 'Delhi', 'hyderabad': 'Hyderabad', 'pune': 'Pune', 'chennai': 'Chennai',
  'india': 'India', 'san francisco': 'San Francisco', 'new york': 'New York',
  'seattle': 'Seattle', 'austin': 'Austin', 'usa': 'USA', 'london': 'London',
  'berlin': 'Berlin', 'germany': 'Germany', 'dubai': 'Dubai', 'tokyo': 'Tokyo',
  'seoul': 'Seoul', 'remote': 'Remote',
};

const DOMAINS: Record<string, string> = {
  'fintech': 'FinTech', 'finance': 'FinTech', 'ai/ml': 'AI/ML',
  'artificial intelligence': 'AI/ML', 'machine learning': 'AI/ML',
  'e-commerce': 'E-commerce', 'ecommerce': 'E-commerce',
  'healthcare': 'Healthcare', 'banking': 'Banking', 'saas': 'SaaS',
  'cybersecurity': 'Cybersecurity', 'cloud computing': 'Cloud Computing',
  'edtech': 'EdTech', 'gaming': 'Gaming', 'web3': 'Web3',
};

function extractIntentFallback(query: string) {
  const q = query.toLowerCase().trim();

  // Detect intent type
  let intentType = 'search';
  if (/^(hi|hello|hey|good morning|good afternoon|good evening)\b/.test(q)) intentType = 'greeting';
  else if (/^(yes|yeah|yep|sure|ok|okay|go ahead|proceed|alright|sounds good|perfect|great)\s*[.!]?$/.test(q)) intentType = 'refine';
  else if (/\b(show all|list all|all candidates|everyone|display all)\b/.test(q)) intentType = 'show_all';
  else if (/\b(reset|start over|clear|fresh start|new search|clear all)\b/.test(q)) intentType = 'reset';
  else if (/\b(broaden|relax|widen|expand|less strict|more results|broader)\b/.test(q)) intentType = 'broaden';
  else if (/\b(compare|versus|vs|side by side)\b/.test(q)) intentType = 'compare';

  // ===== PARSE REQUESTED COUNT =====
  // "give me 3 candidates", "show 5 engineers", "top 3", "find 10 developers"
  let requested_count: number | null = null;
  const countMatch = q.match(/(?:give\s+(?:me\s+)?|show\s+(?:me\s+)?|find\s+(?:me\s+)?|get\s+(?:me\s+)?|list\s+|top\s+)(\d+)/i);
  if (countMatch) requested_count = parseInt(countMatch[1]);
  // Also catch "3 candidates" at start
  const countMatch2 = q.match(/^(\d+)\s+(?:candidates?|engineers?|developers?|people|profiles?)/i);
  if (countMatch2 && !requested_count) requested_count = parseInt(countMatch2[1]);

  // Extract skills
  const skills: string[] = [];
  for (const [keyword, skill] of Object.entries(SKILL_MAP)) {
    const regex = keyword.length <= 2 ? new RegExp(`\\b${keyword}\\b`, 'i') : null;
    if (regex ? regex.test(q) : q.includes(keyword)) skills.push(skill);
  }

  // Extract location
  let location: string | null = null;
  for (const [kw, loc] of Object.entries(LOCATIONS)) { if (q.includes(kw)) { location = loc; break; } }

  // Extract domain
  let domain: string | null = null;
  for (const [kw, dom] of Object.entries(DOMAINS)) {
    const rx = kw.length <= 3 ? new RegExp(`\\b${kw}\\b`, 'i') : null;
    if (rx ? rx.test(q) : q.includes(kw)) { domain = dom; break; }
  }

  // ===== EXTRACT EXPERIENCE (with range support) =====
  let experience_min: number | null = null;
  let experience_max: number | null = null;

  // "5+ years" → min=5, no max
  const expPlus = q.match(/(\d+)\+\s*(?:years?|yrs?)/i);
  // "3-5 years" → min=3, max=5
  const expRange = q.match(/(\d+)\s*[-–to]+\s*(\d+)\s*(?:years?|yrs?)/i);
  // "3 years" (no +) → treat as approximately 3 years (range: years-2 to years+2)
  const expExact = q.match(/(\d+)\s*(?:years?|yrs?)\s*(?:of\s+)?(?:experience|exp)?/i);

  if (expRange) {
    experience_min = parseInt(expRange[1]);
    experience_max = parseInt(expRange[2]);
  } else if (expPlus) {
    experience_min = parseInt(expPlus[1]);
  } else if (expExact) {
    const years = parseInt(expExact[1]);
    // "3 years" means around 3 years, not 3+ (which would include 15-year veterans)
    experience_min = Math.max(years - 2, 0);
    experience_max = years + 3;
  }

  // Extract role
  let role: string | null = null;
  const rolePatterns: [RegExp, string][] = [
    [/\bfrontend\b|\bfront.?end\b/i, 'Frontend'], [/\bbackend\b|\bback.?end\b/i, 'Backend'],
    [/\bfull.?stack\b/i, 'Full Stack'], [/\bdevops\b/i, 'DevOps'],
    [/\bdata engineer/i, 'Data Engineer'], [/\bml engineer|ai engineer/i, 'ML Engineer'],
    [/\bmobile/i, 'Mobile'], [/\bqa\b|tester|testing/i, 'QA'],
    [/\bsecurity/i, 'Security'], [/\barchitect/i, 'Architect'],
    [/\bdesigner|product designer/i, 'Designer'], [/\bsenior\b/i, 'Senior'],
  ];
  for (const [rx, r] of rolePatterns) { if (rx.test(q)) { role = r; break; } }

  return {
    intent: intentType,
    is_refinement: intentType === 'refine',
    explanation: query,
    requested_count,
    filters: { location, experience_min, experience_max },
    semantic: { skills: [...new Set(skills)], role: role || '', domain: domain || '' },
  };
}

// ===== BUILD DB QUERY FROM INTENT =====
function buildEffectiveFilters(
  intent: ReturnType<typeof extractIntentFallback>,
  prevFilters: Filters,
  jdSkills: string[],
): Filters {
  switch (intent.intent) {
    case 'greeting':
      return { skills: [], experience_min: null, experience_max: null, location: null, domain: null, role: null };

    case 'reset':
    case 'show_all':
      return { skills: [], experience_min: null, experience_max: null, location: null, domain: null, role: null };

    case 'broaden':
      return { skills: prevFilters.skills.slice(0, 1), experience_min: null, experience_max: null, location: null, domain: null, role: null };

    case 'refine':
      // Merge new with previous
      return {
        skills: intent.semantic.skills.length > 0
          ? [...new Set([...prevFilters.skills, ...intent.semantic.skills])]
          : (prevFilters.skills.length > 0 ? prevFilters.skills : jdSkills),
        experience_min: intent.filters.experience_min ?? prevFilters.experience_min,
        experience_max: intent.filters.experience_max ?? prevFilters.experience_max,
        location: intent.filters.location ?? prevFilters.location,
        domain: intent.semantic.domain || prevFilters.domain,
        role: intent.semantic.role || prevFilters.role,
      };

    default: // 'search'
      return {
        skills: intent.semantic.skills,
        experience_min: intent.filters.experience_min,
        experience_max: intent.filters.experience_max,
        location: intent.filters.location,
        domain: intent.semantic.domain || null,
        role: intent.semantic.role || null,
      };
  }
}

// ===== SEARCH DATABASE =====
async function searchDatabase(filters: Filters, excludedIds: string[]) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {};

  if (excludedIds.length > 0) where.id = { notIn: excludedIds };
  if (filters.skills.length > 0) where.skills = { hasSome: filters.skills };
  if (filters.experience_min != null) where.experience = { ...(where.experience || {}), gte: filters.experience_min };
  if (filters.experience_max != null) where.experience = { ...(where.experience || {}), lte: filters.experience_max };
  if (filters.location) where.location = { contains: filters.location, mode: 'insensitive' };
  if (filters.domain) where.domain = { contains: filters.domain, mode: 'insensitive' };
  if (filters.role) where.role = { contains: filters.role, mode: 'insensitive' };

  return prisma.candidate.findMany({
    where,
    orderBy: [{ skillScore: 'desc' }, { trajectoryScore: 'desc' }],
    take: 10,
  });
}

// ==========================================================
// ===== THE PIPELINE: Intent → Filter → Rank → Reason → Response =====
// ==========================================================
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await request.json();
    const { message } = body;

    if (!message) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    // ===== 1. LOAD SESSION =====
    let session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      session = await prisma.session.create({ data: { id } });
    }

    const prevFilters: Filters = {
      skills: session.filterSkills,
      experience_min: session.filterExperienceMin,
      experience_max: session.filterExperienceMax,
      location: session.filterLocation,
      domain: session.filterDomain,
      role: session.filterRole,
    };

    // ===== 2. EXTRACT INTENT (LLM or fallback) =====
    const context = {
      previousFilters: prevFilters,
      previousResultCount: await prisma.message.count({ where: { sessionId: id, role: 'ai' } }),
      jdSkills: session.jdSkills,
      jdRole: session.jdRole || undefined,
    };

    const llmIntent = isLLMAvailable()
      ? await extractIntent(message, {
          previousFilters: { ...prevFilters },
          previousResultCount: await prisma.message.count({ where: { sessionId: id, role: 'ai' } }),
          jdSkills: session.jdSkills,
          jdRole: session.jdRole || undefined,
        })
      : null;

    const intent = llmIntent || extractIntentFallback(message);

    // ===== 3. BUILD FILTERS + SEARCH DATABASE =====
    const effectiveFilters = buildEffectiveFilters(intent, prevFilters, session.jdSkills);

    const dbCandidates = (intent.intent === 'greeting' || intent.intent === 'reset')
      ? []
      : await searchDatabase(effectiveFilters, session.excludedCandidates);

    // ===== 4. RANK CANDIDATES (🔥 CORE LOGIC) =====
    const ranked = rankCandidates(dbCandidates, intent);

    // Respect user's requested count: "give me 3" → show exactly 3
    const requestedCount = intent.requested_count || null;
    const displayCount = requestedCount ? Math.min(requestedCount, ranked.length) : Math.min(5, ranked.length);
    const topCandidates = ranked.slice(0, displayCount);

    // ===== 5. GENERATE REASONING + RESPONSE IN PARALLEL (🔥 SPEED) =====
    const reasoningPromise = generateBatchReasoning(topCandidates, intent, 3);
    const suggestionsResult = (intent.intent === 'greeting')
      ? ['Find React developers with 5+ years', 'Show me AI/ML engineers', 'Senior engineers in Bangalore', 'Full stack developers in FinTech']
      : (intent.intent === 'reset')
        ? ['Find Python developers', 'Show senior engineers', 'AI/ML candidates', 'Full stack developers']
        : generateSmartSuggestions(effectiveFilters, ranked);

    // Pre-build enriched candidates with placeholder reasoning (for response generation context)
    const preEnriched = topCandidates.map(c => ({
      id: c.id, name: c.name, role: c.role, skills: c.skills,
      experience: c.experience, location: c.location, domain: c.domain,
      company: c.company, education: c.education, finalScore: c.finalScore,
      factors: { skill: c.skillScore, role: c.roleScore, experience: c.experienceScore,
        domain: c.domainScore, trajectory: c.trajectoryScore, referral: c.referralScore, risk: c.riskScore },
      reasoning: c.reasoning,
    }));

    const responsePromise = generateResponse({
      userQuery: message, intent, candidateCount: displayCount,
      totalInDB: ranked.length, topCandidates: preEnriched,
      activeFilters: {
        skills: effectiveFilters.skills, experience_min: effectiveFilters.experience_min,
        location: effectiveFilters.location, domain: effectiveFilters.domain, role: effectiveFilters.role,
      },
      suggestions: suggestionsResult, requestedCount,
    });

    // Await both in parallel
    const [reasoningMap, response] = await Promise.all([reasoningPromise, responsePromise]);

    // Merge LLM reasoning into candidates
    const enriched = preEnriched.map(c => ({
      ...c,
      reasoning: reasoningMap.get(c.name) || c.reasoning,
    }));

    // ===== 6. SAVE TO DATABASE (parallel) =====
    await Promise.all([
      prisma.message.create({
        data: { sessionId: id, role: 'user', content: message },
      }),
      prisma.message.create({
        data: {
          sessionId: id, role: 'ai', content: response.message,
          candidateIds: enriched.map(c => c.id),
          suggestions: response.suggestions,
        },
      }),
    ]);

    await prisma.session.update({
      where: { id },
      data: {
        filterSkills: effectiveFilters.skills,
        filterExperienceMin: effectiveFilters.experience_min,
        filterExperienceMax: effectiveFilters.experience_max,
        filterLocation: effectiveFilters.location,
        filterDomain: effectiveFilters.domain,
        filterRole: effectiveFilters.role,
        semanticIntent: intent.explanation || message,
      },
    });

    // ===== 9. RESPOND =====
    return NextResponse.json({
      message: response.message,
      candidates: enriched,
      suggestions: response.suggestions,
      followUps: response.followUps,
      totalResults: displayCount,
      filters: effectiveFilters,
      llmPowered: isLLMAvailable(),
    });

  } catch (error) {
    console.error('Message API error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
