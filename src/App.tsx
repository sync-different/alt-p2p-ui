import { useState } from "react";
import SendView from "./components/SendView";
import ReceiveView from "./components/ReceiveView";

type Tab = "send" | "receive";

export default function App() {
  const [tab, setTab] = useState<Tab>("send");

  return (
    <div className="min-h-screen bg-slate-900">
      <header className="border-b border-slate-800 px-6 py-4">
        <h1 className="text-lg font-bold text-slate-100">alt-p2p</h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Encrypted peer-to-peer file transfer
        </p>
      </header>

      <div className="max-w-lg mx-auto px-6 py-6">
        <div className="flex rounded-lg bg-slate-800/50 p-1 mb-6">
          <button
            onClick={() => setTab("send")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === "send"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Send
          </button>
          <button
            onClick={() => setTab("receive")}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition-colors ${
              tab === "receive"
                ? "bg-slate-700 text-white shadow-sm"
                : "text-slate-400 hover:text-slate-300"
            }`}
          >
            Receive
          </button>
        </div>

        {tab === "send" ? <SendView /> : <ReceiveView />}
      </div>
    </div>
  );
}
