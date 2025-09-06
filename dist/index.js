import server from "./mcpServer.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
async function start() {
    try {
        const transport = new StdioServerTransport();
        process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));
        process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
        await server.connect(transport);
        console.error("Server connected successfully");
    }
    catch (err) {
        console.error("Failed to start Server:", err);
        process.exit(1);
    }
}
start();
