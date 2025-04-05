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