# MCP Rime Server

A Model Context Protocol (MCP) server that provides text-to-speech capabilities using the Rime API. This server downloads audio and plays it using the system's native audio player.

## Features

- Exposes a `speak` tool that converts text to speech and plays it through system audio
- Uses Rime's high-quality voice synthesis API
- Supports various voice options and customization parameters
- Cross-platform audio playback support

## Requirements

- Node.js 16.x or higher
- A working audio output device
- One of the following audio players (automatically detected):
  - Linux: mpg123, mplayer, aplay, or ffplay
  - macOS: Built-in afplay (included with macOS)
  - Windows: Built-in Media.SoundPlayer (PowerShell)

## MCP Configuration

```
"ref": {
  "command": "npx",
  "args": ["rime-mcp"],
  "env": {
      RIME_API_KEY=your_api_key_here

      # Optional configuration
      RIME_GUIDANCE="<guide how the agent speaks>"
      RIME_WHO_TO_ADDRESS="<your name>"
      RIME_WHEN_TO_SPEAK="<tell the agent when to speak>"
      RIME_VOICE="cove" 
  }
}
```

All of the optional env vars are part of the tool definition and are prompts to 

All voice options are [listed here](https://users.rime.ai/data/voices/all-v2.json).

You can get your API key from the [Rime Dashboard](https://rime.ai/dashboard/tokens).

The following environment variables can be used to customize the behavior:

- `RIME_GUIDANCE`: The main description of when and how to use the speak tool
- `RIME_WHO_TO_ADDRESS`: Who the speech should address (default: "user")
- `RIME_WHEN_TO_SPEAK`: When the tool should be used (default: "when asked to speak or when finishing a command")
- `RIME_VOICE`: The default voice to use (default: "cove")

## Example use cases

### Example 1: Coding agent announcements

```
RIME_WHEN_TO_SPEAK="Speak when you complete a multi-file code change."
RIME_GUIDANCE="Say a 1 sentance overview of the change and list all files that were edited."
```

### Example 2: Learn how the kids talk these days

```
RIME_GUIDANCE="Use phrases and slang common among Gen Alpha."
RIME_WHO_TO_ADDRESS="Matt"
RIME_WHEN_TO_SPEAK="when asked to speak"
```

### Example 3: Different languages based on context

```
RIME_VOICE="use 'cove' when talking about Typescript and 'antoine' when talking about Python"
```


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

## License

MIT