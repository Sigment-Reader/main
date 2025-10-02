
const URLS: string[] = [
  'https://www.lennysnewsletter.com/',
  'https://tldr.tech/',
];
import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { fetch } from 'undici';
import pLimit from 'p-limit';
import { JSDOM } from 'jsdom';

/* =========================
   Config
========================= */
const CONCURRENCY = 3;
const FIRECRAWL_API_URL = process.env.FIRECRAWL_API_URL!;
const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY!;
const PORT = Number(process.env.PORT || 3001);

if (!FIRECRAWL_API_URL || !FIRECRAWL_API_KEY) {
  throw new Error('Missing FIRECRAWL_API_URL or FIRECRAWL_API_KEY in .env');
}


const ArticleScrapeSchema = z.object({
  url: z.string().url(),
  publication: z.enum(['Lenny', 'TLDR']),
  title: z.string().min(1),
  subtitle: z.string().optional().nullable(),
  date: z.string().datetime().optional().nullable(), // ISO 8601 if known
  text: z.string().min(1),
});
type ArticleScrape = z.infer<typeof ArticleScrapeSchema>;


function hostnameToPublication(url: string): 'Lenny' | 'TLDR' {
  const u = new URL(url);
  if (u.hostname.includes('lennysnewsletter')) return 'Lenny';
  if (u.hostname.includes('tldr.tech')) return 'TLDR';
  return u.hostname.includes('substack') ? 'Lenny' : 'TLDR';
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function asISO(s: string | null | undefined): string | null {
  if (!s) return null;
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

async function fcScrape(url: string) {
  const res = await fetch(`${FIRECRAWL_API_URL}/scrape`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url,
      formats: ['markdown', 'html', 'extract'],
      mobile: false,
    }),
  });
  if (!res.ok) {
    const txt = await res.text().catch(() => '');
    throw new Error(`Firecrawl scrape failed ${res.status}: ${txt}`);
  }
  return (await res.json()) as {
    url?: string;
    title?: string;
    markdown?: string;
    html?: string;
    metadata?: Record<string, any>;
  };
}


async function getRecentLennyLinks(limit = 10): Promise<string[]> {
  const res = await fetch('https://www.lennysnewsletter.com/archive');
  const html = await res.text();
  const dom = new JSDOM(html);
  const links = Array.from(dom.window.document.querySelectorAll('a'))
    .map((a) => (a as any).href as string)
    .filter((href) => /^https:\/\/www\.lennysnewsletter\.com\/p\//.test(href));
  return Array.from(new Set(links)).slice(0, limit);
}

async function getRecentTLDRLinks(limit = 10): Promise<string[]> {
  const res = await fetch('https://tldr.tech/archives');
  const html = await res.text();
  const dom = new JSDOM(html);
  const links = Array.from(dom.window.document.querySelectorAll('a'))
    .map((a) => (a as any).href as string)
    .filter((href) =>
      /^https:\/\/tldr\.tech\/(newsletter|ai|webdev|crypto|founders)\/\d{4}-\d{2}-\d{2}/.test(
        href
      )
    );
  return Array.from(new Set(links)).slice(0, limit);
}


async function scrapeOne(url: string): Promise<ArticleScrape> {
  const publication = hostnameToPublication(url);
  const fc = await fcScrape(url);


  const text =
    (fc.markdown?.trim() && fc.markdown) ||
    (fc.html ? stripHtmlToText(fc.html) : '') ||
    '';


  const meta = fc.metadata ?? {};
  const dateGuess =
    meta.date ||
    meta.published_time ||
    meta['article:published_time'] ||
    meta.pubDate ||
    null;
  const subtitleGuess = meta.subtitle || meta.description || null;

  const candidate = {
    url,
    publication,
    title: fc.title || 'Untitled',
    subtitle: subtitleGuess,
    date: asISO(dateGuess),
    text: text.trim(),
  };

  return ArticleScrapeSchema.parse(candidate);
}

async function scrapeArticles(opts?: {
  sources?: Array<'Lenny' | 'TLDR'>;
  limitPerSource?: number;
  monthsBack?: number; // used only for filtering if date exists
}): Promise<ArticleScrape[]> {
  const { sources = ['Lenny', 'TLDR'], limitPerSource = 8 } = opts ?? {};

  const urlJobs: Promise<string[]>[] = [];
  if (sources.includes('Lenny')) urlJobs.push(getRecentLennyLinks(limitPerSource));
  if (sources.includes('TLDR')) urlJobs.push(getRecentTLDRLinks(limitPerSource));

  const urlSets = await Promise.all(urlJobs);
  const urls = Array.from(new Set(urlSets.flat()));

  const limit = pLimit(CONCURRENCY);
  const jobs = urls.map((u) =>
    limit(async () => {
      try {
        return await scrapeOne(u);
      } catch (e) {
        console.error('Scrape failed:', u, (e as Error).message);
        return null; // keep going
      }
    })
  );

  const results = (await Promise.all(jobs)).filter(Boolean) as ArticleScrape[];
  return results.filter((a) => a.text.length > 0);
}


const app = express();
app.use(cors());
app.use(express.json());

app.get('/api/articles', async (req, res) => {
  try {
    const limit = Number(req.query.limit ?? 6);
    const months = Number(req.query.months ?? 3);

    const items = await scrapeArticles({
      sources: ['Lenny', 'TLDR'],
      limitPerSource: limit,
      monthsBack: months,
    });

 
    const now = new Date();
    const cutoff = new Date(now);
    cutoff.setMonth(cutoff.getMonth() - months);

    const filtered = items.filter((a) => {
      if (!a.date) return true; 
      return new Date(a.date) >= cutoff;
    });

    res.json(filtered);
  } catch (e: any) {
    res.status(500).json({ error: e.message || 'Unknown error' });
  }
});

app.listen(PORT, () =>
  console.log(`Scrape API listening on http://localhost:${PORT}`)
);


if (process.argv.includes('--once')) {
  (async () => {
    const rows = await scrapeArticles({ limitPerSource: 5 });
    console.log(JSON.stringify(rows, null, 2));
    process.exit(0);
  })();
}
