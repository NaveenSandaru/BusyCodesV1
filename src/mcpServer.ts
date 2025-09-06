import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { GoogleGenAI } from "@google/genai";
import nodemailer from "nodemailer";
import pdfParse from "pdf-parse";
import mammoth from "mammoth";

import dotenv from 'dotenv';
dotenv.config();

const gemini = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT ? parseInt(process.env.SMTP_PORT) : 465,
    secure: true,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
});

const uploadedCVs: Record<string, string> = {};

const server = new McpServer({
    name: "cv-email-server",
    version: "1.0.0",
    capabilities: { resources: {}, tools: {} },
});

server.tool(
    "upload_cv",
    "Upload a CV (PDF or Word) and store it",
    { filename: z.string(), file_base64: z.string() },
    async ({ filename, file_base64 }) => {
        const buffer = Buffer.from(file_base64, "base64");
        let text = "";
        if (filename.endsWith(".pdf")) {
            text = (await pdfParse(buffer)).text;
        } else if (filename.endsWith(".docx")) {
            text = (await mammoth.extractRawText({ buffer })).value;
        } else {
            return { content: [{ type: "text", text: "Unsupported file type." }] };
        }
        uploadedCVs[filename] = text;
        return { content: [{ type: "text", text: `CV '${filename}' uploaded successfully!` }] };
    }
);

server.tool(
    "ask_cv",
    "Ask questions about an uploaded CV",
    { filename: z.string(), question: z.string() },
    async ({ filename, question }) => {
        const cvText = uploadedCVs[filename];
        if (!cvText) return { content: [{ type: "text", text: "CV not found." }] };

        const response = await gemini.models.generateContent({
            model: "gemini-2.5-flash",
            contents: `CV TEXT:\n${cvText}\n\nQuestion: ${question}`,
            config: { thinkingConfig: { thinkingBudget: 0 } },
        });

        return { content: [{ type: "text", text: response.text ?? "No answer." }] };
    }
);

server.tool(
    "send_email",
    "Send an email notification",
    { to: z.string().email(), subject: z.string(), body: z.string() },
    async ({ to, subject, body }) => {
        await transporter.sendMail({ from: process.env.SMTP_EMAIL, to, subject, text: body });
        return { content: [{ type: "text", text: "Email sent successfully!" }] };
    }
);

server.tool(
    "test",
    "Test tool invoktion",
    {},
    async({})=>{
        return {content:[{type: "text", text: "test successfull"}]};
    }
);

export default server;