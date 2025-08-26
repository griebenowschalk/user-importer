import { cn } from "@/lib/utils";

export function Container({
  children,
  className,
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn("container mx-auto px-4 gap-4 flex flex-col", className)}
    >
      {children}
    </div>
  );
}
