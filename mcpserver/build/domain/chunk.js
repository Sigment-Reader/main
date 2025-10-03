// Chunking the array of objects from article scraping to be able to fit the information within GPT's context limit.
import { ArticleSchema } from "../model/article.js";
const maxArticlesPerBatch = 10;
const maxCharsPerBatch = 10000;
export function chunkArticles(rawArticles) {
    const batches = [];
    let currentBatch = [];
    let currentChars = 0;
    for (const raw of rawArticles) {
        const normalized = ArticleSchema.parse({
            id: raw.url,
            source: raw.publication,
            url: raw.url,
            publishedDate: raw.date ?? undefined,
            author: "",
            title: raw.title,
            text: raw.text,
            summary: "",
        });
        const articleLength = normalized.text.length;
        const batchIsFull = currentBatch.length >= maxArticlesPerBatch;
        const charsIsFull = currentChars + articleLength > maxCharsPerBatch;
        if ((batchIsFull || charsIsFull) && currentBatch.length) {
            batches.push(currentBatch);
            currentBatch = [];
            currentChars = 0;
        }
        currentBatch.push(normalized);
        currentChars += articleLength;
    }
    if (currentBatch.length) {
        batches.push(currentBatch);
    }
    return batches;
}
