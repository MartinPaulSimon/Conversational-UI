import OpenAI from 'openai';

const LLM_MODEL = 'qwen/qwen3.6-plus-preview:free';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

export const isLLMAvailable = () => {
  return !!process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY !== 'your_openrouter_api_key_here';
};

// ===== INTENT EXTRACTION (STRICT JSON) =====
export async function extractIntent(
  input: string,
  context: {
    previousFilters?: Record<string, unknown>;
    previousResultCount?: number;
    jdSkills?: string[];
    jdRole?: string;
  }
) {
  if (!isLLMAvailable()) return null;

  const prompt = `You are an AI recruiter engine called NestRecruit.

Extract structured search intent from the user's query. Consider the conversation context.

You MUST return ONLY valid JSON (no markdown, no code fences, no explanation) in this exact format:
{
  "filters": {
    "location": "city or country or null",
    "experience_min": null,
    "experience_max": null
  },
  "semantic": {
    "skills": [],
    "role": "",
    "domain": ""
  },
  "intent": "search | refine | greeting | reset | show_all | compare | broaden",
  "is_refinement": false,
  "requested_count": null,
  "explanation": "brief description of what the user wants"
}

Rules:
- If user says "Bengaluru" or "Bangalore", set location to "Bangalore"
- If user mentions a technology, add to skills array
- If user says "senior", set role to contain "Senior"
- If no clear filter, leave as null or empty
- If user says "yes/sure/okay", intent is "refine" with is_refinement true
- If user says "reset/clear/start over", intent is "reset"
- If user says "show all/list all", intent is "show_all"
- If user says "give me 3" or "show 5" or "top 3" or "find 10", set requested_count to that number
- For "3 years experience" (exact, no +), set experience_min=1 and experience_max=6 (approximate range)
- For "5+ years", set experience_min=5 and experience_max=null
- For "3-5 years", set experience_min=3 and experience_max=5

Conversation context:
${JSON.stringify(context)}

User query: "${input}"

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`;

  try {
    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.2,
      max_tokens: 500,
    });

    const raw = res.choices[0].message.content || '{}';
    // Strip markdown code fences if present
    const cleaned = raw.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('Intent extraction failed:', error);
    return null;
  }
}

// ===== EMBEDDING (for future vector search) =====
export async function embedText(text: string): Promise<number[] | null> {
  if (!isLLMAvailable()) return null;

  try {
    const response = await client.embeddings.create({
      model: 'text-embedding-3-small',
      input: text,
    });
    return response.data[0]?.embedding || null;
  } catch (error) {
    console.error('Embedding failed:', error);
    return null;
  }
}

// ===== COSINE SIMILARITY =====
export function cosineSimilarity(a: number[], b: number[]): number {
  if (a.length !== b.length || a.length === 0) return 0;
  let dotProduct = 0, normA = 0, normB = 0;
  for (let i = 0; i < a.length; i++) {
    dotProduct += a[i] * b[i];
    normA += a[i] * a[i];
    normB += b[i] * b[i];
  }
  const denominator = Math.sqrt(normA) * Math.sqrt(normB);
  return denominator === 0 ? 0 : dotProduct / denominator;
}
