# MCP Rime Server

A Model Context Protocol (MCP) server that provides text-to-speech capabilities using the Rime API. This server downloads audio and plays it using the system's native audio player.

## Features

- Exposes a `speak` tool that converts text to speech and plays it through system audio
- Uses Rime's high-quality voice synthesis API
- Supports various voice options and customization parameters
- Detailed progress logging to the console
- Cross-platform audio playback support

## Requirements

- Node.js 16.x or higher
- A working audio output device
- One of the following audio players (automatically detected):
  - Linux: mpg123, mplayer, aplay, or ffplay
  - macOS: Built-in afplay (included with macOS)
  - Windows: Built-in Media.SoundPlayer (PowerShell)

## Installation

```bash
npm install mcp-rime
```

## Configuration

Create a `.env` file in your project root with your Rime API key:

```
RIME_API_KEY=your_api_key_here
```

You can get your API key from the [Rime Dashboard](https://rime.ai/dashboard/tokens).

## Usage

1. Start the server:
```bash
npx mcp-rime
```

2. The server exposes a `speak` tool with the following parameters:

- `text` (required): The text to speak aloud
- `speaker` (optional): The voice to use (defaults to "cove")
- `speedAlpha` (optional): Speech speed multiplier (default: 1.0)
- `reduceLatency` (optional): Whether to optimize for lower latency (default: false)

3. When the `speak` tool is called, it will:
   - Connect to Rime's API and download the speech audio
   - Save the audio to a temporary file
   - Play the audio using your system's native audio player
   - Clean up temporary files automatically

## How It Works

1. The server makes an HTTP request to Rime's TTS API
2. The audio data is streamed into a temporary file
3. Once the download is complete, the appropriate audio player for your OS is used to play the file
4. After playback is complete, temporary files are cleaned up

## Development

1. Install dependencies:
```bash
npm install
```

2. Build the server:
```bash
npm run build
```

3. Run in development mode with hot reload:
```bash
npm run dev
```

## Progress Reporting

The server logs detailed progress information to the console as it processes audio:

- When speech synthesis starts
- When audio data is received
- When the audio file is saved
- When audio playback starts and completes

## Troubleshooting

If you experience issues with audio playback:

1. Make sure you have one of the supported audio players installed for your OS
2. Check that your system's audio is working correctly
3. Verify that your Rime API key is valid and has sufficient quota

## License

MIT

# Rime TTS Streaming Module

A TypeScript/JavaScript module for streaming text-to-speech audio from Rime's WebSockets API.

## Features

- Stream audio from Rime's TTS service using WebSockets
- Plays audio chunks as they arrive (reducing perceived latency)
- Works across platforms (macOS, Windows, Linux)
- Can be used as a command-line tool or imported as a module
- Provides TypeScript types for better developer experience
- Automatically cleans up temporary files

## Prerequisites

- Node.js v14 or higher
- A Rime API key (get one at https://docs.rime.ai)
- One of the following audio players (depending on your OS):
  - macOS: afplay (built-in)
  - Windows: Built-in SoundPlayer or ffplay
  - Linux: mpg123, mplayer, aplay, or ffplay

## Installation

1. Clone or download this repository
2. Install dependencies:
   ```
   npm install
   ```
3. Add your Rime API key to a `.env` file:
   ```
   RIME_API_KEY=your_api_key_here
   ```

## Usage

### As a Command-Line Tool

Run the script with default text:

```
npm run stream
```

Or specify your own text:

```
npm run stream -- "Your custom text to be spoken goes here."
```

### As a Module in Your TypeScript/JavaScript Project

```typescript
// Import the playText function
import { playText } from './stream-audio.js';

// Basic usage
await playText("Hello, this is some text to speak.");

// With custom configuration
await playText(
  "This text will be spoken with custom settings.",
  { 
    speaker: "breeze", 
    speedAlpha: 1.2,
    initialBufferSize: 3
  }
);
```

See `example.ts` for a complete example of using the module.

## Configuration Options

The `playText` function accepts a second parameter with configuration options:

```typescript
interface TtsConfig {
  speaker: string;         // Voice to use (default: "cove")
  modelId: string;         // TTS model to use (default: "mistv2")
  audioFormat: string;     // Output format (default: "mp3")
  samplingRate: number;    // Audio sampling rate (default: 22050)
  speedAlpha: number;      // Speed multiplier (default: 1.0, lower is faster)
  reduceLatency: boolean;  // Optimize for lower latency (default: true)
  initialBufferSize: number; // Chunks to buffer before playback (default: 2)
}
```

## Available Voices

Check the [Rime documentation](https://docs.rime.ai/api-reference/voices) for a complete list of available voices.

## Development

Build the TypeScript files:

```
npm run build
```

Run the example:

```
npx ts-node example.ts
```