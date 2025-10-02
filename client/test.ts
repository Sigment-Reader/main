/*
import fs from "node:fs";
import OpenAI from "openai";

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load the MCP config (your client/mcp.json)
const mcpConfig = JSON.parse(
  fs.readFileSync(new URL("./mcp.json", import.meta.url), "utf8")
);

const response = await client.responses.create({
  model: "o4-mini",
  input: [
    {
      role: "user",
      content: "Fetch 3 recent TechCrunch articles and summarize them.",
    },
  ],
  tool_choice: "auto",
  mcp: {
    tool_configs: [mcpConfig],
  },
});

console.log(response.output_text);
*/
