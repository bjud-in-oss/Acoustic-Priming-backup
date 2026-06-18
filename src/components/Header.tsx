import React from 'react';
import { Play, Square, Loader2 } from 'lucide-react';

interface HeaderProps {
  modelStatus: string;
  pushing: boolean;
  connected: boolean;
  connecting: boolean;
  connect: () => void;
  disconnect: () => void;
}

export function Header({ modelStatus, pushing, connected, connecting, connect, disconnect }: HeaderProps) {
  return (
    <header className="flex flex-col lg:flex-row justify-between items-start lg:items-end border-b border-[#121212] pb-6 mb-4 lg:mb-8 shrink-0 gap-6 lg:gap-0">
      <div className="max-w-xl">
         <p className="text-[10px] uppercase tracking-[0.2em] font-bold text-[#666] mb-2">Project: Ouroboros / Gemini-3.1-Flash-Live</p>
         <h1 className="text-4xl lg:text-7xl font-serif font-light leading-none tracking-tight">Acoustic Priming</h1>
      </div>
      
      <div className="flex flex-col lg:flex-row items-start lg:items-end gap-6 flex-1 lg:justify-end">
         <div className="flex items-center gap-1 shrink-0">
           {Array.from({ length: 8 }).map((_, i) => {
              let hClass = "h-4";
              let colorClass = "bg-[#121212] opacity-20";
              
              if (modelStatus === "speaking" || pushing) {
                 const heights = ["h-8", "h-12", "h-16", "h-20", "h-14", "h-10", "h-6", "h-8"];
                 hClass = heights[i];
                 colorClass = pushing ? "bg-[#FF4500]" : "bg-[#0047AB]";
              } else if (modelStatus === "processing" || modelStatus === "fetching_payload" || modelStatus === "executing_code") {
                 const heights = ["h-6", "h-8", "h-10", "h-12", "h-10", "h-8", "h-6", "h-6"];
                 hClass = heights[i];
                 colorClass = "bg-[#0047AB] opacity-50"; 
              }
              
              const animation = (modelStatus === "speaking" || pushing || modelStatus !== "idle") ? `pulse ${0.5 + (i * 0.1)}s infinite alternate` : 'none';

              return <div key={i} className={`w-1 transition-all duration-300 ${hClass} ${colorClass}`} style={{ animation }} />
           })}
           
           <div className="ml-4 flex flex-col gap-0.5 text-[9px] uppercase tracking-widest font-bold">
              <span className="text-[#999]">Microphone Array</span>
              {pushing && <span className="text-[#FF4500]">Recording...</span>}
              {!pushing && modelStatus === "processing" && <span className="text-[#0047AB]">Processing...</span>}
              {!pushing && modelStatus === "fetching_payload" && <span className="text-[#0047AB]">VAD: Injection</span>}
              {!pushing && modelStatus === "executing_code" && <span className="text-[#0047AB]">VAD: Execute</span>}
              {!pushing && modelStatus === "speaking" && <span className="text-[#0047AB]">Speaking...</span>}
              {!pushing && modelStatus === "idle" && <span className="text-[#666]">Idle</span>}
           </div>
         </div>

         <div className="text-right flex flex-col items-start lg:items-end gap-2">
           <div className={`flex items-center gap-2 text-xs font-mono uppercase ${connected ? 'text-[#0047AB]' : 'text-[#FF4500]'}`}>
             <div className={`w-2 h-2 rounded-full ${connected ? 'bg-[#0047AB]' : 'bg-[#FF4500]'}`} />
             {connected ? 'LIVE API ONLINE' : 'OFFLINE'}
           </div>
           {!connected ? (
             <button onClick={connect} disabled={connecting} className="border border-[#121212] text-[#121212] px-4 py-1.5 font-bold uppercase text-[10px] flex items-center gap-2 hover:bg-[#121212] hover:text-white transition-colors disabled:opacity-50">
               {connecting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Play className="w-3 h-3" />}
               Connect
             </button>
           ) : (
             <button onClick={disconnect} className="bg-[#121212] text-white px-4 py-1.5 font-bold uppercase text-[10px] flex items-center gap-2 hover:bg-black transition-colors">
               <Square className="w-3 h-3" />
               Disconnect
             </button>
           )}
         </div>
      </div>
    </header>
  );
}
