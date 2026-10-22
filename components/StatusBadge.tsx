import {
  CheckCircle2,
  CircleHelp,
  Clock3,
  History,
  MinusCircle,
  ShieldCheck,
  XCircle,
} from "lucide-react";
import type { DeadlineStatus, Verdict } from "@/lib/ui/types";

type BadgeStatus = DeadlineStatus | Verdict;

const styles = {
  eligible: {
    label: "Likely eligible",
    Icon: CheckCircle2,
    className: "bg-status-greenBg text-status-green",
  },
  passes_checkable: {
    label: "Passes the rules we can check",
    Icon: ShieldCheck,
    className: "bg-status-blueBg text-status-blue",
  },
  open: {
    label: "Open",
    Icon: CheckCircle2,
    className: "bg-status-greenBg text-status-green",
  },
  closing_soon: {
    label: "Closing soon",
    Icon: Clock3,
    className: "bg-status-amberBg text-status-amber",
  },
  cant_tell: {
    label: "Can't tell",
    Icon: CircleHelp,
    className: "bg-status-amberBg text-status-amber",
  },
  not_eligible: {
    label: "Not eligible",
    Icon: XCircle,
    className: "bg-status-redBg text-status-red",
  },
  closed: {
    label: "Closed",
    Icon: XCircle,
    className: "bg-status-redBg text-status-red",
  },
  stale_cycle: {
    label: "Old cycle, check portal",
    Icon: History,
    className: "bg-status-greyBg text-status-grey",
  },
  unknown: {
    label: "No closing date",
    Icon: MinusCircle,
    className: "bg-status-greyBg text-status-grey",
  },
} as const;

export function StatusBadge({
  status,
  kind,
}: {
  status: BadgeStatus;
  kind?: "verdict" | "deadline";
}) {
  const { label, Icon, className } = styles[status];

  return (
    <span
      data-testid={kind === "verdict" ? "verdict" : kind === "deadline" ? "status" : undefined}
      data-value={status}
      className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold ${className}`}
    >
      <Icon size={16} aria-hidden="true" />
      {label}
    </span>
  );
}
