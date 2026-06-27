import React, { useEffect, useState, useCallback } from 'react';
import { useWorkspace } from './hooks/useWorkspace';
import { useAgent } from './hooks/useAgent';
import { Header } from './components/Header';
import { NavigationTabs, TabType } from './components/NavigationTabs';
import { TranscriptTab } from './components/tabs/TranscriptTab';
import { LogsTab } from './components/tabs/LogsTab';
import { InputTab } from './components/tabs/InputTab';
import { WorkspaceTab } from './components/tabs/WorkspaceTab';
import { TelemetrySidebar } from './components/TelemetrySidebar';
import { Footer } from './components/Footer';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('transcript');

  const {
    workspaceItems,
    workspaceError,
    fetchingFile,
    currentDir,
    loadWorkspace,
    downloadFile,
    navigateUp
  } = useWorkspace();

  // Unified tool call handler for frontend actions
  const handleToolCall = useCallback((message: any) => {
    if (message.name === 'open_webpage' && message.url) {
        window.open(message.url, '_blank');
    }
    // We can also switch tab to log if execution output is gone
    // setActiveTab('logs');
  }, []);

  const {
    connected,
    connecting,
    pushing,
    logs,
    latencies,
    transcripts,
    modelStatus,
    payloadText,
    setPayloadText,
    savePayload,
    connect,
    disconnect,
    handlePushStart,
    handlePushEnd
  } = useAgent(handleToolCall); // Pass tool handler

  useEffect(() => {
     if (activeTab === 'workspace') {
        loadWorkspace(currentDir);
     }
  }, [activeTab]);

  return (
    <div className="flex flex-col h-[100dvh] w-full bg-[#FAF9F6] text-[#121212] p-4 lg:p-8 font-sans overflow-hidden border-[8px] lg:border-[12px] border-white">
        <Header 
          modelStatus={modelStatus}
          pushing={pushing}
          connected={connected}
          connecting={connecting}
          connect={connect}
          disconnect={disconnect}
        />

        <main className="flex-1 flex flex-col lg:flex-row gap-6 lg:gap-12 min-h-0 overflow-y-auto lg:overflow-hidden">
          <div className="lg:flex-1 flex flex-col gap-6 lg:overflow-hidden flex-shrink-0 lg:flex-shrink">
            <NavigationTabs activeTab={activeTab} setActiveTab={setActiveTab} />

            {activeTab === 'transcript' && <TranscriptTab transcripts={transcripts} />}
            {activeTab === 'logs' && <LogsTab logs={logs} />}
            {activeTab === 'input' && <InputTab payloadText={payloadText} setPayloadText={setPayloadText} savePayload={savePayload} />}
            {activeTab === 'workspace' && (
              <WorkspaceTab 
                currentDir={currentDir}
                fetchingFile={fetchingFile}
                workspaceError={workspaceError}
                workspaceItems={workspaceItems}
                navigateUp={navigateUp}
                loadWorkspace={loadWorkspace}
                downloadFile={downloadFile}
              />
            )}
          </div>

          <TelemetrySidebar 
            latencies={latencies}
            connected={connected}
            pushing={pushing}
            modelStatus={modelStatus}
            handlePushStart={handlePushStart}
            handlePushEnd={handlePushEnd}
          />
        </main>

        <Footer />
    </div>
  );
}
