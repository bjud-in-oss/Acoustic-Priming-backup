import React from 'react';

interface OutputTabProps {
  executionOutputs: {command: string, stdout: string, stderr: string, error: string | null}[];
}

export function OutputTab({ executionOutputs }: OutputTabProps) {
  return (
    <div className="flex flex-col gap-6 overflow-hidden h-[500px] lg:h-full">
      <div className="flex justify-between items-center shrink-0">
         <p className="text-xs text-[#666]">Results of recent terminal executions by the agent.</p>
      </div>
      <div className="flex-1 overflow-y-auto flex flex-col gap-8 pr-4">
         {executionOutputs.length === 0 ? (
            <div className="text-[#999] italic mt-4 text-sm">No code has been executed yet.</div>
         ) : (
            executionOutputs.map((out, i) => (
               <div key={i} className="flex flex-col gap-2">
                  <div className="font-mono text-xs bg-[#E5E5E5] px-3 py-1.5 inline-block w-fit font-bold rounded-sm">
                     $ {out.command}
                  </div>
                  {out.stdout && (
                     <pre className="bg-[#121212] text-white p-4 font-mono text-sm overflow-x-auto rounded-sm leading-relaxed whitespace-pre-wrap">
                        {out.stdout}
                     </pre>
                  )}
                  {(out.stderr || out.error) && (
                     <pre className="bg-[#FF4500]/10 text-[#FF4500] border border-[#FF4500]/20 p-4 font-mono text-sm overflow-x-auto rounded-sm leading-relaxed whitespace-pre-wrap">
                        {out.stderr || out.error}
                     </pre>
                  )}
               </div>
            ))
         )}
      </div>
    </div>
  );
}
