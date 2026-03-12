import { useState, useEffect } from "react";
import { getVersion } from "@tauri-apps/api/app";
import type { AdvancedSettings, SessionConfig } from "./types/ipc";
import SendView from "./components/SendView";
import ReceiveView from "./components/ReceiveView";
import SettingsView from "./components/SettingsView";

type Tab = "send" | "receive" | "settings";

const defaultSettings: AdvancedSettings = {
  punchTimeoutMs: "",
  punchIntervalMs: "",
  dtlsRetries: "",
  dtlsTimeoutMs: "",
  initialCwnd: "",
  keepaliveIntervalMs: "",
  allowRelay: false,
  relayMode: "tcp",
};

const defaultConfig: SessionConfig = {
  sessionId: "",
  psk: "",
  serverAddress: "",
};

export default function App() {
  const [tab, setTab] = useState<Tab>("send");
  const [version, setVersion] = useState<string>("");
  const [transferActive, setTransferActive] = useState(false);
  const [settings, setSettings] = useState<AdvancedSettings>(defaultSettings);
  const [sendConfig, setSendConfig] = useState<SessionConfig>(defaultConfig);
  const [sendFilePath, setSendFilePath] = useState<string | null>(null);
  const [receiveConfig, setReceiveConfig] = useState<SessionConfig>(defaultConfig);
  const [receiveOutputDir, setReceiveOutputDir] = useState<string | null>(null);

  useEffect(() => {
    getVersion().then(setVersion);
  }, []);

  const tabs: { id: Tab; label: string }[] = [
    { id: "send", label: "Send" },
    { id: "receive", label: "Receive" },
    { id: "settings", label: "Settings" },
  ];

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-800 px-6 py-4 flex items-baseline justify-between">
        <div>
          <h1 className="text-lg font-bold text-slate-100">alt-p2p</h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Encrypted peer-to-peer file transfer
          </p>
        </div>
        {version && (
          <span className="text-xs text-slate-600">v{version} ({__BUILD_NUMBER__})</span>
        )}
      </header>

      <div className="max-w-lg mx-auto px-6 py-6">
        <div className="flex rounded-lg bg-slate-800/50 p-1 mb-6">
          {tabs.map(({ id, label }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              disabled={transferActive && tab !== id && id !== "settings"}
              className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-slate-700 text-white shadow-sm"
                  : "text-slate-400 hover:text-slate-300"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {label}
            </button>
          ))}
        </div>

        {tab === "send" && <SendView onActiveChange={setTransferActive} settings={settings} config={sendConfig} onConfigChange={setSendConfig} filePath={sendFilePath} onFilePathChange={setSendFilePath} />}
        {tab === "receive" && <ReceiveView onActiveChange={setTransferActive} settings={settings} config={receiveConfig} onConfigChange={setReceiveConfig} outputDir={receiveOutputDir} onOutputDirChange={setReceiveOutputDir} />}
        {tab === "settings" && <SettingsView settings={settings} onChange={setSettings} />}
      </div>
    </div>
  );
}
