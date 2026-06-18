import React from 'react';

interface LogsTabProps {
  logs: string[];
}

export function LogsTab({ logs }: LogsTabProps) {
  return (
    <div className="flex flex-col gap-6 overflow-hidden h-[500px] lg:h-full">
      <div className="flex justify-between items-center shrink-0">
         <p className="text-xs text-[#666]">Telemetry and tool execution tracking.</p>
      </div>
      <div className="bg-white border border-[#E5E5E5] p-4 lg:p-6 w-full font-mono text-[11px] lg:text-[13px] leading-relaxed shadow-sm overflow-y-auto h-full flex flex-col gap-1">
         {logs.length === 0 && <div className="text-[#666]">No events logged yet.</div>}
         {logs.map((L, i) => {
            const isTool = L.includes("Tool");
            const isPayload = L.includes("Payload");
            return (
              <div key={i} className={`flex items-start gap-2 ${isTool ? 'text-[#0047AB] font-bold mt-2' : isPayload ? 'text-[#FF4500] font-bold mt-2' : 'text-[#666]'}`}>
                 {isTool || isPayload ? <span className="w-2 h-2 rounded-full shrink-0 mt-1.5 opacity-80" style={{ backgroundColor: isTool ? '#0047AB' : '#FF4500'}}></span> : <span className="w-2 shrink-0">&gt;</span>}
                 <span>{L}</span>
              </div>
            )
         })}
      </div>
    </div>
  );
}
