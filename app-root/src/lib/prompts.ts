// LLM Prompt Templates from the Executable Spec

export const SYSTEM_PROMPT = `You are an AI recruiter engine called NestRecruit. Your goal is to:
- Understand hiring intent from natural language queries
- Extract structured filters (skills, experience, location, domain, role)
- Identify semantic meaning beyond keywords
- Suggest refinements to improve search results
- Generate professional recruiter-style responses

Response Style: Professional, insight-driven, non-chatbot tone. Example:
"I found strong matches based on your requirements. Would you like me to refine further by domain or availability?"

IMPORTANT: Always respond with valid JSON in the specified format.`;

export const INTENT_EXTRACTION_PROMPT = `Given the user's query and conversation context, extract:
- filters: { skills: string[], experience_min: number | null, experience_max: number | null, location: string | null, domain: string | null, role: string | null }
- semantic_intent: A brief description of what the user is truly looking for
- ranking_priorities: Array of factors to prioritize (e.g., "skill_match", "experience", "domain_expertise")
- is_refinement: boolean - whether this is refining a previous search

Return JSON only. No markdown, no explanation.

Previous filters: {previousFilters}
Previous results count: {previousResultsCount}

User query: {query}`;

export const JD_PARSING_PROMPT = `Extract the following from this Job Description:
- role: The job title/role
- skills: Array of required skills and technologies
- experience: Required years of experience (as a string like "3-5 years")
- domain: The industry/domain
- responsibilities: Array of key responsibilities
- nice_to_have: Array of preferred/bonus qualifications

Return structured JSON only. No markdown, no explanation.

Job Description:
{jdText}`;

export const REASONING_PROMPT = `Given a candidate's profile and the search criteria, explain why this candidate is a strong match in 3-5 concise bullet points. Focus on:
- Skill alignment
- Experience relevance
- Domain expertise
- Growth trajectory
- Unique strengths

Be specific and data-driven. Use professional recruiter language.

Search criteria: {criteria}
Candidate profile: {profile}

Return a JSON array of strings (the bullet points). No markdown.`;

export const RESPONSE_GENERATION_PROMPT = `Generate a professional recruiter-style conversational response based on:
- User query: {query}
- Number of results found: {resultCount}
- Top candidates summary: {topCandidates}
- Applied filters: {filters}
- Suggestions for refinement: {suggestions}

Requirements:
- Professional, insight-driven tone
- Mention key findings
- Suggest next steps naturally
- If no results, explain why and suggest alternatives
- Keep it concise (2-4 sentences)

Return JSON: { "message": "your response", "suggestions": ["suggestion1", "suggestion2", "suggestion3"] }`;
