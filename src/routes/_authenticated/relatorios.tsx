import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brl, num } from "@/lib/format";
import { BarChart3, Download } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, startOfWeek, startOfYear } from "date-fns";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — FitLounge" }] }),
  component: RelatoriosPage,
});

type Periodo = "hoje" | "semana" | "mes" | "ano" | "custom";

function range(p: Periodo, custom?: { de: string; ate: string }) {
  if (p === "custom" && custom?.de && custom?.ate) return { ini: new Date(custom.de + "T00:00:00"), fim: new Date(custom.ate + "T23:59:59") };
  const n = new Date();
  if (p === "hoje") return { ini: startOfDay(n), fim: endOfDay(n) };
  if (p === "semana") return { ini: startOfWeek(n, { weekStartsOn: 1 }), fim: endOfDay(n) };
  if (p === "mes") return { ini: startOfMonth(n), fim: endOfDay(n) };
  return { ini: startOfYear(n), fim: endOfDay(n) };
}

function csvDownload(filename: string, rows: any[]) {
  if (rows.length === 0) return;
  const headers = Object.keys(rows[0]);
  const escape = (v: any) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const csv = [headers.join(","), ...rows.map(r => headers.map(h => escape(r[h])).join(","))].join("\n");
  const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; a.click();
  URL.revokeObjectURL(url);
}

function RelatoriosPage() {
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const { ini, fim } = range(periodo, custom);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["rel-pedidos", periodo, custom],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos")
        .select("id,numero,data_hora,total,custo_total,lucro_estimado,forma_pagamento,status_pedido,status_pagamento,cliente:clientes(nome)")
        .gte("data_hora", ini.toISOString()).lte("data_hora", fim.toISOString());
      return data ?? [];
    },
  });

  const { data: financeiro = [] } = useQuery({
    queryKey: ["rel-fin", periodo, custom],
    queryFn: async () => {
      const { data } = await supabase.from("financeiro_lancamentos").select("*").eq("status","ativo")
        .gte("data", ini.toISOString().slice(0, 10)).lte("data", fim.toISOString().slice(0, 10));
      return data ?? [];
    },
  });

  const pagas = pedidos.filter((p: any) => p.status_pagamento === "pago");
  const pendentes = pedidos.filter((p: any) => p.status_pagamento === "pendente" && p.status_pedido !== "cancelado");
  const canceladas = pedidos.filter((p: any) => p.status_pedido === "cancelado");
  const faturamento = pagas.reduce((s, p: any) => s + Number(p.total), 0);
  const lucroBruto = pagas.reduce((s, p: any) => s + Number(p.lucro_estimado), 0);
  const entradas = financeiro.filter((l: any) => l.tipo === "entrada").reduce((s, l: any) => s + Number(l.valor), 0);
  const saidas = financeiro.filter((l: any) => l.tipo === "saida").reduce((s, l: any) => s + Number(l.valor), 0);

  const porForma: Record<string, number> = {};
  pagas.forEach((p: any) => { const k = p.forma_pagamento ?? "—"; porForma[k] = (porForma[k] || 0) + Number(p.total); });

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><BarChart3 className="size-6 text-primary" /><h1 className="text-2xl font-heading font-bold">Relatórios</h1></div>
        <Tabs value={periodo} onValueChange={v => setPeriodo(v as Periodo)}>
          <TabsList>
            <TabsTrigger value="hoje">Hoje</TabsTrigger><TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger><TabsTrigger value="ano">Ano</TabsTrigger><TabsTrigger value="custom">Custom</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {periodo === "custom" && (
        <Card className="p-3 mb-3 flex gap-3 items-end flex-wrap">
          <div><Label>De</Label><Input type="date" value={custom.de} onChange={e => setCustom({ ...custom, de: e.target.value })} /></div>
          <div><Label>Até</Label><Input type="date" value={custom.ate} onChange={e => setCustom({ ...custom, ate: e.target.value })} /></div>
        </Card>
      )}

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Kpi label="Faturamento (pago)" value={brl(faturamento)} />
        <Kpi label="Lucro bruto" value={brl(lucroBruto)} accent="primary" />
        <Kpi label="Entradas (financeiro)" value={brl(entradas)} />
        <Kpi label="Saídas" value={brl(saidas)} accent="danger" />
        <Kpi label="Vendas pagas" value={num(pagas.length)} />
        <Kpi label="Pendentes" value={num(pendentes.length)} accent="warn" />
        <Kpi label="Canceladas" value={num(canceladas.length)} accent="danger" />
        <Kpi label="Ticket médio" value={brl(pagas.length ? faturamento / pagas.length : 0)} />
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2 flex justify-between items-center">
            Vendas pagas por forma de pagamento
            <Button size="sm" variant="outline" onClick={() => csvDownload("vendas-formapag.csv", Object.entries(porForma).map(([forma, valor]) => ({ forma, valor })))}>
              <Download className="size-3.5 mr-1" /> CSV
            </Button>
          </div>
          <ul className="space-y-1.5 text-sm">
            {Object.entries(porForma).map(([k, v]) => <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{brl(v)}</span></li>)}
            {Object.keys(porForma).length === 0 && <li className="text-muted-foreground">Sem dados.</li>}
          </ul>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2 flex justify-between items-center">
            Vendas
            <Button size="sm" variant="outline" onClick={() => csvDownload("vendas.csv", pedidos.map((p: any) => ({ numero: p.numero, data: p.data_hora, cliente: p.cliente?.nome, total: p.total, status_pedido: p.status_pedido, status_pagamento: p.status_pagamento, forma: p.forma_pagamento })))}>
              <Download className="size-3.5 mr-1" /> Exportar
            </Button>
          </div>
          <div className="text-3xl font-bold">{num(pedidos.length)}</div>
          <div className="text-xs text-muted-foreground">no período</div>
        </Card>
      </div>

      <Card className="p-4">
        <div className="text-sm font-semibold mb-2">Vendas pendentes (a receber)</div>
        <ul className="divide-y divide-border text-sm">
          {pendentes.slice(0, 20).map((p: any) => (
            <li key={p.id} className="py-2 flex justify-between">
              <span>#{p.numero} — {p.cliente?.nome ?? "Sem cliente"}</span>
              <span className="flex items-center gap-2"><Badge variant="outline">{p.status_pedido}</Badge><span className="font-semibold text-amber-600">{brl(p.total)}</span></span>
            </li>
          ))}
          {pendentes.length === 0 && <li className="text-muted-foreground py-3">Nenhuma pendência.</li>}
        </ul>
      </Card>
    </>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "primary" | "warn" | "danger" }) {
  const cls = accent === "primary" ? "text-primary" : accent === "warn" ? "text-amber-600" : accent === "danger" ? "text-red-600" : "";
  return (
    <Card className="p-3">
      <div className="text-xs uppercase text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold ${cls}`}>{value}</div>
    </Card>
  );
}
