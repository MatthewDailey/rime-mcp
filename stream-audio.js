#!/usr/bin/env node

import WebSocket from "ws";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";
import { execSync, spawn } from "child_process";

dotenv.config();

// Get API key from environment
const RIME_API_KEY = process.env.RIME_API_KEY;
if (!RIME_API_KEY) {
  console.error("Error: RIME_API_KEY environment variable is not set");
  process.exit(1);
}

// Text to speak
const DEFAULT_TEXT =
  "This is a test of the Rime WebSockets streaming API. Audio should be played as it arrives, providing a more natural experience.";
const text = process.argv[2] || DEFAULT_TEXT;

// Configuration
const config = {
  speaker: "cove",
  modelId: "mistv2",
  audioFormat: "mp3",
  samplingRate: 22050,
  speedAlpha: 1.0,
  reduceLatency: true,
  // Amount of audio to buffer before starting playback (in chunks)
  initialBufferSize: 2,
};

// Create temporary directory for audio files
const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "rime-stream-"));
process.on("exit", () => {
  try {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  } catch (error) {
    console.error("Failed to clean up temporary directory:", error);
  }
});

// Select an appropriate audio player command based on OS
function getAudioPlayerCommand() {
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
    const players = [
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

    console.error(
      "No suitable audio player found. Please install mpg123, mplayer, aplay, or ffplay."
    );
    process.exit(1);
  }
}

async function streamAndPlay() {
  console.log("Starting Rime WebSockets streaming with text:");
  console.log(`"${text}"`);

  // JSON based API
  const url = `wss://users-ws.rime.ai/ws2?speaker=${config.speaker}&modelId=${config.modelId}&audioFormat=${config.audioFormat}&samplingRate=${config.samplingRate}&speedAlpha=${config.speedAlpha}&reduceLatency=${config.reduceLatency}`;

  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Bearer ${RIME_API_KEY}`,
    },
  });

  // Create a combined audio file
  const audioFilePath = path.join(tmpDir, "combined-audio.mp3");
  const audioFileStream = fs.createWriteStream(audioFilePath);

  let chunkCount = 0;
  let isPlaying = false;
  let playerProcess = null;

  // Start playback when we have enough buffer
  function startPlayback() {
    if (isPlaying) return;

    console.log("Starting audio playback...");
    isPlaying = true;

    const player = getAudioPlayerCommand();

    if (player.useFilePath) {
      // Some players need the file path as an argument
      playerProcess = spawn(player.cmd, [...player.args, audioFilePath]);
    } else {
      // Others can read from stdin or file path
      playerProcess = spawn(player.cmd, [...player.args, audioFilePath]);
    }

    playerProcess.stdout.on("data", (data) => {
      console.log(`Player output: ${data}`);
    });

    playerProcess.stderr.on("data", (data) => {
      console.error(`Player error: ${data}`);
    });

    playerProcess.on("close", (code) => {
      console.log(`Player process exited with code ${code}`);
      process.exit(0);
    });
  }

  ws.on("open", function open() {
    console.log("WebSocket connection established.");

    // Send the entire text at once
    ws.send(JSON.stringify({ text }));

    // To end the session when done
    setTimeout(() => {
      ws.send(JSON.stringify({ operation: "eos" }));
    }, 1000); // Give some time for the server to process the text
  });

  ws.on("message", function incoming(data) {
    try {
      const message = JSON.parse(data);

      if (message.type === "chunk" && message.data) {
        // Decode base64 data
        const audioBuffer = Buffer.from(message.data, "base64");

        // Append to the combined file
        audioFileStream.write(audioBuffer);

        chunkCount++;
        console.log(`Received chunk ${chunkCount} (${audioBuffer.length} bytes)`);

        // Start playback after buffering enough chunks
        if (chunkCount >= config.initialBufferSize && !isPlaying) {
          startPlayback();
        }
      } else if (message.type === "timestamps") {
        if (message.word_timestamps) {
          // Optional: log the timestamps if needed for debugging
          // console.log("Word timestamps received");
        }
      } else if (message.type === "error") {
        console.error("Received error:", message.message);
      }
    } catch (error) {
      console.error("Error processing message:", error);
    }
  });

  ws.on("close", function close() {
    console.log("WebSocket connection closed");

    // Ensure file stream is properly closed
    audioFileStream.end();

    // If we never started playback (e.g., very short audio), start it now
    if (!isPlaying) {
      startPlayback();
    }
  });

  ws.on("error", function error(err) {
    console.error("WebSocket error:", err);
    process.exit(1);
  });
}

// Run the streaming function
streamAndPlay().catch((error) => {
  console.error("Error:", error);
  process.exit(1);
});
