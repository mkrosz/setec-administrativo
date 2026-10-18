import { useState } from "react";
import type { DateRange } from "react-day-picker";
import { ptBR } from "react-day-picker/locale";
import { CalendarDays } from "lucide-react";

import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

const fieldLabel = "text-[10px] uppercase tracking-[0.16em] text-muted-foreground";
const fieldBox =
  "flex h-18.5 w-full flex-col justify-center gap-1 rounded-2xl border border-border/60 bg-field/60 px-5 text-left transition-colors hover:border-primary/50 data-[state=open]:border-primary/70";
const popover = "w-auto rounded-2xl border-border/60 bg-popover p-3";

const MESES = [
  "janeiro",
  "fevereiro",
  "março",
  "abril",
  "maio",
  "junho",
  "julho",
  "agosto",
  "setembro",
  "outubro",
  "novembro",
  "dezembro",
];

const dd = (d: Date) => String(d.getDate()).padStart(2, "0");

/** "05 - 09 de Outubro", "28 de Setembro - 02 de Outubro" ou "05 de Outubro". */
export function formatarDatas(from: Date, to: Date) {
  const mesFrom = MESES[from.getMonth()];
  const mesTo = MESES[to.getMonth()];
  if (from.getTime() === to.getTime()) return `${dd(from)} de ${mesTo}`;
  if (from.getMonth() === to.getMonth() && from.getFullYear() === to.getFullYear()) {
    return `${dd(from)} - ${dd(to)} de ${mesTo}`;
  }
  return `${dd(from)} de ${mesFrom} - ${dd(to)} de ${mesTo}`;
}

function mesIndex(nome: string | undefined) {
  if (!nome) return -1;
  const n = nome.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase();
  return MESES.findIndex((m) => m.normalize("NFD").replace(/\p{M}/gu, "").toLowerCase() === n);
}

/** Lê o texto salvo ("05 - 09 de Outubro", "15 a 19 de Maio"...) para pré-selecionar o calendário. */
function lerDatas(texto: string, ano: number): DateRange | undefined {
  const t = texto.trim();
  const intervalo = /^(\d{1,2})(?:\s+de\s+([\p{L}]+))?\s*(?:-|–|a|até)\s*(\d{1,2})\s+de\s+([\p{L}]+)/iu.exec(t);
  if (intervalo) {
    const mesTo = mesIndex(intervalo[4]);
    const mesFrom = intervalo[2] ? mesIndex(intervalo[2]) : mesTo;
    if (mesTo < 0 || mesFrom < 0) return undefined;
    const from = new Date(ano, mesFrom, Number(intervalo[1]));
    const to = new Date(ano, mesTo, Number(intervalo[3]));
    if (to < from) from.setFullYear(ano - 1);
    return { from, to };
  }
  const unico = /^(\d{1,2})\s+de\s+([\p{L}]+)/iu.exec(t);
  if (unico && mesIndex(unico[2]) >= 0) {
    const d = new Date(ano, mesIndex(unico[2]), Number(unico[1]));
    return { from: d, to: d };
  }
  return undefined;
}

function anoNumero(ano: string) {
  const n = Number.parseInt(ano, 10);
  return Number.isFinite(n) && n > 1900 ? n : new Date().getFullYear();
}

/**
 * Campo único "Data do evento" (dias + ano). O calendário sempre abre no mês de hoje,
 * com a semana já salva destacada; a pessoa navega até o evento e marca o intervalo.
 */
export function DataEventoField({
  datas,
  ano,
  onChange,
}: {
  datas: string;
  ano: string;
  /** Recebe o texto formatado e o ano do primeiro dia escolhido. */
  onChange: (datas: string, ano: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [range, setRange] = useState<DateRange | undefined>();
  const [mes, setMes] = useState<Date>(new Date());

  function abrir(v: boolean) {
    setOpen(v);
    if (!v) return;
    setRange(lerDatas(datas, anoNumero(ano)));
    setMes(new Date());
  }

  // 1º clique sempre começa uma seleção nova (mesmo com a semana salva destacada);
  // o 2º fecha o intervalo. Clicar duas vezes no mesmo dia = evento de 1 dia.
  function escolher(dia: Date) {
    setRange((r) => {
      if (!r?.from || r.to) return { from: dia, to: undefined };
      return dia < r.from ? { from: dia, to: r.from } : { from: r.from, to: dia };
    });
  }

  const completo = range?.from && range.to;

  return (
    <Popover open={open} onOpenChange={abrir}>
      <PopoverTrigger className={fieldBox}>
        <span className={fieldLabel}>Data do evento</span>
        <span className="flex items-center justify-between gap-2 text-[15px] text-foreground">
          <span className="truncate">
            {datas ? `${datas}${ano ? ` de ${ano}` : ""}` : "Selecionar no calendário"}
          </span>
          <CalendarDays className="h-4 w-4 shrink-0 text-muted-foreground" />
        </span>
      </PopoverTrigger>
      <PopoverContent align="end" className={popover}>
        <Calendar
          mode="range"
          locale={ptBR}
          selected={range}
          onSelect={(_, dia) => escolher(dia)}
          month={mes}
          onMonthChange={setMes}
          numberOfMonths={1}
          formatters={{
            // Cabeçalho do calendário com inicial maiúscula ("Outubro 2026")
            formatCaption: (d) => `${MESES[d.getMonth()]!.replace(/^./, (c) => c.toUpperCase())} ${d.getFullYear()}`,
          }}
          className="bg-transparent p-0 [--cell-size:2.25rem]"
        />
        {/* w-0 min-w-full: o rodapé acompanha a largura do calendário em vez de alargar o popover */}
        <div className="mt-3 flex w-0 min-w-full items-center justify-between gap-3 border-t border-border/60 pt-3">
          <span className="min-w-0 flex-1 text-xs leading-snug text-muted-foreground">
            {completo
              ? `${formatarDatas(range.from!, range.to!)} de ${range.from!.getFullYear()}`
              : range?.from
                ? "Escolha o último dia"
                : "Escolha o primeiro dia"}
          </span>
          <button
            type="button"
            disabled={!completo}
            onClick={() => {
              if (!range?.from || !range.to) return;
              onChange(formatarDatas(range.from, range.to), String(range.from.getFullYear()));
              setOpen(false);
            }}
            className="h-8 shrink-0 rounded-full bg-primary px-4 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary-glow disabled:opacity-50"
          >
            Aplicar
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
