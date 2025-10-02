import { RequestHandler } from 'express';
import { ServerError } from '../../server/types';
import OpenAI from 'openai';
import 'dotenv/config';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const CHAT_MODEL = 'gpt-4o-mini';

// ------------------------------------
// 3. CHAT COMPLETION & RAG LOGIC
// ------------------------------------

const buildingSystemPrompt = (): string => {
  return `
    You are an advanced, agentic AI specializing in information retrieval and summarization. Your primary goal is to fulfill user news queries by strictly adhering to the Model Context Protocol (MCP) toolset you have access to.

    You MUST use the 'fetch_article' tool when receiving a user query. This tool is your exclusive method for gathering raw news data.

    Your workflow is:
    1.  **Parse User Request:** Identify the central topic and any explicit source/time constraints.
    2.  **Tool Call:** Immediately call the 'fetch_article' tool, passing the user's query and any relevant parameters (like sources, limit, or time constraints).
    3.  **Result Handling:** Once 'fetch_article' returns the raw article content, you must pass that data to the 'clean_article' tool to produce the final, summarized, and structured JSON output as defined by the ArticleSchema.
    4.  **Final Output:** Return ONLY the resulting JSON array of articles. Do not include commentary, markdown, or conversational text.
  `;
};

// FIX: Renamed and simplified the factory/export structure
export const queryOpenAIChat: RequestHandler = async (_req, res, next) => {
  const { userQuery } = res.locals;

  if (!userQuery) {
    const error: ServerError = {
      log: 'queryOpenAIChat: Missing user query.',
      status: 500,
      message: {
        err: 'Missing data required for recommendation. Check query.',
      },
    };
    return next(error);
  }

  try {
    const systemPrompt = buildingSystemPrompt();

    // FIX: Using the correct message type from the initialized OpenAI client
    const input: any = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: userQuery },
    ];

    // FIX: Using the already initialized 'openai' constant
    const response = await openai.responses.create({
      model: CHAT_MODEL,
      input: input,
      temperature: 0.1,
    });

    const completionString = response.output_text;

    if (!completionString) {
      throw new Error(
        'LLM did not return any content (output_text was null/empty or refused).'
      );
    }

    // FIX: Ensure the JSON parsing step correctly handles potential refusal/incomplete status
    const recommendationObject: string = JSON.parse(completionString);

    res.locals.articles = recommendationObject;
    return next();
  } catch (err) {
    return next({
      log: `Error with completion inside of queryOpenAIChat: ${err}`,
      status: 500,
      message: { err: 'An error occurred while querying OpenAI' },
    });
  }
};
