import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import fetch from "node-fetch";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { promisify } from "util";
import player from "play-sound";

dotenv.config();

const RIME_API_KEY = process.env.RIME_API_KEY;
if (!RIME_API_KEY) {
  console.error("Error: RIME_API_KEY environment variable is not set");
  process.exit(1);
}

// Initialize audio player
const audioPlayer = player({});
const playAudio = promisify(audioPlayer.play.bind(audioPlayer));

// Create temporary directory for audio chunks
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
      resources: {},
      tools: {},
      logging: {},
    },
  }
);

const SPEAK_TOOL: Tool = {
  name: "speak",
  description: "Speak text aloud using Rime's text-to-speech API with real-time streaming",
  inputSchema: {
    type: "object",
    properties: {
      text: {
        type: "string",
        description: "The text to speak aloud",
      },
      speaker: {
        type: "string",
        description: "The voice to use (defaults to 'cove')",
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

interface RimeEvent {
  type: "chunk" | "timestamps" | "done" | "error";
  data?: string;
  word_timestamps?: {
    words: string[];
    start: number[];
    end: number[];
  };
  message?: string;
  done?: boolean;
}

async function* parseEventStream(readableStream: any): AsyncGenerator<RimeEvent> {
  // Handle node-fetch response
  if (readableStream.body) {
    readableStream = readableStream.body;
  }

  // Handle ReadableStream from fetch
  if (readableStream.getReader) {
    const textDecoder = new TextDecoder();
    const reader = readableStream.getReader();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += textDecoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        let currentEvent = "";
        let currentData = "";

        for (const line of lines) {
          if (line.trim() === "") continue;

          if (line.startsWith("event: ")) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith("data: ")) {
            currentData = line.slice(6).trim();
            if (currentData && currentEvent) {
              try {
                const parsedData = JSON.parse(currentData);
                yield {
                  type: currentEvent as RimeEvent["type"],
                  ...parsedData,
                };
                currentEvent = "";
                currentData = "";
              } catch (error) {
                console.error("Failed to parse event:", error);
              }
            }
          }
        }
      }
    } finally {
      reader.releaseLock();
    }
  } else {
    // Fallback for other stream types
    throw new Error("Unsupported stream type");
  }
}

function sendLog(level: string, message: string) {
  // Just log to console for progress reporting
  console.log(`[${level}] ${message}`);
}

async function doSpeak(params: {
  text: string;
  speaker?: string;
  speedAlpha?: number;
  reduceLatency?: boolean;
}) {
  try {
    sendLog(
      "INFO",
      `Starting speech synthesis for text: "${params.text.substring(0, 30)}${params.text.length > 30 ? "..." : ""}"`
    );

    const response = await fetch("https://users.rime.ai/v1/rime-tts", {
      method: "POST",
      headers: {
        Accept: "text/eventstream",
        Authorization: `Bearer ${RIME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: params.text,
        speaker: params.speaker || "cove",
        modelId: "mistv2",
        speedAlpha: params.speedAlpha || 1.0,
        reduceLatency: params.reduceLatency || false,
        audioFormat: "mp3",
      }),
    });

    if (!response.ok || !response.body) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Create a temporary file for the combined audio
    const tmpFilePath = path.join(tmpDir, `speech-${Date.now()}.mp3`);
    const outputStream = fs.createWriteStream(tmpFilePath);

    let chunkCount = 0;
    let wordTimestamps = null;

    for await (const event of parseEventStream(response)) {
      if (event.type === "chunk" && event.data) {
        const chunk = Buffer.from(event.data, "base64");
        outputStream.write(chunk);
        chunkCount++;

        sendLog("INFO", `Received audio chunk #${chunkCount} (${chunk.length} bytes)`);
      } else if (event.type === "timestamps") {
        wordTimestamps = event.word_timestamps;
        sendLog("INFO", `Received word timestamps for ${wordTimestamps?.words.length || 0} words`);
      } else if (event.type === "error") {
        throw new Error(event.message || "Unknown error from Rime API");
      } else if (event.type === "done" && event.done) {
        sendLog("INFO", "Audio generation complete");
      }
    }

    // Close the write stream and play the audio
    outputStream.end();
    await new Promise<void>((resolve) => outputStream.on("finish", resolve));

    sendLog("INFO", `Playing audio from ${tmpFilePath}`);

    try {
      await playAudio(tmpFilePath);
      sendLog("INFO", "Finished playing audio");
    } catch (error) {
      throw new Error(
        `Failed to play audio: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return {
      success: true,
      text: params.text,
      speaker: params.speaker || "cove",
      duration: wordTimestamps ? wordTimestamps.end[wordTimestamps.end.length - 1] : null,
    };
  } catch (error: unknown) {
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
