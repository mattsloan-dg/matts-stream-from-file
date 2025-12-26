import { createReadStream, readFileSync } from "fs";
import WebSocket from "ws";
import Speaker from "speaker";
import dotenv from "dotenv";
dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

// Function to read WAV file header and extract audio format information
function getWavFormat(filePath) {
  const buffer = readFileSync(filePath);

  // Check if it's a valid WAV file
  if (
    buffer.toString("ascii", 0, 4) !== "RIFF" ||
    buffer.toString("ascii", 8, 12) !== "WAVE"
  ) {
    throw new Error("Not a valid WAV file");
  }

  // Read WAV format information from header
  const channels = buffer.readUInt16LE(22); // Bytes 22-23: Number of channels
  const sampleRate = buffer.readUInt32LE(24); // Bytes 24-27: Sample rate
  const bitDepth = buffer.readUInt16LE(34); // Bytes 34-35: Bits per sample

  return { channels, sampleRate, bitDepth };
}

function connectWithAuth(url, authToken, filePath) {
  const ws = new WebSocket(url, {
    headers: {
      Authorization: `Token ${authToken}`,
    },
  });

  ws.on("open", () => {
    console.log("WebSocket connection established");

    streamAudioData();
  });

  ws.on("message", (data) => {
    //console.log("Received:", data.toString());
    processTranscriptMessage(data);
  });

  ws.on("error", (error) => {
    console.error("WebSocket error:", error);
  });

  ws.on("close", (code, reason) => {
    console.log("Connection closed:", code, reason.toString());
  });

  function streamAudioData() {
    // Get audio format information from the WAV file
    const audioFormat = getWavFormat(filePath);
    console.log(
      `Detected audio format: ${audioFormat.sampleRate}Hz, ${audioFormat.bitDepth}-bit, ${audioFormat.channels} channel(s)`
    );

    // Create speaker instance for audio playback using detected format
    const speaker = new Speaker({
      channels: audioFormat.channels,
      bitDepth: audioFormat.bitDepth,
      sampleRate: audioFormat.sampleRate,
    });

    const fileStream = createReadStream(filePath, {
      start: 44, // Skip WAV header (typically 44 bytes)
      highWaterMark: 4096, // Smaller chunks for better streaming
    });

    console.log("Starting audio playback through speakers...");

    fileStream.on("data", (chunk) => {
      // Send to WebSocket for transcription
      ws.send(chunk);

      // Send to speaker for playback
      speaker.write(chunk);
    });

    fileStream.on("end", () => {
      console.log("File streaming complete");

      // Close the speaker when done
      speaker.end();

      setTimeout(() => {
        ws.send(JSON.stringify({ type: "keepAlive" }));
      }, 1000);
    });

    fileStream.on("error", (error) => {
      console.error("File stream error:", error);
    });

    speaker.on("close", () => {
      console.log("Audio playback finished");
    });
  }

  // THIS FUNC CAN BE RESUED! IT SPLITS DIARIZATION ON WORD LEVEL.
  // CAVEAT - STREAMING USE CASE B/C IT LOOKS AT WORDS OBJECT.
  function processTranscriptMessage(data) {
    const message = JSON.parse(data);

    // Check if this is a Results message with the expected structure
    if (
      message.type !== "Results" ||
      !message.channel?.alternatives?.[0]?.words
    ) {
      return;
    }

    const words = message.channel.alternatives[0].words;
    const transcript = message.channel.alternatives[0].transcript;

    // Check if all speakers are the same
    const firstSpeaker = words[0]?.speaker;
    const allSameSpeaker = words.every((word) => word.speaker === firstSpeaker);

    if (allSameSpeaker) {
      // All words from same speaker - print the full transcript
      console.log(`[Speaker ${firstSpeaker}]: ${transcript}`);
    } else {
      // Multiple speakers - group words by speaker
      let currentSpeaker = null;
      let currentWords = [];

      words.forEach((wordObj) => {
        if (currentSpeaker === null || currentSpeaker !== wordObj.speaker) {
          // Speaker changed - output previous speaker's words (if any)
          if (currentWords.length > 0) {
            console.log(
              `[Speaker ${currentSpeaker}]: ${currentWords.join(" ")}`
            );
          }
          // Start new speaker group
          currentSpeaker = wordObj.speaker;
          currentWords = [wordObj.word];
        } else {
          // Same speaker - add word to current group
          currentWords.push(wordObj.word);
        }
      });

      // Output the last speaker's words
      if (currentWords.length > 0) {
        console.log(`[Speaker ${currentSpeaker}]: ${currentWords.join(" ")}`);
      }
    }
  }

  return ws;
}

// Detect audio format from the file
const filePath = "./example.wav";
const audioFormat = getWavFormat(filePath);

// Build WebSocket URL with detected sample rate
const wsUrl = `wss://api.deepgram.com/v1/listen?sample_rate=${audioFormat.sampleRate}&encoding=linear16&smart_format=true`;

console.log(
  `Connecting to Deepgram with sample rate: ${audioFormat.sampleRate}Hz`
);

// SET PARAMS HERE - now using detected values
// ALSO CHECK THE URL FOR SANDBOX or PROD
connectWithAuth(wsUrl, DEEPGRAM_API_KEY, filePath);
