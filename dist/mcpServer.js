import path from "path";
import dotenv from "dotenv";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";
dotenv.config({ quiet: true, path: path.resolve("D:\\Projects\\Assignments\\BusyCodesV1\\.env"), override: true });
console.error("Starting MCP Server...");
console.error("CWD:", process.cwd());
console.error("GEMINI_API_KEY:", process.env.GEMINI_API_KEY);
console.error("SMTP_USER:", process.env.SMTP_USER);
process.on("uncaughtException", (err) => console.error("Uncaught Exception:", err));
process.on("unhandledRejection", (reason) => console.error("Unhandled Rejection:", reason));
let gemini;
try {
    if (!process.env.GEMINI_API_KEY)
        throw new Error("GEMINI_API_KEY not defined");
    gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
    console.error("Gemini initialized successfully");
}
catch (err) {
    console.error("Failed to initialize Gemini:", err);
}
let transporter;
try {
    if (!process.env.SMTP_USER || !process.env.SMTP_PASS)
        throw new Error("SMTP credentials missing");
    transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
        secure: true,
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    });
    console.error("Nodemailer transporter created successfully");
}
catch (err) {
    console.error("Failed to create transporter:", err);
}
const uploadedCVs = {};
let server;
try {
    server = new McpServer({
        name: "cv-email-server",
        version: "1.0.0",
        capabilities: { tools: {}, resources: {} },
    });
    console.error("MCP Server created successfully");
}
catch (err) {
    console.error("Failed to create MCP server:", err);
    process.exit(1);
}
try {
    server.tool("upload_cv", "Upload a CV (PDF or Word) and store it", { filename: z.string(), file_base64: z.string() }, async ({ filename, file_base64 }) => {
        try {
            const buffer = Buffer.from(file_base64, "base64");
            let text = "";
            if (filename.endsWith(".pdf")) {
                text = (await pdfParse(buffer)).text;
            }
            else if (filename.endsWith(".docx")) {
                text = (await mammoth.extractRawText({ buffer })).value;
            }
            else {
                return { content: [{ type: "text", text: "Unsupported file type." }] };
            }
            uploadedCVs[filename] = text;
            console.error(`CV '${filename}' uploaded`);
            return { content: [{ type: "text", text: `CV '${filename}' uploaded successfully!` }] };
        }
        catch (err) {
            console.error("Error uploading CV:", err);
            return { content: [{ type: "text", text: `Error uploading CV: ${err.message}` }] };
        }
    });
    console.error("Tool 'upload_cv' registered");
}
catch (err) {
    console.error("Failed to register tool 'upload_cv':", err);
}
try {
    server.tool("ask_cv", "Ask questions about an uploaded CV", { filename: z.string(), question: z.string() }, async ({ filename, question }) => {
        try {
            const cvText = uploadedCVs[filename];
            if (!cvText)
                return { content: [{ type: "text", text: "CV not found." }] };
            const response = await gemini.models.generateContent({
                model: "gemini-2.5-flash",
                contents: `CV TEXT:\n${cvText}\n\nQuestion: ${question}`,
            });
            return { content: [{ type: "text", text: response.text ?? "No answer." }] };
        }
        catch (err) {
            console.error("Error in 'ask_cv':", err);
            return { content: [{ type: "text", text: `Error: ${err.message}` }] };
        }
    });
    console.error("Tool 'ask_cv' registered");
}
catch (err) {
    console.error("Failed to register tool 'ask_cv':", err);
}
try {
    server.tool("send_email", "Send an email notification", { to: z.string().email(), subject: z.string(), body: z.string() }, async ({ to, subject, body }) => {
        try {
            await transporter.sendMail({
                from: process.env.SMTP_EMAIL,
                to,
                subject,
                text: body,
            });
            console.error(`Email sent to ${to}`);
            return { content: [{ type: "text", text: "Email sent successfully!" }] };
        }
        catch (err) {
            console.error("Email sending failed:", err);
            return { content: [{ type: "text", text: `Email failed: ${err.message}` }] };
        }
    });
    console.error("Tool 'send_email' registered");
}
catch (err) {
    console.error("Failed to register tool 'send_email':", err);
}
try {
    server.tool("test", "Test tool invocation", {}, async () => {
        return { content: [{ type: "text", text: "test successful" }] };
    });
    console.error("Tool 'test' registered");
}
catch (err) {
    console.error("Failed to register tool 'test':", err);
}
export default server;
