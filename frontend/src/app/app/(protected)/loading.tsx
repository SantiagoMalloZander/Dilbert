export default function ProtectedLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-[3px] border-[#2A1A0A]/20 border-t-[#D4420A]" />
        <p className="font-mono text-xs uppercase tracking-wider text-[#1A1A1A]/40">
          Cargando...
        </p>
      </div>
    </div>
  );
}
