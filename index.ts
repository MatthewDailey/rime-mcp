import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { playText } from "./stream-audio.js";

const RIME_API_KEY = process.env.RIME_API_KEY;
if (!RIME_API_KEY) {
  console.error("Error: RIME_API_KEY environment variable is not set");
  process.exit(1);
}

// Create a temporary directory for audio files
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rime-audio-"));
process.on("exit", () => {
  try {
    // Clean up temporary files on exit
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Failed to clean up temporary directory:", error);
  }
});

const server = new Server(
  {
    name: "mcp-rime",
    version: "0.1.0",
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// Environment variables for configuration
const GUIDANCE = process.env.RIME_GUIDANCE;
const WHO_TO_ADDRESS = process.env.RIME_WHO_TO_ADDRESS;
const WHEN_TO_SPEAK = process.env.RIME_WHEN_TO_SPEAK || "when asked to speak";
const VOICE = process.env.RIME_VOICE || "cove";

const SPEAK_TOOL: Tool = {
  name: "speak",
  description: `Speak text aloud using Rime's text-to-speech API. Should be used when user asks you to speak or to announce and explain when you finish a command
    
User configuration:

${WHO_TO_ADDRESS ? `WHO_TO_ADDRESS: ${WHO_TO_ADDRESS}` : ""}

${WHEN_TO_SPEAK ? `WHEN_TO_SPEAK: ${WHEN_TO_SPEAK}` : ""}

${VOICE ? `VOICE: ${VOICE}` : ""}

${GUIDANCE ? `GUIDANCE: ${GUIDANCE}` : ""}
    `,
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to speak aloud",
      },
      speaker: {
        type: "string",
        description: `The voice to use (defaults to '${VOICE}')`,
      },
      speedAlpha: {
        type: "number",
        description: "Speech speed multiplier (default: 1.0)",
      },
      reduceLatency: {
        type: "boolean",
        description: "Whether to optimize for lower latency (default: false)",
      },
    },
    required: ["text"],
  },
};

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [SPEAK_TOOL],
}));

function log(level: string, message: string): void {
  console.error(`[${level}] ${message}`);
}

async function doSpeak(params: {
  text: string;
  speaker?: string;
  speedAlpha?: number;
  reduceLatency?: boolean;
}) {
  try {
    // Use the playText function from stream-audio.ts
    await playText(params.text);

    return {
      content: [
        {
          type: "text",
          text: JSON.stringify({
            success: true,
            text: params.text,
            speaker: params.speaker || "cove",
          }),
        },
      ],
    };
  } catch (error: unknown) {
    log("ERROR", `Error: ${error instanceof Error ? error.message : String(error)}`);
    throw new McpError(
      ErrorCode.InternalError,
      `Rime API error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
}

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  if (request.params.name === "speak") {
    console.error("Speak tool called with:", request.params.arguments);
    const input = request.params.arguments as {
      text: string;
      speaker?: string;
      speedAlpha?: number;
      reduceLatency?: boolean;
    };
    return doSpeak(input);
  }

  throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${request.params.name}`);
});

server.onerror = (error: any) => {
  console.error(error);
};

process.on("SIGINT", async () => {
  await server.close();
  process.exit(0);
});

async function runServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("MCP Rime Server running on stdio");
}

runServer().catch((error) => {
  console.error("Fatal error running server:", error);
  process.exit(1);
});
