import server from "./mcpServer.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";

async function start() {
  try {
    const transport = new StdioServerTransport();
    await server.connect(transport);
    console.log("🚀 MCP Server connected via stdio");
  } catch (err) {
    console.error("❌ Failed to start MCP Server:", err);
    process.exit(1);
  }
}

start();
