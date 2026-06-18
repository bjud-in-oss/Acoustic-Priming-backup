import { useState, useRef, useCallback, useEffect } from 'react';

function pcmToBase64(float32Array: Float32Array): string {
    const buffer = new ArrayBuffer(float32Array.length * 2);
    const view = new DataView(buffer);
    for (let i = 0; i < float32Array.length; i++) {
        let s = Math.max(-1, Math.min(1, float32Array[i]));
        view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
    }
    let binary = "";
    const bytes = new Uint8Array(buffer);
    for (let i = 0; i < bytes.byteLength; i += 1000) {
       binary += String.fromCharCode(...bytes.subarray(i, i + 1000));
    }
    if (bytes.length % 1000 !== 0) {
       binary += String.fromCharCode(...bytes.subarray(Math.floor(bytes.length / 1000) * 1000));
    }
    return btoa(binary);
}

export interface LatencyLog {
  measure: string;
  ms: number;
  description: string;
}

export function useAgent(onExecutionOutput?: () => void) {
  const [connected, setConnected] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [pushing, setPushing] = useState(false);
  const pushingRef = useRef(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [latencies, setLatencies] = useState<LatencyLog[]>([]);
  const [transcripts, setTranscripts] = useState<{role: 'user' | 'agent', text: string}[]>([]);
  const [executionOutputs, setExecutionOutputs] = useState<{command: string, stdout: string, stderr: string, error: string | null}[]>([]);
  const [modelStatus, setModelStatus] = useState<"idle" | "processing" | "fetching_payload" | "executing_code" | "speaking">("idle");
  const [activeCommand, setActiveCommand] = useState("");
  const [payloadText, setPayloadText] = useState("Analyze the local directory and create a file named 'ouroboros_test.txt' containing 'ouroboros_test'. You MUST use the execute_code tool. Your execute_code command should be exactly: echo 'ouroboros_test' > ouroboros_test.txt");

  const wsRef = useRef<WebSocket | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const processorRef = useRef<ScriptProcessorNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const addLog = useCallback((msg: string) => {
    setLogs(prev => [...prev.slice(-49), `${new Date().toISOString().split('T')[1].slice(0,-1)}: ${msg}`]);
  }, []);

  const playAudioChunk = (base64: string) => {
    if (!audioCtxRef.current) return;
    const ctx = audioCtxRef.current;
    
    // Decode base64 quickly
    const binary = atob(base64);
    const buffer = new ArrayBuffer(binary.length);
    const view = new DataView(buffer);
    for (let i = 0; i < binary.length; i++) {
        view.setUint8(i, binary.charCodeAt(i));
    }
    
    const sampleRate = 24000;
    const numSamples = buffer.byteLength / 2;
    const audioBuffer = ctx.createBuffer(1, numSamples, sampleRate);
    const channelData = audioBuffer.getChannelData(0);
    
    for (let i = 0; i < numSamples; i++) {
        channelData[i] = view.getInt16(i * 2, true) / 0x8000;
    }
    
    const source = ctx.createBufferSource();
    source.buffer = audioBuffer;
    source.connect(ctx.destination);
    
    const currentTime = ctx.currentTime;
    if (nextStartTimeRef.current < currentTime) {
        nextStartTimeRef.current = currentTime + 0.1;
    }
    source.start(nextStartTimeRef.current);
    nextStartTimeRef.current += audioBuffer.duration;
  };

  const stopAudio = () => {
    if (processorRef.current) {
       processorRef.current.disconnect();
       processorRef.current = null;
    }
    if (streamRef.current) {
       streamRef.current.getTracks().forEach(t => t.stop());
       streamRef.current = null;
    }
    if (audioCtxRef.current) {
       audioCtxRef.current.close();
       audioCtxRef.current = null;
    }
  };

  const connect = async () => {
    setConnecting(true);
    addLog("Connecting to Live API backend...");
    try {
      const audioCtx = new AudioContext({ sampleRate: 16000 });
      audioCtxRef.current = audioCtx;
      nextStartTimeRef.current = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const ws = new WebSocket(`${wsProtocol}//${window.location.host}/live`);
      wsRef.current = ws;

      ws.onopen = () => {
        addLog("WebSocket connected.");
        setConnected(true);
        setConnecting(false);
      };

      ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        if (msg.type === "log") {
           addLog(msg.message);
        } else if (msg.type === "latency") {
           setLatencies(prev => [...prev, { measure: msg.measure, ms: msg.ms, description: msg.description }]);
        } else if (msg.type === "transcription") {
           setTranscripts(prev => {
              const last = prev[prev.length - 1];
              if (last && last.role === msg.role) {
                 const newTranscripts = [...prev];
                 newTranscripts[newTranscripts.length - 1] = { ...last, text: last.text + msg.text };
                 return newTranscripts;
              } else {
                 return [...prev, { role: msg.role, text: msg.text }];
              }
           });
        } else if (msg.type === "status") {
           setModelStatus(msg.status);
           if (msg.status === "executing_code" && msg.command) {
              setActiveCommand(msg.command);
           } else if (msg.status !== "executing_code") {
              setActiveCommand("");
           }
        } else if (msg.type === "execution_output") {
           setExecutionOutputs(prev => [...prev, { command: msg.command, stdout: msg.stdout, stderr: msg.stderr, error: msg.error }]);
           if (onExecutionOutput) onExecutionOutput();
        } else if (msg.type === "interrupted") {
           addLog("Agent interrupted.");
           nextStartTimeRef.current = audioCtxRef.current!.currentTime;
        } else if (msg.type === "error") {
           addLog(`Error: ${msg.message}`);
        } else if (msg.type === "audio") {
           playAudioChunk(msg.audio);
        }
      };

      ws.onclose = () => {
        addLog("WebSocket disconnected.");
        setConnected(false);
        setConnecting(false);
        stopAudio();
      };

      const source = audioCtx.createMediaStreamSource(stream);
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;
      
      processor.onaudioprocess = (e) => {
        if (!pushingRef.current) return;
        if (ws.readyState === WebSocket.OPEN) {
          const base64 = pcmToBase64(e.inputBuffer.getChannelData(0));
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };

      source.connect(processor);
      processor.connect(audioCtx.destination);
      
    } catch (e: any) {
      addLog(`Failed to connect: ${e.message}`);
      setConnecting(false);
    }
  };

  const disconnect = () => {
    if (wsRef.current) {
      wsRef.current.close();
    }
  };

  const handlePushStart = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setPushing(true);
    pushingRef.current = true;
    wsRef.current.send(JSON.stringify({ event: "activityStart" }));
    if (audioCtxRef.current && audioCtxRef.current.state === 'suspended') {
      audioCtxRef.current.resume();
    }
  }, []);

  const handlePushEnd = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) return;
    setPushing(false);
    pushingRef.current = false;
    wsRef.current.send(JSON.stringify({ event: "activityEnd" }));
  }, []);

  const savePayload = () => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
       wsRef.current.send(JSON.stringify({ type: "set_payload", payload: payloadText }));
       addLog("Payload updated on server.");
    } else {
       addLog("Cannot save payload: WebSocket disconnected.");
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !e.repeat) {
         if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
         e.preventDefault();
         handlePushStart();
      }
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') {
         if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
         e.preventDefault();
         handlePushEnd();
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handlePushStart, handlePushEnd]);

  useEffect(() => {
    return () => {
      disconnect();
      stopAudio();
    };
  }, []);

  return {
    connected,
    connecting,
    pushing,
    logs,
    latencies,
    transcripts,
    executionOutputs,
    modelStatus,
    activeCommand,
    payloadText,
    setPayloadText,
    savePayload,
    connect,
    disconnect,
    handlePushStart,
    handlePushEnd
  };
}
