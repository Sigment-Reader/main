import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import { z } from 'zod';
import { fetch } from 'undici';
import pLimit from 'p-limit';
import { JSDOM } from 'jsdom';
import { setTimeout as delay } from 'timers/promises';


async function safeFetch(
  url: string,
  tries = 3,
  timeoutMs = 12_000
): Promise<import('undici').Response> {
  let lastErr: unknown;
  for (let attempt = 1; attempt <= tries; attempt++) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), timeoutMs);
    try {
      const res = await fetch(url, {
        redirect: 'follow',
        signal: ac.signal,
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
          Accept:
            'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.9',
          'Cache-Control': 'no-cache',
        },
      });
      clearTimeout(to);
      if (!res.ok) {
        const bodyStart = (await res.text()).slice(0, 300);
        throw new Error(
          `HTTP ${res.status} ${res.statusText} for ${url}\nBody: ${bodyStart}`
        );
      }
      return res;
    } catch (err) {
      clearTimeout(to);
      lastErr = err;
      const transient =
        (err as any)?.name === 'AbortError' ||
        (err as any)?.code === 'UND_ERR_CONNECT_TIMEOUT' ||
        (err as any)?.code === 'ECONNRESET' ||
        /HTTP (429|5\d\d)/.test(String(err));
      if (attempt < tries && transient) {
        await delay(600 * attempt + Math.floor(Math.random() * 200));
        continue;
      }
      break;
    }
  }
  throw lastErr;
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


const CONCURRENCY = 3;
const PORT = Number(process.env.PORT ?? 3001);
const FC_BASE = (process.env.FIRECRAWL_API_URL || '').replace(/\/+$/, '');
const FC_KEY = process.env.FIRECRAWL_API_KEY || '';

if (!FC_BASE || !FC_KEY) {
  throw new Error('Missing FIRECRAWL_API_URL or FIRECRAWL_API_KEY in .env');
}


const ArticleScrapeSchema = z.object({
  url: z.string().url(),
  publication: z.literal('TechCrunch'),
  title: z.string().min(1),
  subtitle: z.string().optional().nullable(),
  date: z.string().datetime().optional().nullable(),
  text: z.string().min(1),
});
type ArticleScrape = z.infer<typeof ArticleScrapeSchema>;

function hostnameToPublication(u: string): 'TechCrunch' {
  return 'TechCrunch';
}


