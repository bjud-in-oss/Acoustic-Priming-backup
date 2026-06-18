import { useState, useCallback } from 'react';

export function useWorkspace() {
  const [workspaceItems, setWorkspaceItems] = useState<{name: string, path: string, isDirectory: boolean}[]>([]);
  const [workspaceError, setWorkspaceError] = useState<string | null>(null);
  const [fetchingFile, setFetchingFile] = useState(false);
  const [currentDir, setCurrentDir] = useState<string>("");

  const loadWorkspace = async (dir: string = currentDir) => {
     setFetchingFile(true);
     setWorkspaceError(null);
     try {
       const res = await fetch(`/api/workspace/list?dir=${encodeURIComponent(dir)}`);
       const data = await res.json();
       if (res.ok) {
          setWorkspaceItems(data.files || []);
          setCurrentDir(dir);
       } else {
          setWorkspaceError(data.error);
       }
     } catch (err: any) {
       setWorkspaceError(err.message);
     } finally {
       setFetchingFile(false);
     }
  };

  const downloadFile = async (filepath: string) => {
     try {
       const res = await fetch(`/api/workspace/download?path=${encodeURIComponent(filepath)}`);
       if (!res.ok) throw new Error("Failed to download file");
       const blob = await res.blob();
       const url = window.URL.createObjectURL(blob);
       const a = document.createElement('a');
       a.href = url;
       const parts = filepath.split('/');
       a.download = parts[parts.length - 1];
       document.body.appendChild(a);
       a.click();
       a.remove();
       window.URL.revokeObjectURL(url);
     } catch (err) {
       console.error("Download error:", err);
       alert("Could not download file.");
     }
  };

  const navigateUp = () => {
      if (!currentDir) return;
      const parts = currentDir.split('/').filter(Boolean);
      parts.pop();
      loadWorkspace(parts.join('/'));
  };

  return {
    workspaceItems,
    workspaceError,
    fetchingFile,
    currentDir,
    loadWorkspace,
    downloadFile,
    navigateUp
  };
}
