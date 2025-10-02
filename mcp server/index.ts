import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ArticleSchema } from "./model/article.js";
import type { Article } from "./model/article.js";
import { chunkArticles } from "./domain/chunk.js";
import OpenAI from "openai";
import { z } from "zod";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const systemPrompt = `
    You are a careful information extractor. 
    You only return data that conforms to the provided JSON Schema. 
    Do not include commentary or markdown. 
    If a field is missing, set a reasonable empty value (""), but never fabricate facts like author names.
    Parse and normalize:
        - publishedDate → ISO-8601 (UTC if timezone unknown).
        - title → strip leading/trailing whitespace.
        - summary → 3 sentences summarizing the article text.
`;

const server = new McpServer({
  name: "Sigment-Reader",
  version: "1.0.0",
  capabilities: {
    resources: {}, //These are like GET endpoints, used to load information into the LLM's context
    tools: {}, //These are like POST endpoints, used to execute code or produce a side effect
  },
});

server.registerTool(
    "fetch_article",
    {
        title: "Article Fetcher",
        inputSchema: {
            query: z.string(),
            monthsBack: z.number(),
            limitPerSource: z.number(),
            sources: z.array(z.string())
        }
    },
    async (input) => {
        // Implement the logic to fetch articles based on the input
        // For now, just return a placeholder
        //return { articles: [] };
    }
)

// Use server.tool vs server.registerTool for simplicity. Latter requires declaration separate from implementation, whereas server.tool you pass the tool metadata: name, description, input schema and the handler function
server.registerTool(
  "clean_article",
  {
    title: "Article cleaner",
    description:
      "Clean up article text according to a prompt provided by an LLM",
    inputSchema: { ArticleSchema },
  },
  async ({ outputfromfetcharticle }) => {
    // Chunk the incoming array of articles
    const batches = chunkArticles(outputfromfetcharticle);
    const cleanResult: Article[] = [];
    // Prompt the LLM to make fit into the schema which includes the summary
    for (const batch of batches!) {
      const userPrompt = `
        Extract and normalize the following articles
        Input array (JSON): ${JSON.stringify(batch)}
        Output: JSON array matching ${ArticleSchema}. No extra keys beyond the schema.
        With the followng mapping rules:
        - id: prefer stable unique id from input.
        - source: this is either "TLDR" or "Lenny" do not make fabricate anything else.
        - url: canonical URL if present; otherwise first valid HTTP(S) URL in the item.
        - publishedDate: use any date-like field; convert to ISO-8601; omit if unknown.
        - author: use byline/author fields if present; otherwise empty string.
        - title: best available title field.
        - text: main article text/body (raw if available).
        - summary: write a concise summary of 3 sentences.
        `;

      const response = await openai.responses.create({
        model: "gpt-4.1-mini",
        input: [
          { role: "system", content: systemPrompt.trim() },
          { role: "user", content: userPrompt },
        ],
      });

      const rawOutput = response.output_text; // Output is a JSON string
      const parsed = JSON.parse(rawOutput); // Parse into real JS object
      const cleanOutput = parsed.map((item: any) => ArticleSchema.parse(item)); // Validates into a new array that fits the ArticleSchema via Zod
      cleanResult.push(...cleanOutput);
    }
  }
);
