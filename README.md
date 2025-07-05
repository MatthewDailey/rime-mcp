[![MseeP.ai Security Assessment Badge](https://mseep.net/pr/matthewdailey-rime-mcp-badge.png)](https://mseep.ai/app/matthewdailey-rime-mcp)

# Rime MCP 

[![rime](rime-logo.png)](https://www.rime.ai)

A Model Context Protocol (MCP) server that provides text-to-speech capabilities using the Rime API. This server downloads audio and plays it using the system's native audio player.

## Features

- Exposes a `speak` tool that converts text to speech and plays it through system audio
- Uses Rime's high-quality voice synthesis API

## Requirements

- Node.js 16.x or higher
- A working audio output device
- macOS: Uses `afplay`

There's sample code from Claude for the following that is not tested 🤙✨
  - Windows: Built-in Media.SoundPlayer (PowerShell)
  - Linux: mpg123, mplayer, aplay, or ffplay

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

[![Demo of Rime MCP in Cursor](https://img.youtube.com/vi/tYqTACgijxk/0.jpg)](https://www.youtube.com/watch?v=tYqTACgijxk)


### Example 1: Coding agent announcements

```
"RIME_WHEN_TO_SPEAK": "Always conclude your answers by speaking.",
"RIME_GUIDANCE": "Give a brief overview of the answer. If any files were edited, list them."
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

## Badges

<a href="https://glama.ai/mcp/servers/@MatthewDailey/rime-mcp">
  <img width="380" height="200" src="https://glama.ai/mcp/servers/@MatthewDailey/rime-mcp/badge" alt="Rime MCP server" />
</a>
<a href="https://smithery.ai/server/@MatthewDailey/rime-mcp"><img alt="Smithery Badge" src="https://smithery.ai/badge/@MatthewDailey/rime-mcp"></a>

### Installing via Smithery

To install Rime Text-to-Speech Server for Claude Desktop automatically via [Smithery](https://smithery.ai/server/@MatthewDailey/rime-mcp):

```bash
npx -y @smithery/cli install @MatthewDailey/rime-mcp --client claude
```
