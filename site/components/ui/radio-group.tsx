"use client";

import { Radio, RadioGroup as RadioGroupPrimitive } from "@base-ui/react";

import { cn } from "@/lib/utils";

type RadioGroupOwnProps = RadioGroupPrimitive.Props<unknown> & {
  /** Layout puramente visual (base-ui não modela orientação no primitivo em si) — não afeta
   * navegação por teclado, só a direção do flex. @default "vertical" */
  orientation?: "horizontal" | "vertical";
};

function RadioGroup({ className, orientation = "vertical", ...props }: RadioGroupOwnProps) {
  return (
    <RadioGroupPrimitive
      data-slot="radio-group"
      className={cn("flex gap-2", orientation === "horizontal" ? "flex-row flex-wrap" : "flex-col", className)}
      {...props}
    />
  );
}

function RadioGroupItem({ className, ...props }: Radio.Root.Props<unknown>) {
  return (
    <Radio.Root
      data-slot="radio-group-item"
      className={cn(
        "flex size-4 shrink-0 items-center justify-center rounded-full border border-input shadow-xs transition-[color,box-shadow] outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-destructive aria-invalid:ring-3 aria-invalid:ring-destructive/20 data-[checked]:border-primary dark:bg-input/30",
        className,
      )}
      {...props}
    >
      <Radio.Indicator
        data-slot="radio-group-indicator"
        className="flex items-center justify-center"
      >
        <span className="size-2 rounded-full bg-primary" />
      </Radio.Indicator>
    </Radio.Root>
  );
}

export { RadioGroup, RadioGroupItem };
