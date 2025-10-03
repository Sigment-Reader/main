import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ArticleSchema } from "./model/article.js";
import { chunkArticles } from "./domain/chunk.js";
import { ArticleScrapeSchema, scrapeArticles } from "./domain/scrapping.js";
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
        - summary → 5 sentences summarizing the article text.
`;
const schemaDescription = `
  Each article must include:
  - id (string)
  - source ("TLDR" | "Lenny")
  - url (string, valid URL)
  - publishedDate (ISO-8601 string or "")
  - author (string)
  - title (string)
  - text (string)
  - summary (string)
`;
const server = new McpServer({
    name: "Sigment-Reader",
    version: "1.0.0",
    capabilities: {
        resources: {}, //These are like GET endpoints, used to load information into the LLM's context
        tools: {}, //These are like POST endpoints, used to execute code or produce a side effect
    },
});
const FetchArticleInputSchema = z.object({
    limit: z.number().int().min(1).max(300).default(20),
    months: z.number().int().min(1).max(36).default(12),
});
server.registerTool("fetch_article", {
    title: "Article Fetcher",
    description: "Fetch up to {limit} articles from the last {months} months.",
    inputSchema: FetchArticleInputSchema.shape,
}, async (input, _extra) => {
    const args = FetchArticleInputSchema.parse(input ?? {});
    const rows = await scrapeArticles({
        limit: args.limit,
        monthsBack: args.months,
    });
    const payload = { articles: z.array(ArticleScrapeSchema).parse(rows) };
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(payload, null, 2),
            },
        ],
        structuredContent: payload,
    };
});
// Use server.tool vs server.registerTool for simplicity. Latter requires declaration separate from implementation, whereas server.tool you pass the tool metadata: name, description, input schema and the handler function
server.registerTool("clean_article", {
    title: "Article cleaner",
    description: "Clean up article text according to a prompt provided by an LLM",
    inputSchema: { articles: ArticleScrapeSchema.array() },
}, async ({ articles }, _extra) => {
    // Chunk the incoming array of articles
    console.error("clean_article received", { count: articles.length });
    const batches = chunkArticles(articles);
    const cleanResult = [];
    // Prompt the LLM to make fit into the schema which includes the summary
    for (const batch of batches) {
        const userPrompt = `
        Extract and normalize the following articles. For each article, produce a summary of at most 5 sentences.
        Output: JSON array matching this schema:
        ${schemaDescription}
        `;
        const userContent = `${userPrompt}\n\nArticles JSON:\n${JSON.stringify({
            articles: batch,
        }, null, 2)}`;
        const response = await openai.responses.create({
            model: "gpt-4.1-mini",
            input: [
                { role: "system", content: systemPrompt.trim() },
                { role: "user", content: userContent },
            ],
        });
        const rawOutput = response.output_text; // Output is a JSON string
        if (!rawOutput?.trim()) {
            console.error("clean_article empty output", {
                batchSize: batch.length,
            });
            continue;
        }
        let parsed;
        try {
            parsed = JSON.parse(rawOutput);
        }
        catch (error) {
            console.error("clean_article JSON parse failed", {
                batchSize: batch.length,
                snippet: rawOutput.slice(0, 200),
                error,
            });
            continue;
        }
        const validated = ArticleSchema.array().safeParse(parsed);
        if (!validated.success) {
            console.error("clean_article validation failed", {
                batchSize: batch.length,
                issues: validated.error.issues,
            });
            continue;
        }
        cleanResult.push(...validated.data);
    }
    const payload = { articles: cleanResult };
    return {
        content: [
            {
                type: "text",
                text: JSON.stringify(payload, null, 2),
            },
        ],
        structuredContent: payload,
    };
});
// Instatiate StdioServerTransport to allow client access to the tools
async function main() {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.error("Sigment Reader MCP Server running on stdio");
}
main().catch((error) => {
    console.error("Fatal error in main():", error);
    process.exit(1);
});
