import 'dotenv/config';
import { Readability } from '@mozilla/readability';
import { JSDOM } from 'jsdom';
import { fetch } from 'undici';
import OpenAI from 'openai';
import { z } from 'zod';
import pLimit from 'p-limit';

const CONCURRENCY = 3;                   
const MODEL = 'gpt-4o-mini';      
const USER_AGENT = 'Mozilla/5.0 (ArticleScraper/1.0; +https://example.com/bot)';


const URLS: string[] = [
  'https://www.lennysnewsletter.com/',
  'https://tldr.tech/',
];

const ArticleSchema = z.object({
  id: z.string(),
  url: z.string().url(),
  publishedDate: z.string().datetime().optional(),
  author: z.string().optional(),
  title: z.string(),
  text: z.string(),
  summary: z.string(),
});

// ---------- Types ----------
type Article = z.infer<typeof ArticleSchema>;

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

// ---------- Utilities ----------
async function getHtml(url: string): Promise<string> {
  const res = await fetch(url, {
    headers: { 'User-Agent': USER_AGENT, 'Accept': 'text/html,application/xhtml+xml' },
  });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${url}: ${res.status} ${res.statusText}`);
  }
  return await res.text();
}

function extractArticleFromHtml(url: string, html: string) {
  const dom = new JSDOM(html, { url });
  const reader = new Readability(dom.window.document);
  const article = reader.parse();
  if (!article) {
    throw new Error(`Readability failed to parse ${url}`);
  }
  const contentText = stripHtml(article.content);
  return {
    url,
    title: article.title || dom.window.document.title || '',
    byline: article.byline || null,
    contentText,
  };
}

function stripHtml(html: string): string {
  // Cheap HTML -> text; good enough since Readability already reduced noise
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

// ---------- LLM normalization ----------
async function normalizeWithLLM(raw: {
  url: string;
  title: string;
  byline: string | null;
  contentText: string;
}): Promise<Article> {
  const wordCount = raw.contentText.split(/\s+/).filter(Boolean).length;

  const system = `You are a careful information extraction assistant. 
Return STRICT JSON only that conforms to the provided JSON schema. 
If a field is unknown, leave it null or an empty list as appropriate. 
Use ISO 8601 for dates.`;

  // We’ll ask for JSON-only output and validate with Zod
  const user = {
    role: 'user' as const,
    content: [
      {
        type: 'text',
        text:
`Normalize this article into the target schema.

TARGET_SCHEMA (TypeScript/Zod shape):
{
  url: string (original URL),
  title: string,
  author?: string | null,
  publishedAt?: string | null (ISO 8601),
  summary: string (3–6 sentences),
  topics: string[],
  entities: { name: string; type: "PERSON"|"ORG"|"LOCATION"|"EVENT"|"WORK_OF_ART"|"LAW"|"PRODUCT"|"OTHER" }[],
  sentiment?: "positive"|"neutral"|"negative",
  wordCount: number
}

ARTICLE_RAW:
- url: ${raw.url}
- title: ${raw.title}
- byline: ${raw.byline ?? 'null'}
- wordCount: ~${wordCount}

CONTENT:
${raw.contentText.slice(0, 24_000)}`
      }
    ]
  };

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages: [
      { role: 'system', content: system },
      user,
    ],
    response_format: { type: 'json_object' },
    temperature: 0.1,
  });

  const json = completion.choices[0]?.message?.content ?? '{}';

  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch (e) {
    // Fallback minimal object if model ever drifts
    parsed = { url: raw.url, title: raw.title || 'Untitled', summary: '', topics: [], entities: [], wordCount };
  }

  // Ensure required props exist even if model omitted something
  const candidate = {
    url: raw.url,
    title: (parsed as any)?.title ?? raw.title ?? 'Untitled',
    author: (parsed as any)?.author ?? raw.byline ?? null,
    publishedAt: (parsed as any)?.publishedAt ?? null,
    summary: (parsed as any)?.summary ?? '',
    topics: (parsed as any)?.topics ?? [],
    entities: (parsed as any)?.entities ?? [],
    sentiment: (parsed as any)?.sentiment ?? undefined,
    wordCount,
  };

  // Validate/clean with Zod
  return ArticleSchema.parse(candidate);
}

// ---------- Orchestrator ----------
async function processUrl(url: string): Promise<Article> {
  const html = await getHtml(url);
  const raw = extractArticleFromHtml(url, html);
  const normalized = await normalizeWithLLM(raw);
  return normalized;
}

async function main() {
  if (!process.env.OPENAI_API_KEY) {
    throw new Error('Missing OPENAI_API_KEY in .env');
  }

  const limit = pLimit(CONCURRENCY);
  const jobs = URLS.map((u) =>
    limit(async () => {
      try {
        const article = await processUrl(u);
        console.log(`✅ Processed: ${u}`);
        return { ok: true as const, value: article };
      } catch (err) {
        console.error(`❌ Failed: ${u}`, err);
        return { ok: false as const, error: (err as Error).message, url: u };
      }
    })
  );

  const results = await Promise.all(jobs);

  const cleaned = results
    .filter(r => r.ok)
    .map(r => (r as any).value as Article);

  // Persist or pass along — here we just print JSON
  // You could write to a DB, file, or queue.
  console.log('\n=== NORMALIZED ARTICLES (JSON) ===\n');
  console.log(JSON.stringify(cleaned, null, 2));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
