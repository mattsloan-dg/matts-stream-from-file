import { createReadStream } from "fs";
import WebSocket from "ws";
import dotenv from "dotenv";
dotenv.config();

const DEEPGRAM_API_KEY = process.env.DEEPGRAM_API_KEY;

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
    const fileStream = createReadStream(filePath, {
      start: 44, // Skip WAV header (typically 44 bytes)
      highWaterMark: 4096, // Smaller chunks for better streaming
    });

    fileStream.on("data", (chunk) => {
      ws.send(chunk);
    });

    fileStream.on("end", () => {
      console.log("File streaming complete");
      setTimeout(() => {
        ws.send(JSON.stringify({ type: "keepAlive" }));
      }, 1000);
    });

    fileStream.on("error", (error) => {
      console.error("File stream error:", error);
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

// SET PARAMS MANUALLY HERE in the URL
// ALSO CHECK THE URL FOR SANDBOX or PROD
connectWithAuth(
  "wss://api.sandbox.deepgram.com/v1/listen?sample_rate=16000&encoding=linear16&diarize=true",
  DEEPGRAM_API_KEY,
  "./athena.wav"
);
