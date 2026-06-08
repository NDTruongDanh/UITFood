export function PageErrorFallback() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-3 px-4 text-center">
      <p className="text-lg font-semibold text-foreground">
        This page encountered an error.
      </p>
      <p className="text-sm text-muted-foreground">Try refreshing the page.</p>
    </div>
  );
}
