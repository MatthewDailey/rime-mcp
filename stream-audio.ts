#!/usr/bin/env node

import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync, spawn, ChildProcess } from "child_process";
// Import for node-fetch v3.x
import fetch from "node-fetch";

interface AudioPlayerCommand {
  cmd: string;
  args: string[];
  useFilePath?: boolean;
}

interface TtsConfig {
  speaker: string;
  audioFormat: string;
  samplingRate: number;
  speedAlpha: number;
  reduceLatency: boolean;
}

const DEFAULT_CONFIG: TtsConfig = {
  speaker: "luna",
  audioFormat: "mp3",
  samplingRate: 22050,
  speedAlpha: 1.0,
  reduceLatency: false,
};

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
 * Play text using Rime's REST API
 * @param text - The text to convert to speech
 * @param customConfig - Optional configuration overrides
 * @returns A promise that resolves when audio playback completes
 */
export async function playText(text: string, customConfig?: Partial<TtsConfig>): Promise<void> {
  const config: TtsConfig = { ...DEFAULT_CONFIG, ...customConfig };

  console.error("Starting Rime TTS with text:");
  console.error(`"${text}"`);

  try {
    const apiKey = getApiKey();

    // Create temporary directory for audio files
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rime-stream-"));
    const audioFilePath = path.join(tmpDir, "audio.mp3");

    const cleanup = () => {
      try {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      } catch (error) {
        console.error("Failed to clean up temporary directory:", error);
      }
    };

    // Prepare API request
    const modelId = findModelId(config.speaker);

    const options = {
      method: "POST",
      headers: {
        Accept: "audio/mp3",
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        speaker: config.speaker,
        text: text,
        modelId: modelId,
        lang: "eng",
        samplingRate: config.samplingRate,
        speedAlpha: config.speedAlpha,
        reduceLatency: config.reduceLatency,
      }),
    };

    // Make API request
    console.error("Sending request to Rime API...");
    const response = await fetch("https://users.rime.ai/v1/rime-tts", options);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(
        `API request failed: ${response.status} ${response.statusText} - ${errorText}`
      );
    }

    // Get audio data as arrayBuffer
    const audioBuffer = await response.arrayBuffer();

    // Write audio data to file
    fs.writeFileSync(audioFilePath, Buffer.from(audioBuffer));
    console.error(`Audio saved to ${audioFilePath}`);

    return new Promise((resolve, reject) => {
      try {
        console.error("Starting audio playback...");
        const player = getAudioPlayerCommand();

        const playerProcess = spawn(player.cmd, [...player.args, audioFilePath]);

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
    });
  } catch (error) {
    console.error("Error:", error);
    throw error;
  }
}

function findModelId(speaker: string): string {
  const voices = JSON.parse(fs.readFileSync("voices.json", "utf8"));
  // Find the model ID for the given speaker
  // Default to "mist" model if not found
  let modelId = "mist";

  // Check if the speaker exists in any model
  for (const [model, languages] of Object.entries(voices)) {
    for (const [lang, speakers] of Object.entries(languages as { [key: string]: string[] })) {
      if (Array.isArray(speakers) && speakers.includes(speaker)) {
        modelId = model;
        return modelId;
      }
    }
  }

  // If we reach here, the speaker wasn't found
  console.error(`Speaker "${speaker}" not found in voices.json, defaulting to "mist" model`);
  return modelId;
}
