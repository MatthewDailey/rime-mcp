#!/usr/bin/env node

import WebSocket from "ws";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync, spawn, ChildProcess } from "child_process";

// Type definitions
interface AudioPlayerCommand {
  cmd: string;
  args: string[];
  useFilePath?: boolean;
}

interface TtsConfig {
  speaker: string;
  modelId: string;
  audioFormat: string;
  samplingRate: number;
  speedAlpha: number;
  reduceLatency: boolean;
  initialBufferSize: number;
}

interface TimestampData {
  words: string[];
  start: number[];
  end: number[];
}

interface AudioChunkMessage {
  type: "chunk";
  data: string;
  contextId: string | null;
}

interface TimestampsMessage {
  type: "timestamps";
  word_timestamps: TimestampData;
}

interface ErrorMessage {
  type: "error";
  message: string;
}

type WebSocketMessage = AudioChunkMessage | TimestampsMessage | ErrorMessage;

// Default configuration
const DEFAULT_CONFIG: TtsConfig = {
  speaker: "cove",
  modelId: "mistv2",
  audioFormat: "mp3",
  samplingRate: 22050,
  speedAlpha: 1.0,
  reduceLatency: true,
  initialBufferSize: 2,
};

// Get API key from environment
function getApiKey(): string {
  const RIME_API_KEY = process.env.RIME_API_KEY;
  if (!RIME_API_KEY) {
    throw new Error("RIME_API_KEY environment variable is not set");
  }
  return RIME_API_KEY;
}

// Select an appropriate audio player command based on OS
function getAudioPlayerCommand(): AudioPlayerCommand {
  const platform = os.platform();

  if (platform === "darwin") {
    // macOS - afplay supports streaming
    return { cmd: "afplay", args: [] };
  } else if (platform === "win32") {
    // Windows - try to find a streaming player
    try {
      execSync("where ffplay");
      return {
        cmd: "ffplay",
        args: ["-nodisp", "-autoexit", "-hide_banner", "-loglevel", "error"],
      };
    } catch (e) {
      // ffplay not found, try powershell
      return {
        cmd: "powershell",
        args: ["-c", '(New-Object Media.SoundPlayer "$args[0]").PlaySync()'],
        useFilePath: true,
      };
    }
  } else {
    // Linux and others
    const players: AudioPlayerCommand[] = [
      { cmd: "ffplay", args: ["-nodisp", "-autoexit", "-hide_banner", "-loglevel", "error"] },
      { cmd: "mpg123", args: [] },
      { cmd: "mplayer", args: [] },
      { cmd: "aplay", args: ["-q"] },
    ];

    for (const player of players) {
      try {
        execSync(`which ${player.cmd}`);
        return player;
      } catch (e) {
        // Player not found, try next one
        continue;
      }
    }

    throw new Error(
      "No suitable audio player found. Please install mpg123, mplayer, aplay, or ffplay."
    );
  }
}

/**
 * Play text using Rime's WebSockets API
 * @param text - The text to convert to speech
 * @param customConfig - Optional configuration overrides
 * @returns A promise that resolves when audio playback completes
 */
export async function playText(text: string, customConfig?: Partial<TtsConfig>): Promise<void> {
  // Merge default config with any custom options
  const config: TtsConfig = { ...DEFAULT_CONFIG, ...customConfig };

  console.error("Starting Rime WebSockets streaming with text:");
  console.error(`"${text}"`);

  try {
    const apiKey = getApiKey();

    // Create temporary directory for audio files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rime-stream-"));

    // Clean up function to remove temp files
    const cleanup = () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (error) {
        console.error("Failed to clean up temporary directory:", error);
      }
    };

    // JSON based API
    const url = `wss://users-ws.rime.ai/ws2?speaker=${config.speaker}&modelId=${config.modelId}&audioFormat=${config.audioFormat}&samplingRate=${config.samplingRate}&speedAlpha=${config.speedAlpha}&reduceLatency=${config.reduceLatency}`;

    return new Promise((resolve, reject) => {
      const ws = new WebSocket(url, {
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });

      // Create a combined audio file
      const audioFilePath = path.join(tmpDir, "combined-audio.mp3");
      const audioFileStream = fs.createWriteStream(audioFilePath);

      let chunkCount = 0;
      let isPlaying = false;
      let playerProcess: ChildProcess | null = null;

      // Start playback when we have enough buffer
      function startPlayback() {
        if (isPlaying) return;

        console.error("Starting audio playback...");
        isPlaying = true;

        try {
          const player = getAudioPlayerCommand();

          if (player.useFilePath) {
            // Some players need the file path as an argument
            playerProcess = spawn(player.cmd, [...player.args, audioFilePath]);
          } else {
            // Others can read from stdin or file path
            playerProcess = spawn(player.cmd, [...player.args, audioFilePath]);
          }

          playerProcess.stdout?.on("data", (data) => {
            console.error(`Player output: ${data}`);
          });

          playerProcess.stderr?.on("data", (data) => {
            console.error(`Player error: ${data}`);
          });

          playerProcess.on("close", (code) => {
            console.error(`Player process exited with code ${code || 0}`);
            cleanup();
            resolve();
          });

          playerProcess.on("error", (error: Error) => {
            console.error("Player process error:", error);
            cleanup();
            reject(error);
          });
        } catch (err) {
          cleanup();
          reject(err);
        }
      }

      ws.on("open", function open() {
        console.error("WebSocket connection established.");

        // Send the entire text at once
        ws.send(JSON.stringify({ text }));

        // To end the session when done
        setTimeout(() => {
          ws.send(JSON.stringify({ operation: "eos" }));
        }, 1000); // Give some time for the server to process the text
      });

      ws.on("message", function incoming(data: WebSocket.RawData) {
        try {
          const message = JSON.parse(data.toString()) as WebSocketMessage;

          if (message.type === "chunk" && "data" in message) {
            // Decode base64 data
            const audioBuffer = Buffer.from(message.data, "base64");

            // Append to the combined file
            audioFileStream.write(audioBuffer);

            chunkCount++;
            console.error(`Received chunk ${chunkCount} (${audioBuffer.length} bytes)`);

            // Start playback after buffering enough chunks
            if (chunkCount >= config.initialBufferSize && !isPlaying) {
              startPlayback();
            }
          } else if (message.type === "timestamps") {
            // Optional: log the timestamps if needed for debugging
            // console.error("Word timestamps received");
          } else if (message.type === "error") {
            console.error("Received error:", message.message);
            cleanup();
            reject(new Error(message.message));
          }
        } catch (error) {
          console.error("Error processing message:", error);
          cleanup();
          reject(error);
        }
      });

      ws.on("close", function close() {
        console.error("WebSocket connection closed");

        // Ensure file stream is properly closed
        audioFileStream.end();

        // If we never started playback (e.g., very short audio), start it now
        if (!isPlaying) {
          startPlayback();
        }
      });

      ws.on("error", function error(err: Error) {
        console.error("WebSocket error:", err);
        cleanup();
        reject(err);
      });
    });
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

// Only run the main function when executed directly
// if (import.meta.url === `file://${process.argv[1]}`) {
//   // Text to speak from command line or default
//   const DEFAULT_TEXT =
//     "This is a test of the Rime WebSockets streaming API. Audio should be played as it arrives, providing a more natural experience.";
//   const text = process.argv[2] || DEFAULT_TEXT;

//   // Run the streaming function
//   playText(text).catch((error) => {
//     console.error("Fatal error:", error);
//     process.exit(1);
//   });
// }
