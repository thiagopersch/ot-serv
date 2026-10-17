"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { TabsList } from "@/components/ui/tabs";

const SCROLL_STEP = 180;

/** `TabsList` que não quebra linha quando há muitas abas — em vez disso, rola
 * horizontalmente com setas nas pontas (mesma ideia do componente de tabs do Angular
 * Material), evitando o "salto" de altura que o wrap causa em forms com muitas tabs. */
export function ScrollableTabsList({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(false);

  function updateScrollState() {
    const el = scrollRef.current;
    if (!el) return;
    setCanScrollLeft(el.scrollLeft > 1);
    setCanScrollRight(el.scrollLeft + el.clientWidth < el.scrollWidth - 1);
  }

  useEffect(() => {
    updateScrollState();
    const el = scrollRef.current;
    if (!el) return;

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  function scrollBy(amount: number) {
    scrollRef.current?.scrollBy({ left: amount, behavior: "smooth" });
  }

  return (
    <div className="flex items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn("shrink-0", !canScrollLeft && "invisible")}
        onClick={() => scrollBy(-SCROLL_STEP)}
        title="Rolar abas para a esquerda"
      >
        <ChevronLeft className="size-4" />
      </Button>
      <div ref={scrollRef} onScroll={updateScrollState} className="min-w-0 flex-1 overflow-x-auto">
        <TabsList className={cn("w-max flex-nowrap", className)}>{children}</TabsList>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className={cn("shrink-0", !canScrollRight && "invisible")}
        onClick={() => scrollBy(SCROLL_STEP)}
        title="Rolar abas para a direita"
      >
        <ChevronRight className="size-4" />
      </Button>
    </div>
  );
}
