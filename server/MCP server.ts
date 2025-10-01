import { McpServer, ResourceTemplate } from '@modelcontextprotocol/sdk/server';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server';
import { z } from 'zod';

//OPENAI_API_KEY 

const server = new McpServer({
    name: 'demo-server',
    version: '1.0.0'
});

server.registerTool('fetch_articles',
    {
        title: '',
        description: 'Fetch URL article',
        inputSchema: { a: z.}
    }
)