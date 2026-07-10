import React from "react";
import { cn } from "@/lib/utils";
import { AssignmentStatus } from "@/lib/types";

interface StatusBadgeProps {
  status: AssignmentStatus;
  className?: string;
}

const STYLES: Record<AssignmentStatus, string> = {
  submitted: "bg-green-100 text-green-800 border-green-200",
  in_progress: "bg-amber-100 text-amber-800 border-amber-200",
  pending: "bg-gray-100 text-gray-800 border-gray-200",
};

const LABELS: Record<AssignmentStatus, string> = {
  submitted: "Enviada",
  in_progress: "En progreso",
  pending: "Pendiente",
};

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, className }) => {
  return (
    <span
      className={cn(
        "inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border",
        STYLES[status],
        className
      )}
    >
      {LABELS[status]}
    </span>
  );
};

export default StatusBadge;
