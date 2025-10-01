import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { ArticleSchema } from "./model/article.js";
import OpenAI from "openai";

//OPENAI_API_KEY

const openai = new OpenAI({ apiKey: process.env.})

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
        description: "Retrieves articles relevant to the search topic",
        inputSchema: { ArticleSchema }
    },
    async (input) => {
        // Implement the logic to fetch articles based on the input
        // For now, just return a placeholder
        return { articles: [] };
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
    // Manually clean the data: Do the usual trimming, replacing, etc
    // Prompt the LLM to make fit into the schema. Input is array of objects, output is ArticleSchema documents
    // Prompt the LLM to do a summary of the text with max X words so everything looks the same when a MCP client uses this tool to display in the front-end
  }
);


