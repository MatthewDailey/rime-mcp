import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import dotenv from "dotenv";
import fetch from "node-fetch";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync } from "child_process";
import { createWriteStream } from "fs";

dotenv.config();

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
      resources: {},
      tools: {},
      logging: {},
    },
  }
);

const SPEAK_TOOL: Tool = {
  name: "speak",
  description: "Speak text aloud using Rime's text-to-speech API",
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

function log(level: string, message: string): void {
  console.error(`[${level}] ${message}`);
}

interface AudioPlayResult {
  success: boolean;
  message?: string;
}

// Function to play audio based on OS
function playAudio(filePath: string): AudioPlayResult {
  try {
    const platform = os.platform();

    // Select the appropriate command based on platform
    let command = "";

    if (platform === "darwin") {
      // macOS
      command = `afplay "${filePath}"`;
    } else if (platform === "win32") {
      // Windows
      command = `powershell -c (New-Object Media.SoundPlayer "${filePath}").PlaySync()`;
    } else {
      // Linux and others
      const players = ["mpg123", "mplayer", "aplay", "ffplay"];
      let playerFound = false;

      for (const player of players) {
        try {
          execSync(`which ${player}`);
          if (player === "mpg123" || player === "mplayer") {
            command = `${player} "${filePath}"`;
          } else if (player === "aplay") {
            command = `${player} -q "${filePath}"`;
          } else if (player === "ffplay") {
            command = `${player} -nodisp -autoexit -hide_banner -loglevel error "${filePath}"`;
          } else {
            continue;
          }
          playerFound = true;
          break;
        } catch (e) {
          // Player not found, try next one
          continue;
        }
      }

      if (!playerFound) {
        return {
          success: false,
          message:
            "No suitable audio player found. Please install mpg123, mplayer, aplay, or ffplay.",
        };
      }
    }

    // Execute the command
    execSync(command);
    return { success: true };
  } catch (error) {
    return {
      success: false,
      message: `Failed to play audio: ${error instanceof Error ? error.message : String(error)}`,
    };
  }
}

async function generateAndPlaySpeech(
  text: string,
  speaker: string = "cove",
  speedAlpha: number = 1.0,
  reduceLatency: boolean = false
): Promise<any> {
  log(
    "INFO",
    `Starting speech synthesis with voice "${speaker}" for text: "${text.substring(0, 30)}${text.length > 30 ? "..." : ""}"`
  );

  try {
    // Make the API request to get audio via JSON
    const response = await fetch("https://users.rime.ai/v1/rime-tts", {
      method: "POST",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${RIME_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        text: text,
        speaker: speaker,
        modelId: "mistv2",
        speedAlpha: speedAlpha,
        reduceLatency: reduceLatency,
        audioFormat: "mp3",
        samplingRate: 22050,
      }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    // Parse the JSON response
    const data = (await response.json()) as { data: string };
    if (!data || !data.data) {
      throw new Error("Invalid response format from Rime API");
    }

    log("INFO", "Audio data received from Rime");

    // Decode the base64 audio data
    const audioBuffer = Buffer.from(data.data, "base64");

    // Create a unique temporary file path
    const tmpFilePath = path.join(tmpDir, `speech-${Date.now()}.mp3`);

    // Write the audio data to the file
    fs.writeFileSync(tmpFilePath, audioBuffer);
    log("INFO", `Audio saved to ${tmpFilePath}`);

    // Play the audio file
    log("INFO", "Playing audio...");
    const playResult = playAudio(tmpFilePath);
    if (!playResult.success) {
      throw new Error(playResult.message);
    }

    log("INFO", "Audio playback completed");

    return {
      success: true,
      text,
      speaker,
    };
  } catch (error) {
    throw error;
  }
}

async function doSpeak(params: {
  text: string;
  speaker?: string;
  speedAlpha?: number;
  reduceLatency?: boolean;
}) {
  try {
    return await generateAndPlaySpeech(
      params.text,
      params.speaker,
      params.speedAlpha,
      params.reduceLatency
    );
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
