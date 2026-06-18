export const MasterDevelopmentPlan = `
# Master System Documentation

## Architecture & Goals
- Real-time voice interaction using Gemini Live API.
- Execute code and visualize the output properly.
- Persist terminal logs/conversation context for seamless agent continuity.

## Feature: Distinct Execution Output
Instead of treating code execution as just a hidden tool run, the server will broadcast \`execution_output\` (stdout/stderr) over WebSockets. The client will render this in a dedicated, professionally scoped terminal window or tab, giving immediate feedback on what the agent did.

## Feature: Terminal Context Injection
To provide historical context to the agent, the server will capture and store terminal logs + conversation history either locally or in-memory, and inject it as part of the initial system prompt upon websocket reconnection, giving the agent amnesic-immunity.

## Feature: Professional Workspace Explorer
To elevate the Workspace tab from a simple fetch-input into a professional utility:
1.  **File System API:** Backend endpoints (\`/api/workspace/list\` and \`/api/workspace/download\`) will be created to read the directory structure and serve raw files as attachments. Added directory traversal via query params.
2.  **Visual Explorer:** The UI will present an interactive file tree or list. 
3.  **One-Click Download:** Files can be downloaded to the user's local machine via standard browser mechanics.

## Feature: UI Layout Modernization
1.  **Global Header:** Moved the microphone/status visualizer (pulsing bars) from the terminal tab into the global header. It now serves as a persistent, global system state indicator.
2.  **Semantic Naming:** "Payload" is renamed to "Input" throughout the application for broader clarity.
3.  **Tab Restructuring:** The chaotic generic "Terminal" tab is split into semantic responsibilities:
    *   **Transcript:** Historic conversation dialogue.
    *   **System Logs:** Telemetry and tool execution tracking.
    *   **Output:** The raw stdout/stderr from executing code.
    *   **Workspace:** The file directory browser.
    *   **Input:** The system instructions injector.

## Agile Cycles
We are currently in Cycle 2, moving into Cycle 3 (Sync & Impact Analysis) based on user feedback.
`;
