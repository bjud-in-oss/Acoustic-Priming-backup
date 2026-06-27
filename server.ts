import express from "express";
import { createServer } from "http";
import process from "process";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import * as path from "path";
import fs from "fs/promises";
import https from "https";
import http from "http";
import url from "url";

const PORT = 3000;

const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
});

// Helper function for web scraping
function fetchHtmlAndExtractLinks(targetUrl: string): Promise<Array<{text: string, url: string}>> {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = url.parse(targetUrl);
      const isHttps = parsedUrl.protocol === "https:";
      const client = isHttps ? https : http;

      const options = {
        hostname: parsedUrl.hostname,
        path: parsedUrl.path || "/",
        port: parsedUrl.port || (isHttps ? 443 : 80),
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36"
        },
        timeout: 10000
      };

      const req = client.get(options, (res) => {
        if (res.statusCode && res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
          const redirectUrl = url.resolve(targetUrl, res.headers.location);
          return fetchHtmlAndExtractLinks(redirectUrl).then(resolve).catch(reject);
        }

        if (res.statusCode !== 200) {
          return reject(new Error(`Website returned status code: ${res.statusCode}`));
        }

        let html = "";
        res.on("data", chunk => html += chunk);
        res.on("end", () => {
          const links = [];
          const regex = /<a\s+(?:[^>]*?\s+)?href="([^"]+)"[^>]*>(.*?)<\/a>/gis;
          let match;
          
          while ((match = regex.exec(html)) !== null) {
            let href = match[1].trim();
            let text = match[2].replace(/<[^>]*>/g, "").trim();
            
            if (href && !href.startsWith("http://") && !href.startsWith("https://")) {
              href = url.resolve(targetUrl, href);
            }

            if (href.startsWith("http")) {
              // Automatic hashtag cleaning
              const cleanUrl = href.split("#")[0];
              links.push({ text: text || cleanUrl, url: cleanUrl });
            }
          }

          const uniqueLinks = [];
          const seen = new Set();
          for (const item of links) {
            if (!seen.has(item.url)) {
              seen.add(item.url);
              uniqueLinks.push(item);
            }
          }

          resolve(uniqueLinks);
        });
      });

      req.on("timeout", () => {
        req.destroy();
        reject(new Error("Timeout fetching webpage (10 seconds)"));
      });
      req.on("error", err => reject(err));
    } catch (err) {
      reject(err);
    }
  });
}

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/live" });

  wss.on("connection", async (clientWs) => {
    function safeClientSend(payload: any) {
      if (clientWs.readyState === 1) { // 1 is OPEN
        try {
          clientWs.send(JSON.stringify(payload));
        } catch (err) {
          console.error("Failed to send message to client:", err);
        }
      }
    }

    let session: any = null;

    try {
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: async (message: LiveServerMessage) => {
            try {
              // Forward audio to frontend
              const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audio) {
                safeClientSend({ type: "status", status: "speaking" });
                safeClientSend({ type: "audio", audio });
              }
              if (message.serverContent?.interrupted) {
                safeClientSend({ type: "interrupted" });
                safeClientSend({ type: "status", status: "idle" });
              }
              if (message.serverContent?.turnComplete) {
                safeClientSend({ type: "status", status: "idle" });
              }

              // Transcription
              const text = message.serverContent?.outputTranscription?.text;
              if (text) {
                  safeClientSend({ type: "transcription", text, role: "agent" });
              }
              const userText = message.serverContent?.inputTranscription?.text;
              if (userText) {
                  safeClientSend({ type: "transcription", text: userText, role: "user" });
              }

              // Handle tools
              if (message.toolCall) {
                  const call = message.toolCall.functionCalls?.[0];
                  if (call) {
                      safeClientSend({ type: "log", message: `Tool invoked: ${call.name}` });
                      
                      if (call.name === "extract_web_sources") {
                          const targetUrl = call.args.url as string;
                          safeClientSend({ type: "status", status: "scraping" });
                          try {
                              const links = await fetchHtmlAndExtractLinks(targetUrl);
                              session.sendToolResponse({
                                  functionResponses: [{
                                      id: call.id,
                                      name: call.name,
                                      response: { links }
                                  }]
                              });
                          } catch (err: any) {
                              session.sendToolResponse({
                                  functionResponses: [{
                                      id: call.id,
                                      name: call.name,
                                      response: { error: err.message }
                                  }]
                              });
                          }
                      } else if (call.name === "open_webpage") {
                          const targetUrl = call.args.url as string;
                          // Forward to frontend to handle
                          safeClientSend({ type: "toolCall", name: "open_webpage", url: targetUrl });
                          
                          // Respond to AI immediately as visual action is triggered
                          session.sendToolResponse({
                              functionResponses: [{
                                  id: call.id,
                                  name: call.name,
                                  response: { status: "success", message: `Opening ${targetUrl}` }
                              }]
                          });
                      } else if (call.name === "goToStep") {
                          // Existing workflow control forwarding
                          const step = call.args.step;
                          safeClientSend({ type: "toolCall", name: "goToStep", step });
                          session.sendToolResponse({
                              functionResponses: [{
                                  id: call.id,
                                  name: call.name,
                                  response: { status: "success" }
                              }]
                          });
                      }
                  }
              }
            } catch (msgErr) {
              console.error("Error handling message from Gemini:", msgErr);
            }
          },
        },
        config: {
          responseModalities: [Modality.AUDIO],
          systemInstruction: "Du är H, en engagerande, pedagogisk och strukturerad interaktiv guide och diskussionsledare. Din uppgift är att hjälpa användaren att lära sig precis vad som helst – från religiösa handböcker och teknisk dokumentation till komplexa manualer och instruktioner på nätet. Du gör detta genom att hjälpa användaren att förbereda källor, ladda upp dem till NotebookLM, och sedan guida dem genom processen steg-för-steg.\n\nFölj dessa steg kronologiskt:\n1. Hälsa välkommen och fråga vad de vill lära sig idag eller om de har en specifik länk (t.ex. kyrkans handbok: https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=eng).\n2. När de anger en URL, kör verktyget `extract_web_sources` för att hämta underkällor i realtid. Presentera dem överskådligt.\n3. Kör verktyget `open_webpage` med 'https://notebooklm.google.com/' för att öppna NotebookLM åt dem. Instruera dem att skapa en ny antecknungsbok och klistra in källorna.\n4. Erbjud dig att skriva en skräddarsydd analysprompt baserad på deras mål.\n5. Interaktiv coachning: Låt användaren ställa frågor eller klistra in svar. Erbjud dig att öppna specifika underkällor under samtalets gång med `open_webpage`.",
          outputAudioTranscription: {},
          realtimeInputConfig: {
              automaticActivityDetection: { disabled: true }
          },
          tools: [{
              functionDeclarations: [
                  {
                      name: "extract_web_sources",
                      description: "Crawlar en webbsida i realtid, rensar bort hashtags/ankare, och extraherar unika underlänkar.",
                      parameters: {
                          type: Type.OBJECT,
                          properties: {
                              url: { type: Type.STRING, description: "The web page URL." }
                          },
                          required: ["url"]
                      }
                  },
                  {
                      name: "open_webpage",
                      description: "Öppnar den angivna sidan direkt i användarens lokala standardwebbläsare.",
                      parameters: {
                          type: Type.OBJECT,
                          properties: {
                              url: { type: Type.STRING, description: "The URL to open." }
                          },
                          required: ["url"]
                      }
                  },
                  {
                      name: "goToStep",
                      description: "Updates the visual step indicator.",
                      parameters: {
                          type: Type.OBJECT,
                          properties: {
                              step: { type: Type.NUMBER }
                          }
                      }
                  }
              ]
          }]
        },
      });

      clientWs.on("message", (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.event === "activityStart" && session) {
              session.sendRealtimeInput({ activityStart: {} });
          } else if (msg.event === "activityEnd" && session) {
              session.sendRealtimeInput({ activityEnd: {} });
              safeClientSend({ type: "status", status: "processing" });
          } else if (msg.audio && session) {
              session.sendRealtimeInput({
                audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
              });
          }
        } catch (err) {
          console.error("Error processing client message", err);
        }
      });

    } catch (err: any) {
        console.error("Gemini session connection failed: ", err);
        safeClientSend({ type: "error", message: err.message || JSON.stringify(err) });
    }
  });

  // REST API endpoints for workspace (omitted activePayload part for clarity, assuming it's replaced by system instruction)
  app.get("/api/workspace/list", async (req, res) => {
    try {
      const dirPath = req.query.dir as string || "";
      const cwd = process.cwd();
      const targetPath = path.join(cwd, dirPath);
      if (!targetPath.startsWith(cwd)) return res.status(403).json({ error: "Access denied" });
      const items = await fs.readdir(targetPath, { withFileTypes: true });
      const ignored = ['node_modules', '.git', 'dist'];
      const files = items
          .filter((item) => !ignored.includes(item.name) && !item.name.startsWith('.'))
          .map((item) => ({ name: item.name, path: path.join(dirPath, item.name).replace(/\\/g, '/'), isDirectory: item.isDirectory() }));
      res.json({ files });
    } catch (err: any) { res.status(500).json({ error: err.message }); }
  });

  app.get("/api/workspace/download", (req, res) => {
     const filename = req.query.path as string;
     if (!filename) return res.status(400).json({ error: "No path" });
     const filePath = path.join(process.cwd(), filename);
     res.download(filePath);
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({ server: { middlewareMode: true }, appType: "spa" });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => res.sendFile(path.join(distPath, 'index.html')));
  }

  server.listen(PORT, "0.0.0.0", () => console.log(`Server running on http://0.0.0.0:${PORT}`));
}

startServer();
