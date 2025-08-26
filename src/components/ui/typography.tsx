import { cn } from "../../lib/utils";

export function Typography({
  children,
  as,
  className,
}: {
  children: React.ReactNode;
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "div";
  className?: string;
}) {
  switch (as) {
    case "h1":
      return (
        <h1
          className={cn(
            "scroll-m-20 text-4xl font-bold tracking-tight",
            className
          )}
        >
          {children}
        </h1>
      );
    case "h2":
      return (
        <h2
          className={cn(
            "scroll-m-20 border-b pb-2 text-3xl font-bold tracking-tight transition-colors first:mt-0",
            className
          )}
        >
          {children}
        </h2>
      );
    case "h3":
      return (
        <h3
          className={cn(
            "scroll-m-20 text-2xl font-semibold tracking-tight",
            className
          )}
        >
          {children}
        </h3>
      );
    case "h4":
      return (
        <h4
          className={cn(
            "scroll-m-20 text-xl font-semibold tracking-tight",
            className
          )}
        >
          {children}
        </h4>
      );
    case "h5":
      return (
        <h5
          className={cn(
            "scroll-m-20 text-lg font-semibold tracking-tight",
            className
          )}
        >
          {children}
        </h5>
      );
    case "h6":
      return (
        <h6
          className={cn(
            "scroll-m-20 text-base font-semibold tracking-tight",
            className
          )}
        >
          {children}
        </h6>
      );
    case "p":
      return <p className={cn("text-base", className)}>{children}</p>;
    case "span":
      return <span className={cn("text-base", className)}>{children}</span>;
    case "div":
      return <div className={cn("text-base", className)}>{children}</div>;
    default:
      return <p className={cn("text-base", className)}>{children}</p>;
  }
}
