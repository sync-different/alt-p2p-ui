import type { SessionConfig as SessionConfigType } from "../types/ipc";

interface Props {
  config: SessionConfigType;
  onChange: (config: SessionConfigType) => void;
  disabled?: boolean;
}

export default function SessionConfig({ config, onChange, disabled }: Props) {
  return (
    <div className="space-y-3">
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          Session ID
        </label>
        <input
          type="text"
          value={config.sessionId}
          onChange={(e) => onChange({ ...config, sessionId: e.target.value })}
          disabled={disabled}
          placeholder="e.g. my-transfer-123"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          Pre-Shared Key
        </label>
        <input
          type="password"
          value={config.psk}
          onChange={(e) => onChange({ ...config, psk: e.target.value })}
          disabled={disabled}
          placeholder="Shared secret"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-400 mb-1">
          Server Address
        </label>
        <input
          type="text"
          value={config.serverAddress}
          onChange={(e) =>
            onChange({ ...config, serverAddress: e.target.value })
          }
          disabled={disabled}
          placeholder="host:port"
          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:opacity-50"
        />
      </div>
    </div>
  );
}
