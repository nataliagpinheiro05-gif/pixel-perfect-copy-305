import { endOfDay, startOfDay, startOfMonth, startOfWeek, startOfYear, subDays } from "date-fns";

export type Periodo = "hoje" | "ontem" | "semana" | "mes" | "ano" | "7d" | "30d" | "custom";

export function rangeFor(p: Periodo, custom?: { de?: string; ate?: string }): { ini: Date; fim: Date; label: string } {
  const n = new Date();
  if (p === "custom" && custom?.de && custom?.ate) {
    return { ini: new Date(custom.de + "T00:00:00"), fim: new Date(custom.ate + "T23:59:59"), label: `${custom.de} a ${custom.ate}` };
  }
  switch (p) {
    case "hoje": return { ini: startOfDay(n), fim: endOfDay(n), label: "Hoje" };
    case "ontem": { const y = subDays(n, 1); return { ini: startOfDay(y), fim: endOfDay(y), label: "Ontem" }; }
    case "semana": return { ini: startOfWeek(n, { weekStartsOn: 1 }), fim: endOfDay(n), label: "Esta semana" };
    case "mes": return { ini: startOfMonth(n), fim: endOfDay(n), label: "Este mês" };
    case "ano": return { ini: startOfYear(n), fim: endOfDay(n), label: "Este ano" };
    case "7d": return { ini: startOfDay(subDays(n, 6)), fim: endOfDay(n), label: "Últimos 7 dias" };
    case "30d": return { ini: startOfDay(subDays(n, 29)), fim: endOfDay(n), label: "Últimos 30 dias" };
  }
  return { ini: startOfMonth(n), fim: endOfDay(n), label: "Este mês" };
}

export function csvDownload(filename: string, rows: Record<string, any>[]) {
  if (!rows.length) return;
  const headers = Object.keys(rows[0]);
  const esc = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map((r) => headers.map((h) => esc(r[h])).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

export function printRelatorio(titulo: string, periodoLabel: string, html: string) {
  const w = window.open("", "_blank", "width=900,height=700");
  if (!w) return;
  w.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>${titulo}</title>
    <style>
      body{font-family:system-ui,sans-serif;color:#111;margin:24px}
      h1{font-size:18px;margin:0 0 4px}
      .sub{color:#555;font-size:12px;margin-bottom:16px}
      table{width:100%;border-collapse:collapse;font-size:12px}
      th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
      th{background:#f4f4f4}
      .totais{margin-top:12px;font-size:12px}
      @media print{button{display:none}}
    </style></head><body>
    <h1>${titulo}</h1>
    <div class="sub">Período: ${periodoLabel} • Emitido em ${new Date().toLocaleString("pt-BR")}</div>
    ${html}
    <script>window.onload=()=>window.print()</script>
    </body></html>`);
  w.document.close();
}
