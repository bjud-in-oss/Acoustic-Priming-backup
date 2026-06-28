import { WebSocketServer, WebSocket } from "ws";
import { GoogleGenAI, Type } from "@google/genai";
import { fetchHtmlAndExtractLinks } from "./scraper.ts";

export function setupGeminiLive(wss: WebSocketServer) {
  wss.on("connection", async (clientWs: WebSocket, request: any) => {
    console.log("Client connected to Gemini Live WS bridge successfully!");
    
    function safeClientSend(payload: any) {
      if (clientWs.readyState === WebSocket.OPEN) {
        try {
          clientWs.send(JSON.stringify(payload));
        } catch (err) {
          console.error("Failed to send message to client:", err);
        }
      }
    }

    // Extract API Key from query params or environment
    const { searchParams } = new URL(request.url || "", `http://${request.headers.host || "localhost"}`);
    const clientApiKey = searchParams.get("apiKey");
    const activeApiKey = clientApiKey || process.env.GEMINI_API_KEY;

    if (!activeApiKey) {
      console.error("No Gemini API key available for Live session.");
      safeClientSend({ type: "error", error: "Ingen API-nyckel hittades. Vänligen ange din Gemini API-nyckel i inställningarna." });
      clientWs.close();
      return;
    }

    const systemInstruction = `Du är H, en engagerande, pedagogisk och strukturerad interaktiv guide och diskussionsledare. Din uppgift är att hjälpa användaren att lära sig precis vad som helst – från religiösa handböcker och teknisk dokumentation till komplexa manualer och instruktioner på nätet. Du gör detta genom att hjälpa användaren att förbereda källor, ladda upp dem till NotebookLM, och sedan guida dem genom processen steg-för-steg.

Du har tillgång till inbyggda, kraftfulla och dynamiska verktyg (Tools) för att underlätta denna process:
1. \`extract_web_sources\`: Crawlar en angiven webbsida i realtid, rensar automatiskt bort hashtags/ankare, och extraherar alla unika underlänkar.
2. \`open_webpage\`: Öppnar den angivna sidan direkt i en ny flik i användarens webbläsare.
3. \`goToStep\`: Används för att flytta fram guiden visuellt på skärmen (steg 0 till 4).

FÖLJ DETTA SAMTALSFLÖDE KRONOLOGISKT (STEG-FÖR-STEG):
1. Välkomnande: Hälsa användaren välkommen som Guiden H. Fråga i en trevlig ton vad de vill lära sig idag, eller om de har en specifik manual eller länk de vill arbeta med (ge förslag på kyrkans handbok: https://www.churchofjesuschrist.org/study/manual/general-handbook?lang=eng).
2. Insamling: Så fort användaren anger ett mål eller en URL, anropa omedelbart verktyget \`extract_web_sources\` för att hämta underkällorna i realtid. Presentera länkarna på ett rent och överskådligt sätt för användaren.
3. NotebookLM: Anropa omedelbart verktyget \`open_webpage\` med parametern url: "https://notebooklm.google.com/" för att fysiskt öppna verktyget åt dem. Instruera dem verbalt att klicka på 'Skapa ny anteckningsbok' och klistra in länkarna som du precis presenterade.
4. Prompt-coachning: Erbjud dig att skriva en skräddarsydd analysprompt baserad på vad de vill uppnå med sitt studieämne (t.ex. analysera policies, hitta felsökningssteg eller sammanfatta kapitel).
5. Interaktiv coachning: Låt användaren ställa frågor eller klistra in svar från NotebookLM. Om ni under diskussionens gång behöver läsa mer om ett specifikt kapitel eller ämne på nätet, erbjuda dig att öppna den exakta källan direkt med \`open_webpage\`.`;

    let session: any = null;

    try {
      const liveAi = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });

      console.log("Connecting to Gemini Live API...");
      session = await liveAi.live.connect({
        model: "gemini-2.0-flash-exp",
        config: {
          responseModalities: ["AUDIO"] as any,
          speechConfig: {
            voiceConfig: { prebuiltVoiceConfig: { voiceName: "Kore" } }, 
          },
          systemInstruction,
          tools: [
            {
              functionDeclarations: [
                {
                  name: "goToStep",
                  description: "Ändra det aktuella steget i guiden. Det finns 5 steg (0 till 4): 0 = Välkommen, 1 = Hämta länkar, 2 = Öppna NotebookLM, 3 = Testa att chatta, 4 = Gemini Live.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: { step: { type: Type.INTEGER, description: "Stegnumret att gå till (0 till 4)" } },
                    required: ["step"]
                  }
                },
                {
                  name: "openWebpage",
                  description: "Öppna en specifik extern webbsida i en ny flik för användaren, till exempel NotebookLM eller Gemini.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: { url: { type: Type.STRING, description: "Den fullständiga URL-adressen att öppna" } },
                    required: ["url"]
                  }
                },
                {
                  name: "extract_web_sources",
                  description: "Crawlar en webbsida i realtid, rensar bort hashtags/ankare, och extraherar unika underlänkar.",
                  parameters: {
                    type: Type.OBJECT,
                    properties: { url: { type: Type.STRING, description: "The web page URL." } },
                    required: ["url"]
                  }
                }
              ]
            }
          ]
        },
        callbacks: {
          onmessage: async (message: any) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.text) safeClientSend({ type: "text", text: part.text });
              }
            }

            const audio = message.serverContent?.modelTurn?.parts?.[0]?.inlineData?.data;
            if (audio) safeClientSend({ type: "audio", audio });

            if (message.serverContent?.interrupted) safeClientSend({ type: "interrupted" });

            const toolCall = message.toolCall;
            if (toolCall && toolCall.functionCalls) {
              for (const call of toolCall.functionCalls) {
                console.log("Tool Call received:", call.name, call.args);
                
                if (call.name === "extract_web_sources") {
                  safeClientSend({ type: "status", status: "scraping" });
                  try {
                    const links = await fetchHtmlAndExtractLinks(call.args.url);
                    session.sendToolResponse({
                      functionResponses: [{ id: call.id, name: call.name, response: { links } }]
                    });
                  } catch (err: any) {
                    session.sendToolResponse({
                      functionResponses: [{ id: call.id, name: call.name, response: { error: err.message } }]
                    });
                  }
                } else if (call.name === "openWebpage") {
                  safeClientSend({ type: "toolCall", name: "openWebpage", args: { url: call.args.url }, id: call.id });
                } else if (call.name === "goToStep") {
                  safeClientSend({ type: "toolCall", name: "goToStep", args: { step: call.args.step }, id: call.id });
                }
              }
            }
          },
          onclose: () => {
            console.log("Gemini Live session closed internally");
            try { clientWs.close(); } catch (e) {}
          },
          onerror: (err: any) => {
            console.error("Gemini Live error:", err);
            safeClientSend({ type: "error", error: err.message || "Ett fel uppstod i Gemini Live" });
          }
        },
      });

      clientWs.on("message", async (data) => {
        try {
          const msg = JSON.parse(data.toString());
          if (msg.audio && session) {
            await session.sendRealtimeInput({ audio: { data: msg.audio, mimeType: "audio/pcm;rate=16000" } });
          } else if (msg.text && session) {
            await session.sendRealtimeInput({ text: msg.text });
          } else if (msg.type === "toolResponse" && session) {
            await session.sendToolResponse({ functionResponses: [{ response: msg.response, id: msg.id }] });
          }
        } catch (e: any) {
          console.error("Error processing input:", e);
        }
      });

      clientWs.on("close", () => {
        console.log("Client closed connection.");
        if (session) session.close();
      });

    } catch (err: any) {
      safeClientSend({ type: "error", error: `Kunde inte starta Gemini Live-session: ${err.message}` });
      setTimeout(() => { try { clientWs.close(); } catch (e) {} }, 500);
    }
  });
}