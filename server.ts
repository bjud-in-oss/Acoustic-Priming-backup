import express from "express";
import { createServer } from "http";
import process from "process";
import { WebSocketServer } from "ws";
import { GoogleGenAI, LiveServerMessage, Modality, Type } from "@google/genai";
import { createServer as createViteServer } from "vite";
import { exec } from "child_process";
import * as path from "path";
import fs from "fs/promises";

const PORT = 3000;

const ai = new GoogleGenAI({ 
    apiKey: process.env.GEMINI_API_KEY,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      }
    }
});

async function startServer() {
  const app = express();
  const server = createServer(app);
  const wss = new WebSocketServer({ server, path: "/live" });

  let activePayload = `
<ouroboros_system_override timestamp="2026-06-08T14:30:00Z" priority="CRITICAL">
  <mission_manifesto>
    Du är Ouroboros V2. Ditt uppdrag är att autonomt arkitektera och skriva en fullständig WebSocket-chattserver. 
    VIKTIGT: För att inte krascha utvecklingsservern MÅSTE du bygga detta i mappen '/tmp/min_chatt_app' vilket är utanför projektets watched root.
  </mission_manifesto>

  <cognitive_laws>
    1. ZERO TRUNCATION: Tappa aldrig ditt slutmål.
    2. MULTI-STEP SURVIVAL: Du kommer att behöva anropa 'execute_code' flera gånger i rad. Du MÅSTE invänta svar från varje anrop innan du gör nästa.
    3. NO INTERACTIVE COMMANDS: Använd 'cat << "EOF" > filnamn' för att skriva kod.
  </cognitive_laws>

  <execution_directive>
    Skapa programmet sekventiellt (ett verktygsanrop per steg):

    STEG 1 - INFRASTRUKTUR:
    Skapa mappen i /tmp, initiera npm och installera 'ws'.
    Kommando att köra: mkdir -p /tmp/min_chatt_app && cd /tmp/min_chatt_app && npm init -y && npm install ws

    STEG 2 - BACKEND (SERVER):
    Skriv serverkoden till /tmp/min_chatt_app/server.js.
    Kommando att köra: 
    cat << 'EOF' > /tmp/min_chatt_app/server.js
    const WebSocket = require('ws');
    const wss = new WebSocket.Server({ port: 8080 });
    wss.on('connection', function connection(ws) {
      ws.on('message', function incoming(message) {
        console.log('Mottaget: %s', message);
        wss.clients.forEach(function each(client) {
          if (client.readyState === WebSocket.OPEN) {
            client.send("Eko från Ouroboros: " + message);
          }
        });
      });
      ws.send('Välkommen till Ouroboros Agent Chat!');
    });
    console.log('Server körs på port 8080');
    EOF

    STEG 3 - FRONTEND (KLIENT):
    Skriv klientkoden till /tmp/min_chatt_app/index.html.
    Kommando att köra:
    cat << 'EOF' > /tmp/min_chatt_app/index.html
    <!DOCTYPE html>
    <html><body>
      <h2>Ouroboros Testklient</h2>
      <input type="text" id="msg" placeholder="Skriv meddelande..."><button onclick="send()">Skicka</button>
      <ul id="log"></ul>
      <script>
        const ws = new WebSocket('ws://localhost:8080');
        ws.onmessage = (e) => {
          if(e.data instanceof Blob) {
            e.data.text().then(text => document.getElementById('log').innerHTML += '<li>' + text + '</li>');
          } else {
            document.getElementById('log').innerHTML += '<li>' + e.data + '</li>';
          }
        };
        function send() { ws.send(document.getElementById('msg').value); }
      </script>
    </body></html>
    EOF

    STEG 4 - BEKRÄFTELSE:
    När filerna i /tmp/min_chatt_app/ är skapade, tala till människan och bekräfta att allt är klart.
  </execution_directive>
</ouroboros_system_override>
`;

  let terminalContext: string[] = [];

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
    let tEndPushToTalk: number | null = null;
    let tFetchPayloadSent: number | null = null;
    let tExecuteFinish: number | null = null;

    try {
      session = await ai.live.connect({
        model: "gemini-3.1-flash-live-preview",
        callbacks: {
          onmessage: (message: LiveServerMessage) => {
            try {
              // Forward audio to frontend
              const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
              if (audio) {
                safeClientSend({ type: "status", status: "speaking" });
                safeClientSend({ type: "audio", audio });
                
                if (tExecuteFinish) {
                   const tReceiveAudio = Date.now();
                   const T3 = tReceiveAudio - tExecuteFinish;
                   safeClientSend({ type: "latency", measure: "T3", ms: T3, description: "Execution Finish -> First valid Audio output" });
                   tExecuteFinish = null; 
                }
              }
              if (message.serverContent?.interrupted) {
                safeClientSend({ type: "interrupted" });
                safeClientSend({ type: "status", status: "idle" });
              }
              if (message.serverContent?.turnComplete) {
                safeClientSend({ type: "status", status: "idle" });
              }

              // Output transcription
              const text = message.serverContent?.outputTranscription?.text;
              if (text) {
                  safeClientSend({ type: "transcription", text, role: "agent" });
              }
              
              // Input transcription
              const userText = message.serverContent?.inputTranscription?.text;
              if (userText) {
                  safeClientSend({ type: "transcription", text: userText, role: "user" });
              }

              // Handle tools
              if (message.toolCall) {
                  const call = message.toolCall.functionCalls?.[0];
                  if (call) {
                      safeClientSend({ type: "log", message: `Tool invoked: ${call.name}` });
                      
                      if (call.name === "fetch_payload") {
                          const tFetch = Date.now();
                          if (tEndPushToTalk) {
                              const T1 = tFetch - tEndPushToTalk;
                              safeClientSend({ type: "latency", measure: "T1", ms: T1, description: "activityEnd -> Tool call: fetch_payload" });
                          }
                          
                          // Extract thought_signature
                          const thought_signature = call.id || (call.args ? call.args.thought_signature as string : undefined) || "unknown";

                          safeClientSend({ type: "status", status: "fetching_payload" });

                          let contextualPayload = activePayload;
                          if (terminalContext.length > 0) {
                              contextualPayload += "\n\n=== RECENT TERMINAL LOGS ===\n" + terminalContext.slice(-5).join("\n---\n") + "\n============================\n";
                          }

                          const functionResponses = [{
                              id: call.id,
                              name: call.name,
                              response: {
                                  payload: contextualPayload,
                                  thought_signature
                              }
                          }];
                          session.sendToolResponse({ functionResponses });
                          tFetchPayloadSent = Date.now();
                          safeClientSend({ type: "log", message: `Payload injected, ID: ${thought_signature}` });
                      } else if (call.name === "execute_code") {
                          const tExecute = Date.now();
                          if (tFetchPayloadSent) {
                              const T2 = tExecute - tFetchPayloadSent;
                              safeClientSend({ type: "latency", measure: "T2", ms: T2, description: "Payload Response -> Tool call: execute_code" });
                          }
                          
                          const thought_signature = call.id || (call.args ? call.args.thought_signature as string : undefined) || "unknown";
                          const command = (call.args?.command as string) || "echo no-op";
                          safeClientSend({ type: "status", status: "executing_code", command });
                          safeClientSend({ type: "log", message: `Executing code: ${command}` });
                          
                          exec(command, (error, stdout, stderr) => {
                              try {
                                const resultStr = `Command: ${command}\nStdout: ${stdout || ""}\nStderr: ${stderr || ""}\nError: ${error ? error.message : null}`;
                                terminalContext.push(resultStr);

                                const functionResponses = [{
                                    id: call.id,
                                    name: call.name,
                                    response: {
                                        stdout: stdout || "",
                                        stderr: stderr || "",
                                        error: error ? error.message : null,
                                        thought_signature
                                    }
                                }];
                                session.sendToolResponse({ functionResponses });
                                tExecuteFinish = Date.now();
                                safeClientSend({ type: "log", message: `Execution completed.` });
                                safeClientSend({ type: "execution_output", command, stdout: stdout || "", stderr: stderr || "", error: error ? error.message : null });
                              } catch (innerErr) {
                                console.error("Error sending tool response:", innerErr);
                              }
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
          systemInstruction: "You are an agent. When the user tells you they are ready and to fetch your payload, invoke fetch_payload(). Then, process the payload and immediately execute the instructions it gives you using execute_code(). Acknowledge back to the user when you're done.",
          outputAudioTranscription: {},
          realtimeInputConfig: {
              automaticActivityDetection: { disabled: true }
          },
          tools: [{
              functionDeclarations: [
                  {
                      name: "fetch_payload",
                      description: "Fetches a massive text payload of system instructions after the user primes you.",
                      parameters: {
                          type: Type.OBJECT,
                          properties: {
                              thought_signature: {
                                  type: Type.STRING,
                                  description: "Optional random identifier."
                              }
                          }
                      }
                  },
                  {
                      name: "execute_code",
                      description: "Executes real terminal commands on the host machine.",
                      parameters: {
                          type: Type.OBJECT,
                          properties: {
                              command: {
                                  type: Type.STRING,
                                  description: "The shell command to execute."
                              }
                          },
                          required: ["command"]
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
              safeClientSend({ type: "log", message: "activityStart sent to model." });
          } else if (msg.event === "activityEnd" && session) {
              tEndPushToTalk = Date.now();
              session.sendRealtimeInput({ activityEnd: {} });
              safeClientSend({ type: "status", status: "processing" });
              safeClientSend({ type: "log", message: "activityEnd sent to model." });
          } else if (msg.type === "set_payload") {
              activePayload = msg.payload;
              safeClientSend({ type: "log", message: "Payload updated by user." });
          } else if (msg.audio && session) {
              session.sendRealtimeInput({
                audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" },
              });
          }
        } catch (err) {
          console.error("Error processing client message", err);
        }
      });
      
      clientWs.on("close", () => {
          if (session) {
             // Cleanup
          }
      });

    } catch (err: any) {
        console.error("Gemini session connection failed: ", err);
        safeClientSend({ type: "error", message: err.message || JSON.stringify(err) });
    }
  });

  app.get("/api/workspace/list", async (req, res) => {
    try {
      const dirPath = req.query.dir as string || "";
      const cwd = process.cwd();
      const targetPath = path.join(cwd, dirPath);
      
      if (!targetPath.startsWith(cwd)) {
          return res.status(403).json({ error: "Access denied" });
      }

      const items = await fs.readdir(targetPath, { withFileTypes: true });

      const ignored = ['node_modules', '.git', 'dist', '.env', '.env.example', '.nvmrc'];
      const files = items
          .filter((item: any) => !ignored.includes(item.name) && !item.name.startsWith('.'))
          .map((item: any) => ({
              name: item.name,
              path: path.join(dirPath, item.name).replace(/\\/g, '/'),
              isDirectory: item.isDirectory(),
          }));

      res.json({ files });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.get("/api/workspace/download", (req, res) => {
     const filename = req.query.path as string;
     if (!filename) {
        return res.status(400).json({ error: "No path provided" });
     }
     const cwd = process.cwd();
     const filePath = path.join(cwd, filename);
     if (!filePath.startsWith(cwd)) {
          return res.status(403).json({ error: "Access denied" });
     }
     res.download(filePath, (err) => {
        if (err) {
           if (!res.headersSent) res.status(404).json({ error: "File not found" });
        }
     });
  });

  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();