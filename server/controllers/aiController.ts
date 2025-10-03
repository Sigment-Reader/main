import fs from "node:fs";
import path from "node:path";
import { RequestHandler } from "express";
import { ServerError } from "../types.js";
import OpenAI from "openai";
import "dotenv/config";
import Anthropic from "@anthropic-ai/sdk";

// const openai = new OpenAI({
//   apiKey: process.env.OPENAI_API_KEY,
// });

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

const CHAT_MODEL = "claude-sonnet-4-5";

// const CHAT_MODEL = "gpt-4o-mini";
const MCP_CONFIG_PATH = path.resolve(__dirname, "../../client/mcp.json");
const MCP_CONFIG = JSON.parse(fs.readFileSync(MCP_CONFIG_PATH, "utf8"));

export const queryOpenAIChat: RequestHandler = async (_req, res, next) => {
  const { userQuery } = res.locals;

  if (!userQuery) {
    const error: ServerError = {
      log: "queryOpenAIChat: Missing user query.",
      status: 500,
      message: {
        err: "Missing data required for recommendation. Check query.",
      },
    };
    return next(error);
  }

  try {
    const response = await anthropic.messages.create(
      {
        model: CHAT_MODEL,
        max_tokens: 1024,
        system:
          "You are an MCP-aware assistant. Use the configured MCP server tools to satisfy the user's news request. Always call the available tools rather than relying on built-in knowledge, and reply with structured JSON results only.",
        messages: [
          {
            role: "user",
            content: String(userQuery),
          },
        ],
        mcp_servers: [MCP_CONFIG],
      },
      {
        headers: {
          "anthropic-beta": "mcp-client-2025-04-04",
        },
      }
    );

    // const response = await openai.responses.create({
    //   model: CHAT_MODEL,
    //   input: [
    //     {
    //       role: "system",
    //       content:
    //         "You are an MCP-aware assistant. Use the configured MCP server tools to satisfy the user's news request. Always call the available tools rather than relying on built-in knowledge, and reply with structured JSON results only.",
    //     },
    //     {
    //       role: "user",
    //       content: String(userQuery),
    //     },
    //   ],
    //   tool_choice: "auto",
    //   mcp: {
    //     tool_configs: [MCP_CONFIG],
    //   },
    // } as any);

    // const completionString = response.output_text;
    const completionString = response.content[0].text;
    console.log("THIS IS THE RESULT", completionString);

    if (!completionString) {
      throw new Error(
        "LLM did not return any content (output_text was null/empty or refused)."
      );
    }

    const recommendationObject: string = JSON.parse(completionString);

    res.locals.articles = recommendationObject;
    return next();
  } catch (err) {
    return next({
      log: `Error with completion inside of queryOpenAIChat: ${err}`,
      status: 500,
      message: { err: "An error occurred while querying OpenAI" },
    });
  }
};
