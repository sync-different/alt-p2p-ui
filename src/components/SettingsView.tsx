import type { AdvancedSettings } from "../types/ipc";

interface Props {
  settings: AdvancedSettings;
  onChange: (settings: AdvancedSettings) => void;
}

const fields: { key: keyof Omit<AdvancedSettings, "allowRelay" | "relayMode">; label: string; placeholder: string; description: string }[] = [
  { key: "punchTimeoutMs", label: "Hole Punch Timeout", placeholder: "10000", description: "How long to try hole punching (ms)" },
  { key: "punchIntervalMs", label: "Hole Punch Interval", placeholder: "100", description: "Interval between PUNCH packets (ms)" },
  { key: "dtlsRetries", label: "DTLS Handshake Retries", placeholder: "3", description: "Max DTLS handshake attempts" },
  { key: "dtlsTimeoutMs", label: "DTLS Handshake Timeout", placeholder: "30000", description: "Per-attempt handshake deadline (ms)" },
  { key: "initialCwnd", label: "Initial CWND", placeholder: "32", description: "Congestion window start (packets)" },
  { key: "keepaliveIntervalMs", label: "Keepalive Interval", placeholder: "15000", description: "Keep NAT mapping alive (ms)" },
];

export default function SettingsView({ settings, onChange }: Props) {
  return (
    <div className="space-y-5">
      <p className="text-sm text-slate-400">
        Override default transfer parameters. Leave blank to use defaults.
      </p>

      <div className="space-y-4">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            checked={settings.allowRelay}
            onChange={(e) => onChange({ ...settings, allowRelay: e.target.checked })}
            className="mt-0.5 rounded border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
          />
          <div>
            <span className="text-sm font-medium text-slate-400">Allow relay fallback</span>
            <p className="mt-0.5 text-xs text-slate-500">
              If hole punching fails, relay traffic through the coordination server. Slower but works behind strict NATs.
            </p>
          </div>
        </label>

        {settings.allowRelay && (
          <div className="ml-7">
            <label className="block text-sm font-medium text-slate-400 mb-2">
              Relay mode
            </label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="relayMode"
                  value="tcp"
                  checked={settings.relayMode === "tcp"}
                  onChange={() => onChange({ ...settings, relayMode: "tcp" })}
                  className="border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-300">TCP (faster)</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer select-none">
                <input
                  type="radio"
                  name="relayMode"
                  value="udp"
                  checked={settings.relayMode === "udp"}
                  onChange={() => onChange({ ...settings, relayMode: "udp" })}
                  className="border-slate-600 bg-slate-800 text-blue-500 focus:ring-blue-500/30 focus:ring-offset-0"
                />
                <span className="text-sm text-slate-300">UDP (legacy)</span>
              </label>
            </div>
            <p className="mt-1 text-xs text-slate-500">
              TCP relay streams data over TLS for higher throughput. UDP relay uses DTLS with per-packet overhead.
            </p>
          </div>
        )}

        {fields.map(({ key, label, placeholder, description }) => (
          <div key={key}>
            <label className="block text-sm font-medium text-slate-400 mb-1">
              {label}
            </label>
            <input
              type="text"
              inputMode="numeric"
              value={settings[key] as string}
              onChange={(e) => onChange({ ...settings, [key]: e.target.value.replace(/[^0-9]/g, "") })}
              placeholder={placeholder}
              autoCapitalize="off"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-200 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-slate-500">{description}</p>
          </div>
        ))}
      </div>

      <button
        onClick={() =>
          onChange({
            punchTimeoutMs: "",
            punchIntervalMs: "",
            dtlsRetries: "",
            dtlsTimeoutMs: "",
            initialCwnd: "",
            keepaliveIntervalMs: "",
            allowRelay: false,
            relayMode: "tcp",
          })
        }
        className="rounded-lg bg-slate-700 hover:bg-slate-600 px-4 py-2 text-sm font-medium text-slate-200 transition-colors"
      >
        Reset to Defaults
      </button>
    </div>
  );
}
