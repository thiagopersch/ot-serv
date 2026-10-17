import { Skeleton } from "@/components/ui/skeleton";

export default function LoadingEditPost() {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-2">
        <Skeleton className="h-8 w-72" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="flex flex-col gap-6 lg:flex-row lg:items-start">
        <div className="flex flex-1 flex-col gap-4">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
        <div className="flex w-full flex-col gap-4 lg:w-80">
          <Skeleton className="h-48 w-full" />
        </div>
      </div>
    </div>
  );
}
