import type { ConnectionState } from "../types/ipc";

interface Props {
  state: ConnectionState | null;
  isRelay?: boolean;
  isTcpRelay?: boolean;
}

const directSteps: { key: ConnectionState; label: string }[] = [
  { key: "registering", label: "Registering" },
  { key: "waiting_peer", label: "Waiting for peer" },
  { key: "punching", label: "Hole punching" },
  { key: "handshaking", label: "DTLS handshake" },
  { key: "connected", label: "Connected" },
];

const relaySteps: { key: ConnectionState; label: string }[] = [
  { key: "registering", label: "Registering" },
  { key: "waiting_peer", label: "Waiting for peer" },
  { key: "relaying", label: "UDP Relay" },
  { key: "connected", label: "Connected" },
];

const relayTcpSteps: { key: ConnectionState; label: string }[] = [
  { key: "registering", label: "Registering" },
  { key: "waiting_peer", label: "Waiting for peer" },
  { key: "relay_tcp", label: "TCP Relay" },
  { key: "connected", label: "Connected" },
];

export default function ConnectionStatus({ state, isRelay, isTcpRelay }: Props) {
  if (!state) return null;

  const steps = isRelay ? (isTcpRelay ? relayTcpSteps : relaySteps) : directSteps;
  const currentIndex = steps.findIndex((s) => s.key === state);

  return (
    <div className="flex items-center gap-2 py-2">
      {steps.map((step, i) => {
        const isActive = i === currentIndex;
        const isDone = i < currentIndex;
        const isRelayStep = step.key === "relaying" || step.key === "relay_tcp";

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
                      ? isRelayStep
                        ? "bg-amber-400 animate-pulse"
                        : "bg-blue-400 animate-pulse"
                      : "bg-slate-700"
                }`}
              />
              <span
                className={`text-xs ${
                  isDone
                    ? "text-green-400"
                    : isActive
                      ? isRelayStep
                        ? "text-amber-300"
                        : "text-blue-300"
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
