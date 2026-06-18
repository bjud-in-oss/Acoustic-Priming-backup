import React from 'react';
import { Save } from 'lucide-react';

interface InputTabProps {
  payloadText: string;
  setPayloadText: (text: string) => void;
  savePayload: () => void;
}

export function InputTab({ payloadText, setPayloadText, savePayload }: InputTabProps) {
  return (
    <div className="flex flex-col gap-4 overflow-hidden h-[400px] lg:h-full">
      <div className="flex justify-between items-center shrink-0">
         <p className="text-xs text-[#666]">Define the instructions the agent receives when it fetches the payload.</p>
         <button onClick={savePayload} className="bg-[#121212] text-white px-4 py-2 font-bold uppercase text-[10px] flex items-center gap-2 hover:bg-black transition-colors">
            <Save className="w-3 h-3" /> Save to Server
         </button>
      </div>
      <textarea 
         value={payloadText}
         onChange={(e) => setPayloadText(e.target.value)}
         className="w-full flex-1 bg-white border border-[#E5E5E5] p-4 font-mono text-sm leading-relaxed shadow-sm resize-none focus:outline-none focus:border-[#121212]"
         placeholder="Enter exact system instructions the model should execute..."
      />
    </div>
  );
}
