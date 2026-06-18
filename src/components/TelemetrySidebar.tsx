import React from 'react';
import { Mic } from 'lucide-react';
import { motion } from 'motion/react';
import type { LatencyLog } from '../../hooks/useAgent';

interface TelemetrySidebarProps {
  latencies: LatencyLog[];
  connected: boolean;
  pushing: boolean;
  modelStatus: string;
  handlePushStart: () => void;
  handlePushEnd: () => void;
}

export function TelemetrySidebar({
  latencies,
  connected,
  pushing,
  modelStatus,
  handlePushStart,
  handlePushEnd
}: TelemetrySidebarProps) {
  return (
    <aside className="lg:w-80 flex flex-col lg:border-l border-[#121212] lg:pl-12 shrink-0 lg:overflow-y-auto w-full">
       <div className="mb-8 lg:mb-12 mt-4 lg:mt-0">
         <h2 className="text-xs font-bold uppercase tracking-widest mb-6 border-b border-[#121212] pb-2">Telemetry Logs</h2>
         
         <div className="flex flex-col gap-6">
            {['T1', 'T2', 'T3'].map(measure => {
               const logsFound = latencies.filter(l => l.measure === measure);
               const msStr = logsFound.length > 0 ? `${logsFound[logsFound.length - 1].ms}` : '--';
               const label = measure === 'T1' ? 'ActivityEnd \u2192 ToolCall' : measure === 'T2' ? 'ToolResp \u2192 ExecuteCode' : 'Exec \u2192 AudioStart';
               const colorClass = measure === 'T2' ? 'text-[#0047AB]' : '';

               return (
                 <div key={measure} className="flex justify-between items-baseline">
                   <span className="text-[10px] uppercase tracking-tighter">{measure}: {label}</span>
                   <span className={`text-3xl lg:text-4xl font-serif italic ${colorClass}`}>
                      {msStr}<span className="text-sm italic ml-1 text-[#121212]">ms</span>
                   </span>
                 </div>
               );
            })}
         </div>
       </div>

       <div className="mt-auto pt-4 lg:pt-8 w-full">
          <motion.button
            onMouseDown={handlePushStart}
            onMouseUp={handlePushEnd}
            onMouseLeave={handlePushEnd}
            onTouchStart={handlePushStart}
            onTouchEnd={handlePushEnd}
            disabled={!connected}
            className={`w-full p-6 lg:p-8 flex flex-col items-center justify-center text-center transition-colors ${connected ? (pushing ? 'bg-[#FF4500] text-white' : 'bg-[#121212] text-white hover:bg-[#333]') : 'bg-[#E5E5E5] text-[#999] cursor-not-allowed'}`}
          >
            <div className={`w-12 h-12 rounded-full border-2 mb-4 flex items-center justify-center ${pushing ? 'border-white/50' : connected ? 'border-white/20' : 'border-[#999]/20'}`}>
              <Mic className={`w-5 h-5 ${pushing ? 'animate-pulse' : ''}`} />
            </div>
            <p className="text-[10px] uppercase tracking-[0.2em] font-bold mb-1">Push to Talk</p>
            <p className="text-xs opacity-70 font-serif italic">{pushing ? "Recording..." : "Hold spacebar to stream"}</p>
          </motion.button>
          
          <div className="mt-6">
            <div className="flex justify-between text-[10px] font-bold uppercase mb-2">
              <span>Model Status</span>
              <span className={connected ? "text-[#0047AB]" : "text-[#666]"}>
                  {!connected ? "Disconnected" : pushing ? "Listening..." : modelStatus === "processing" ? "Processing" : modelStatus === "fetching_payload" ? "Tool: Fetching payload" : modelStatus === "executing_code" ? "Tool: Executing payload" : modelStatus === "speaking" ? "Speaking" : "Ready / Idle"}
              </span>
            </div>
            <div className="h-[1px] bg-[#121212] w-full mb-2"></div>
            <div className="flex justify-between text-[10px] font-bold uppercase">
              <span>VAD Mode</span>
              <span>Disabled (PTT)</span>
            </div>
          </div>
       </div>
    </aside>
  );
}
