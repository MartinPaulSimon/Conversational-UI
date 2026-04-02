import { NextRequest, NextResponse } from 'next/server';
import prisma from '@/lib/prismaClient';
import { isLLMAvailable } from '@/lib/openai';
import OpenAI from 'openai';

const LLM_MODEL = 'qwen/qwen3.6-plus-preview:free';

const client = new OpenAI({
  baseURL: 'https://openrouter.ai/api/v1',
  apiKey: process.env.OPENROUTER_API_KEY,
});

// Extract text from file
async function extractFileText(file: File): Promise<string> {
  const name = file.name.toLowerCase();
  
  if (name.endsWith('.pdf')) {
    const buffer = await file.arrayBuffer();
    const bytes = new Uint8Array(buffer);
    const text = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
    
    const textParts: string[] = [];
    const readableStrings = text.match(/[A-Za-z][A-Za-z\s,.\-/+#]{3,}/g);
    if (readableStrings) {
      for (const s of readableStrings) {
        if (s.trim().length > 3 && !/obj|stream|endobj|xref|trailer|PDF-|%%EOF/.test(s)) {
          textParts.push(s.trim());
        }
      }
    }
    return textParts.length > 0 ? [...new Set(textParts)].join(' ') : '';
  }
  
  return await file.text();
}

// LLM JD parsing
async function parseJDWithLLM(text: string) {
  if (!isLLMAvailable()) return null;

  try {
    const res = await client.chat.completions.create({
      model: LLM_MODEL,
      messages: [{
        role: 'user',
        content: `Extract the following from this Job Description and return ONLY valid JSON (no markdown, no code fences):
{
  "role": "job title",
  "skills": ["skill1", "skill2"],
  "experience": "years required as string",
  "domain": "industry/domain",
  "responsibilities": ["resp1"],
  "nice_to_have": ["bonus1"]
}

Job Description:
${text}

RESPOND WITH ONLY THE JSON OBJECT. NO OTHER TEXT.`,
      }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const raw = res.choices[0].message.content || '{}';
    const cleaned = raw.replace(/\`\`\`json\s*/gi, '').replace(/\`\`\`\s*/g, '').trim();
    return JSON.parse(cleaned);
  } catch (error) {
    console.error('JD LLM parse failed:', error);
    return null;
  }
}

// Fallback JD parser
function parseJDFallback(text: string) {
  const lower = text.toLowerCase();
  
  const skillMap: Record<string, string> = {
    'react': 'React', 'node.js': 'Node.js', 'python': 'Python', 'java': 'Java',
    'typescript': 'TypeScript', 'aws': 'AWS', 'docker': 'Docker', 'kubernetes': 'Kubernetes',
    'go': 'Go', 'rust': 'Rust', 'sql': 'SQL', 'pytorch': 'PyTorch', 'tensorflow': 'TensorFlow',
    'next.js': 'Next.js', 'spring boot': 'Spring Boot', 'terraform': 'Terraform',
    'kafka': 'Kafka', 'machine learning': 'Machine Learning', 'nlp': 'NLP',
    'fastapi': 'FastAPI', 'vue': 'Vue', 'angular': 'Angular', 'figma': 'Figma',
    'swift': 'Swift', 'kotlin': 'Kotlin', 'flutter': 'Flutter',
  };
  
  const skills: string[] = [];
  for (const [kw, skill] of Object.entries(skillMap)) {
    if (lower.includes(kw) && !skills.includes(skill)) skills.push(skill);
  }
  
  let experience = 'Not specified';
  const expMatch = text.match(/(\d+)\+?\s*(?:years?|yrs?)/i);
  if (expMatch) experience = `${expMatch[1]}+ years`;
  
  let role = 'Software Engineer';
  const firstLine = text.split(/[\n\r]+/).find(l => l.trim().length > 3 && l.trim().length < 60);
  if (firstLine && !/^(the|we|our|this)/i.test(firstLine.trim())) role = firstLine.trim();
  
  const domainMap: Record<string, string> = {
    'fintech': 'FinTech', 'healthcare': 'Healthcare', 'e-commerce': 'E-commerce',
    'ai': 'AI/ML', 'machine learning': 'AI/ML', 'banking': 'Banking', 'saas': 'SaaS',
  };
  let domain = 'Technology';
  for (const [k, v] of Object.entries(domainMap)) { if (lower.includes(k)) { domain = v; break; } }
  
  return {
    role, skills: skills.length > 0 ? skills : ['Problem Solving'], experience, domain,
    responsibilities: ['Design and develop software', 'Collaborate with teams'],
    nice_to_have: ['Open source contributions'],
  };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const text = formData.get('text') as string | null;
    
    let jdText = text || '';
    let isPdf = false;
    
    if (file) {
      isPdf = file.name.toLowerCase().endsWith('.pdf');
      jdText = await extractFileText(file);
    }
    
    if (!jdText.trim()) {
      if (isPdf) {
        return NextResponse.json({
          parsed: { role: 'Unable to extract from PDF', skills: [], experience: 'Not specified', domain: 'Unknown', responsibilities: [], nice_to_have: [] },
          message: `Couldn't extract text from this PDF. Please upload a .txt file or paste the JD text directly.`,
        });
      }
      return NextResponse.json({ error: 'JD text or file is required' }, { status: 400 });
    }
    
    // Parse with LLM or fallback
    const llmParsed = await parseJDWithLLM(jdText);
    const parsed = llmParsed || parseJDFallback(jdText);
    
    // Update session
    let session = await prisma.session.findUnique({ where: { id } });
    if (!session) {
      session = await prisma.session.create({ data: { id } });
    }
    
    await prisma.session.update({
      where: { id },
      data: {
        jdRole: parsed.role,
        jdSkills: parsed.skills,
        jdExperience: parsed.experience,
        jdDomain: parsed.domain,
        jdResponsibilities: parsed.responsibilities || [],
        filterSkills: parsed.skills,
        filterDomain: parsed.domain !== 'Technology' ? parsed.domain : session.filterDomain,
      },
    });
    
    const skillList = parsed.skills.length > 0 ? parsed.skills.join(', ') : 'general skills';
    
    return NextResponse.json({
      parsed,
      message: `Analyzed JD for "${parsed.role}". Key skills: ${skillList}. Domain: ${parsed.domain}.${parsed.experience !== 'Not specified' ? ` Experience: ${parsed.experience}.` : ''} Ready to search for candidates?`,
      llmPowered: isLLMAvailable(),
    });
  } catch (error) {
    console.error('JD parse error:', error);
    return NextResponse.json({ error: 'Failed to parse JD' }, { status: 500 });
  }
}
