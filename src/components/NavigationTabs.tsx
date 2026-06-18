import React from 'react';
import { MessageSquare, Activity, Code, Folder, Settings } from 'lucide-react';

export type TabType = 'transcript' | 'logs' | 'output' | 'input' | 'workspace';

interface NavigationTabsProps {
  activeTab: TabType;
  setActiveTab: (tab: TabType) => void;
}

export function NavigationTabs({ activeTab, setActiveTab }: NavigationTabsProps) {
  return (
    <div className="flex gap-4 border-b border-[#E5E5E5] shrink-0 overflow-x-auto whitespace-nowrap">
       <button onClick={() => setActiveTab('transcript')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${activeTab === 'transcript' ? 'border-b-2 border-[#121212] text-[#121212]' : 'text-[#999] hover:text-[#666]'}`}>
         <MessageSquare className="w-3 h-3" /> Transcript
       </button>
       <button onClick={() => setActiveTab('logs')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${activeTab === 'logs' ? 'border-b-2 border-[#121212] text-[#121212]' : 'text-[#999] hover:text-[#666]'}`}>
         <Activity className="w-3 h-3" /> System Logs
       </button>
       <button onClick={() => setActiveTab('output')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${activeTab === 'output' ? 'border-b-2 border-[#121212] text-[#121212]' : 'text-[#999] hover:text-[#666]'}`}>
         <Code className="w-3 h-3" /> Output
       </button>
       <button onClick={() => setActiveTab('workspace')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${activeTab === 'workspace' ? 'border-b-2 border-[#121212] text-[#121212]' : 'text-[#999] hover:text-[#666]'}`}>
         <Folder className="w-3 h-3" /> Workspace
       </button>
       <button onClick={() => setActiveTab('input')} className={`pb-2 text-[10px] uppercase font-bold tracking-widest flex items-center gap-2 ${activeTab === 'input' ? 'border-b-2 border-[#121212] text-[#121212]' : 'text-[#999] hover:text-[#666]'}`}>
         <Settings className="w-3 h-3" /> Input
       </button>
    </div>
  );
}
