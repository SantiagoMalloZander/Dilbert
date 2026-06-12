export default function ProtectedLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-border border-t-[#D4420A]" />
        <p className="font-mono text-xs uppercase tracking-wider text-foreground/40">
          Cargando...
        </p>
      </div>
    </div>
  );
}
