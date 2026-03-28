export default function DevPage() {
  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-5 border-b bg-card/60">
        <p className="text-[9px] font-mono font-semibold uppercase tracking-[0.22em] text-muted-foreground">
          Internal
        </p>
        <h1 className="font-heading text-4xl tracking-wide mt-1 leading-none">DEV</h1>
        <p className="text-sm text-muted-foreground mt-1.5">
          Panel de desarrollo — en construcción.
        </p>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <div className="text-center space-y-3">
          <p className="font-heading text-6xl tracking-wide text-muted-foreground/20">
            WIP
          </p>
          <p className="text-xs font-mono uppercase tracking-[0.2em] text-muted-foreground/40">
            Próximamente
          </p>
        </div>
      </div>
    </div>
  );
}
