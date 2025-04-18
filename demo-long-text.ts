#!/usr/bin/env node

import { playText } from "./stream-audio.js";

const LONG_TEXT = `
In the vast expanse of the digital realm, where bits and bytes dance in endless streams,
we find ourselves at the intersection of technology and human experience. The art of
text-to-speech synthesis represents one of humanity's most fascinating achievements,
bridging the gap between written word and spoken language. As we delve deeper into
this technological marvel, we discover layers of complexity that challenge our
understanding of both human cognition and machine learning. The journey from text
to speech is not merely a conversion of symbols to sound, but rather a sophisticated
orchestration of linguistic analysis, phonetic synthesis, and real-time audio
processing. Through careful optimization and intelligent buffering strategies, we
can create systems that not only speak with remarkable clarity but do so with
minimal latency, enhancing the natural flow of human-computer interaction.
`.trim();

async function demo() {
  console.log("\n=== Starting Demonstration ===\n");

  const startTime = Date.now();
  console.log(`[${new Date().toISOString()}] Starting text-to-speech streaming...`);

  await playText(LONG_TEXT);

  const endTime = Date.now();
  console.log(`[${new Date().toISOString()}] Speech playback completed`);
  console.log(`\nTotal execution time: ${((endTime - startTime) / 1000).toFixed(2)} seconds`);
  console.log("\n=== Demonstration Complete ===\n");
}

demo().catch((error) => {
  console.error("Error during demonstration:", error);
  process.exit(1);
});
