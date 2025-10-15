# Matt's Stream File File App

A Node.js application that demonstrates streaming a prerecorded file to the Deepgram websocket.

## Setup

### 1. Install Dependencies

First, install all required packages:

```bash
npm install
```

### 2. Configure Environment Variables

Create a copy of the sample environment file and add your Deepgram API key:

```bash
cp sample.env .env
```

Then open the `.env` file and add your Deepgram API key:

```
DEEPGRAM_API_KEY=<your-api-key>
```

### 3. Configure Audio Processing Parameters

Open your main application file and locate the `connectWithAuth()` function. Adjust the parameters according to your needs:

```javascript
connectWithAuth(
  "wss://api.sandbox.deepgram.com/v1/listen?sample_rate=16000&encoding=linear16&diarize=true",
  DEEPGRAM_API_KEY,
  "./athena.wav"
);
```

**Parameter Details:**

- **First argument (WebSocket URL)**: Update the URL parameters based on your audio file specifications:
  - `sample_rate`: Audio sample rate (e.g., 16000, 44100, 48000)
  - `encoding`: Audio encoding format (e.g., linear16, mp3, wav)
  - `diarize`: Enable speaker diarization (true/false)
  - Additional parameters can be added as needed (refer to Deepgram API documentation)

- **Second argument**: Your Deepgram API key (automatically loaded from `.env`)

- **Third argument (File path)**: Update this to the path of your audio file (e.g., `"./your-audio-file.wav"`)

### 4. Run the Application

Start the application:

```bash
npm start
```

## Troubleshooting

- Ensure your audio file exists at the specified path
- Verify that your Deepgram API key is valid and has the necessary permissions
- Check that your audio file parameters match the WebSocket URL configuration

## Additional Resources

- [Deepgram API Documentation](https://developers.deepgram.com/)
- [Deepgram WebSocket Parameters](https://developers.deepgram.com/reference/listen-live)