async function fcScrape(targetUrl: string, tries = 4) {
  const endpoint = `${FC_BASE}/v1/scrape`;
  let lastErr: unknown;

  for (let i = 1; i <= tries; i++) {
    const ac = new AbortController();
    const to = setTimeout(() => ac.abort(), 15_000);
    try {
      const res = await fetch(endpoint, {
        method: 'POST',
        signal: ac.signal,
        headers: {
          'content-type': 'application/json',
          authorization: `Bearer ${FC_KEY}`,
        },
        body: JSON.stringify({
          url: targetUrl,
          formats: ['markdown', 'html'],
          onlyMainContent: true,
        }),
      });

      clearTimeout(to);

      if (res.status === 429 || (res.status >= 500 && res.status < 600)) {
        const msg = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${msg}`);
      }
      if (!res.ok) {
        const msg = await res.text().catch(() => '');
        throw new Error(`HTTP ${res.status} ${msg}`);
      }

      const raw: any = await res.json();
      const data = raw?.data ?? raw;
      return {
        url: data?.url,
        title: data?.title,
        markdown: data?.markdown,
        html: data?.html,
        metadata: data?.metadata ?? {},
      };
    } catch (e) {
      clearTimeout(to);
      lastErr = e;
      if (i < tries) {
        const backoff = 500 * i * i;
        await delay(backoff);
        continue;
      }
      break;
    }
  }

  throw lastErr;
}

async function directScrape(url: string) {
  const res = await safeFetch(url, 2, 12_000);
  const html = await res.text();
  const doc = new JSDOM(html, { url }).window.document;

  const title =
    doc.querySelector('meta[property="og:title"]')?.getAttribute('content') ||
    doc.querySelector('h1')?.textContent?.trim() ||
    doc.querySelector('title')?.textContent?.trim() ||
    '';

  const article =
    doc.querySelector('article') || doc.querySelector('main') || doc.body;
  const text =
    Array.from(article.querySelectorAll('p'))
      .map((p) => p.textContent?.trim() || '')
      .filter(Boolean)
      .join(' ') || stripHtmlToText(html);

  const date =
    doc.querySelector('meta[property="article:published_time"]')?.getAttribute('content') ||
    doc.querySelector('time[datetime]')?.getAttribute('datetime') ||
    null;

  const description =
    doc.querySelector('meta[name="description"]')?.getAttribute('content') ||
    doc.querySelector('meta[property="og:description"]')?.getAttribute('content') ||
    null;

  return {
    url,
    title,
    markdown: undefined,
    html,
    metadata: { 'article:published_time': date, description },
  };
}

function monthArchiveUrls(monthsBack: number): string[] {
  const now = new Date();
  const urls: string[] = [];
  for (let i = 0; i < monthsBack; i++) {
    const d = new Date(now);
    d.setDate(1);
    d.setMonth(now.getMonth() - i);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    urls.push(`https://techcrunch.com/${y}/${m}/`);
  }
  return urls;
}

async function getRecentTechCrunchLinks(limit = 100, monthsBack = 12): Promise<string[]> {
  const rxArticle = /^https?:\/\/(www\.)?techcrunch\.com\/\d{4}\/\d{2}\/\d{2}\/[^/?#]+\/?$/i;

  const months = monthArchiveUrls(monthsBack);
  const out = new Set<string>();

  for (const monthUrl of months) {
    const maxPages = 10;
    for (let page = 1; page <= maxPages; page++) {
      const url = page === 1 ? monthUrl : `${monthUrl}page/${page}/`;
      try {
        const res = await safeFetch(url);
        const html = await res.text();
        const doc = new JSDOM(html, { url }).window.document;

        const before = out.size;
        for (const a of Array.from(doc.querySelectorAll('a[href]'))) {
          const raw = (a as HTMLAnchorElement).getAttribute('href') || '';
          let abs: string;
          try {
            abs = new URL(raw, url).toString();
          } catch {
            continue;
          }
          if (rxArticle.test(abs)) out.add(abs);
          if (out.size >= limit) break;
        }

        const gained = out.size - before;
        if (gained === 0) break; 
        if (out.size >= limit) break;
      } catch {
        break;
      }
    }
    if (out.size >= limit) break;
  }

  const links = Array.from(out).slice(0, limit);
  console.log(`[TechCrunch] collected: ${links.length} (monthsBack=${monthsBack})`);
  return links;
}


async function scrapeOne(url: string): Promise<ArticleScrape> {
  const publication = hostnameToPublication(url);

  let fc: Awaited<ReturnType<typeof fcScrape>>;
  try {
    fc = await fcScrape(url);
  } catch {
    fc = await directScrape(url);
  }

  const text =
    (fc.markdown && fc.markdown.trim()) ||
    (fc.html ? stripHtmlToText(fc.html) : '') ||
    (typeof (fc as any).metadata?.description === 'string'
      ? (fc as any).metadata.description.trim()
      : '') ||
    (fc.title ?? '');

  const meta = (fc as any).metadata ?? {};
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
  limit?: number;           
  monthsBack?: number;       
}): Promise<ArticleScrape[]> {
  const { limit = 100, monthsBack = 12 } = opts ?? {};

  const urls = await getRecentTechCrunchLinks(limit, monthsBack);
  console.log(`Scraping ${urls.length} URLs (concurrency=${CONCURRENCY})`);

  const limiter = pLimit(CONCURRENCY);
  const jobs = urls.map((u, i) =>
    limiter(async () => {
      try {
        const art = await scrapeOne(u);
        if ((i + 1) % 10 === 0) console.log(`✔ scraped ${i + 1}/${urls.length}`);
        return art;
      } catch (e) {
        console.error('Scrape failed:', u, (e as Error).message);
        return null;
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
  const limit = Math.min(Number(req.query.limit ?? 100), 300);
  const months = Math.max(1, Math.min(Number(req.query.months ?? 12), 36));

  console.log('REQ', { limit, months });

  try {
    const rows = await scrapeArticles({ limit, monthsBack: months });
    res.json(rows);
  } catch (e: any) {
    console.error(e);
    res.status(500).json({ error: e.message || String(e) });
  }
});

app.get('/health', (_req, res) => res.send('ok'));

app.listen(PORT, () =>
  console.log(`🟢 Scrape API listening on http://localhost:${PORT}`)
);

export {
  safeFetch,
  getRecentTechCrunchLinks,
  scrapeArticles,
  scrapeOne,
  fcScrape,
  ArticleScrapeSchema,
};
