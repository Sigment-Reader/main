// Chunking the array of objects from article scraping to be able to fit the information within GPT's context limit.

import { Article } from "../model/article.js";

const maxArticlesPerBatch = 10;
const maxCharsPerBatch = 12000;

export function chunkArticles(articles: Article[]) {
  const batches: Article[][] = [];
  let currentBatch: Article[] = [];
  let currentChars = 0;

  for (const article of articles) {
    const articleLength = article.text.length;
    const batchIsFull = currentBatch.length >= maxArticlesPerBatch;
    const charsIsFull = currentChars + articleLength > maxCharsPerBatch;

    // Check if im going to reach the max of articles in a batch or the chars in a batch. If so, move on to the next batch
    if ((batchIsFull || charsIsFull) && currentBatch.length) {
      batches.push(currentBatch);
      currentBatch = [];
      currentChars = 0;
    }
    // Otherwise keep pushing articles into the batch and update variable currentChars
    currentBatch.push(article);
    currentChars += articleLength;

    // Last push, once everything is completed
    if (currentBatch.length) {
      batches.push(currentBatch);
    }

    return batches;
  }
}
