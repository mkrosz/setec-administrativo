import { StorageImage } from "@/components/setec/StorageImage";
import { initials, type Palestrante } from "@/lib/setec";

/** Fotos de palestrantes/ministrantes sobrepostas (até 3, depois "+N"). */
export function AvataresPessoas({ pessoas }: { pessoas: Palestrante[] }) {
  const visiveis = pessoas.slice(0, pessoas.length > 3 ? 2 : 3);
  const extras = pessoas.length - visiveis.length;
  const item =
    "flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-full bg-secondary text-sm font-medium text-muted-foreground ring-2 ring-card";

  if (pessoas.length === 0) {
    return <span className={item}>?</span>;
  }

  return (
    <span className="flex shrink-0 -space-x-4">
      {visiveis.map((sp, i) => (
        <span key={i} className={item} style={{ zIndex: visiveis.length - i }} title={sp.nome}>
          <StorageImage
            path={sp.foto_url}
            alt={sp.nome}
            className="h-11 w-11 object-cover"
            fallback={<>{initials(sp.nome || "?")}</>}
          />
        </span>
      ))}
      {extras > 0 && <span className={`${item} text-xs`}>+{extras}</span>}
    </span>
  );
}
