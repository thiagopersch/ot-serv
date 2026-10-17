import * as React from "react";

import { cn } from "@/lib/utils";

type ProgressProps = React.ComponentProps<"div"> & { value: number };

function Progress({ value, className, ...props }: ProgressProps) {
  const clamped = Math.min(100, Math.max(0, value));

  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={clamped}
      className={cn("bg-muted h-2 w-full overflow-hidden rounded-full", className)}
      {...props}
    >
      <div className="bg-primary h-full transition-[width] duration-200" style={{ width: `${clamped}%` }} />
    </div>
  );
}

export { Progress };
