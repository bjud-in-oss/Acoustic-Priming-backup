import React from 'react';

interface TranscriptTabProps {
  transcripts: {role: 'user' | 'agent', text: string}[];
}

export function TranscriptTab({ transcripts }: TranscriptTabProps) {
  return (
    <div className="flex flex-col gap-6 overflow-hidden h-[500px] lg:h-full">
      <div className="flex justify-between items-center shrink-0">
         <p className="text-xs text-[#666]">Historic conversation dialogue.</p>
      </div>
      <div className="text-xl lg:text-2xl flex-1 italic font-serif leading-relaxed overflow-y-auto pr-4 flex flex-col gap-3">
         {transcripts.length === 0 && <span className="text-[#666]">Awaiting conversation...</span>}
         {transcripts.map((t, i) => (
            <div key={i} className={`flex flex-col ${t.role === 'user' ? 'text-[#121212]' : 'text-[#0047AB]'}`}>
               <span className="text-[9px] uppercase font-bold font-sans not-italic tracking-widest opacity-50 mb-1">{t.role}</span>
               <span>{t.text ? `"${t.text}"` : ""}</span>
            </div>
         ))}
      </div>
    </div>
  );
}
