import type { ConnectionState } from "../types/ipc";

interface Props {
  state: ConnectionState | null;
}

const steps: { key: ConnectionState; label: string }[] = [
  { key: "registering", label: "Registering" },
  { key: "waiting_peer", label: "Waiting for peer" },
  { key: "punching", label: "Hole punching" },
  { key: "handshaking", label: "DTLS handshake" },
  { key: "connected", label: "Connected" },
];

export default function ConnectionStatus({ state }: Props) {
  if (!state) return null;

  const currentIndex = steps.findIndex((s) => s.key === state);

  return (
    <div className="flex items-center gap-2 py-2">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;

        return (
          <div key={step.key} className="flex items-center gap-2">
            {i > 0 && (
              <div
                className={`h-px w-4 ${isDone ? "bg-green-500" : "bg-slate-700"}`}
              />
            )}
            <div className="flex items-center gap-1.5">
              <div
                className={`w-2 h-2 rounded-full ${
                  isDone
                    ? "bg-green-500"
                    : isActive
                      ? "bg-blue-400 animate-pulse"
                      : "bg-slate-700"
                }`}
              />
              <span
                className={`text-xs ${
                  isDone
                    ? "text-green-400"
                    : isActive
                      ? "text-blue-300"
                      : "text-slate-600"
                }`}
              >
                {step.label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
