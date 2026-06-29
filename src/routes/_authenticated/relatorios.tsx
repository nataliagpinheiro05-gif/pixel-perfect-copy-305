import { createFileRoute } from "@tanstack/react-router";
import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brl, num } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { BarChart3, Download, Printer, MessageCircle } from "lucide-react";
import { rangeFor, csvDownload, printRelatorio, type Periodo } from "@/lib/relatorios";
import { format } from "date-fns";

export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — FitLounge" }] }),
  component: RelatoriosPage,
});

function RelatoriosPage() {
  const { podeFinanceiro, isAdmin } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const { ini, fim, label } = rangeFor(periodo, custom);

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
        <div className="flex items-center gap-2">
          <BarChart3 className="size-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Relatórios</h1>
        </div>
        <PeriodoSeletor periodo={periodo} setPeriodo={setPeriodo} custom={custom} setCustom={setCustom} label={label} />
      </div>

      <Tabs defaultValue="vendas">
        <TabsList className="flex flex-wrap h-auto gap-1">
          <TabsTrigger value="vendas">Vendas</TabsTrigger>
          {podeFinanceiro && <TabsTrigger value="financeiro">Financeiro</TabsTrigger>}
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="clientes">Clientes</TabsTrigger>
          <TabsTrigger value="estoque">Estoque</TabsTrigger>
          {podeFinanceiro && <TabsTrigger value="caixa">Caixa</TabsTrigger>}
          <TabsTrigger value="cozinha">Cozinha</TabsTrigger>
          {isAdmin && <TabsTrigger value="cancelamentos">Cancelamentos</TabsTrigger>}
        </TabsList>

        <TabsContent value="vendas"><VendasTab ini={ini} fim={fim} label={label} /></TabsContent>
        {podeFinanceiro && <TabsContent value="financeiro"><FinanceiroTab ini={ini} fim={fim} label={label} /></TabsContent>}
        <TabsContent value="produtos"><ProdutosTab ini={ini} fim={fim} label={label} podeFinanceiro={podeFinanceiro} /></TabsContent>
        <TabsContent value="clientes"><ClientesTab ini={ini} fim={fim} label={label} /></TabsContent>
        <TabsContent value="estoque"><EstoqueTab ini={ini} fim={fim} label={label} /></TabsContent>
        {podeFinanceiro && <TabsContent value="caixa"><CaixaTab ini={ini} fim={fim} label={label} /></TabsContent>}
        <TabsContent value="cozinha"><CozinhaTab ini={ini} fim={fim} label={label} /></TabsContent>
        {isAdmin && <TabsContent value="cancelamentos"><CancelamentosTab ini={ini} fim={fim} label={label} /></TabsContent>}
      </Tabs>
    </div>
  );
}

function PeriodoSeletor({ periodo, setPeriodo, custom, setCustom, label }: any) {
  return (
    <div className="space-y-2">
      <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
        <TabsList className="flex flex-wrap h-auto">
          <TabsTrigger value="hoje">Hoje</TabsTrigger>
          <TabsTrigger value="ontem">Ontem</TabsTrigger>
          <TabsTrigger value="semana">Semana</TabsTrigger>
          <TabsTrigger value="mes">Mês</TabsTrigger>
          <TabsTrigger value="7d">7d</TabsTrigger>
          <TabsTrigger value="30d">30d</TabsTrigger>
          <TabsTrigger value="ano">Ano</TabsTrigger>
          <TabsTrigger value="custom">Custom</TabsTrigger>
        </TabsList>
      </Tabs>
      {periodo === "custom" && (
        <div className="flex gap-2 items-end">
          <div><Label className="text-xs">De</Label><Input type="date" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} /></div>
          <div><Label className="text-xs">Até</Label><Input type="date" value={custom.ate} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} /></div>
        </div>
      )}
      <div className="text-xs text-muted-foreground">Período: {label}</div>
    </div>
  );
}

function Kpi({ label, value, accent }: { label: string; value: string; accent?: "primary" | "warn" | "danger" | "success" }) {
  const cls = accent === "primary" ? "text-primary" : accent === "warn" ? "text-amber-600" : accent === "danger" ? "text-red-600" : accent === "success" ? "text-emerald-600" : "";
  return (
    <Card className="p-3">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`text-lg md:text-xl font-bold truncate ${cls}`}>{value}</div>
    </Card>
  );
}

function ToolbarExport({ filename, rows, titulo, periodoLabel, tableHtml }: { filename: string; rows: any[]; titulo: string; periodoLabel: string; tableHtml: string }) {
  return (
    <div className="flex gap-2">
      <Button size="sm" variant="outline" onClick={() => csvDownload(filename, rows)}><Download className="size-3.5 mr-1" />CSV</Button>
      <Button size="sm" variant="outline" onClick={() => printRelatorio(titulo, periodoLabel, tableHtml)}><Printer className="size-3.5 mr-1" />Imprimir</Button>
    </div>
  );
}

/* -------- VENDAS / COMANDAS -------- */
function VendasTab({ ini, fim, label }: any) {
  const { data: pedidos = [] } = useQuery({
    queryKey: ["rel-vendas", ini.toISOString(), fim.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos")
        .select("id,numero,data_hora,total,desconto,valor_pago,valor_pendente,forma_pagamento,status_pedido,status_pagamento,status_comanda,usuario_id,cliente:clientes(nome)")
        .gte("data_hora", ini.toISOString()).lte("data_hora", fim.toISOString())
        .order("data_hora", { ascending: false });
      return data ?? [];
    },
  });

  const pagas = pedidos.filter((p: any) => p.status_pagamento === "pago");
  const parciais = pedidos.filter((p: any) => p.status_pagamento === "parcial");
  const pendentes = pedidos.filter((p: any) => p.status_pagamento === "pendente" && p.status_pedido !== "cancelado");
  const canceladas = pedidos.filter((p: any) => p.status_pedido === "cancelado" || p.status_comanda === "cancelada");
  const abertas = pedidos.filter((p: any) => ["aberta", "em_consumo", "aguardando_pagamento"].includes(p.status_comanda));
  const faturamento = pagas.reduce((s: number, p: any) => s + Number(p.total), 0) + parciais.reduce((s: number, p: any) => s + Number(p.valor_pago || 0), 0);
  const aReceber = pendentes.reduce((s: number, p: any) => s + Number(p.total), 0) + parciais.reduce((s: number, p: any) => s + Number(p.valor_pendente || 0), 0);
  const descontoTotal = pedidos.reduce((s: number, p: any) => s + Number(p.desconto || 0), 0);
  const ticket = pagas.length ? pagas.reduce((s: number, p: any) => s + Number(p.total), 0) / pagas.length : 0;

  const rows = pedidos.map((p: any) => ({
    numero: p.numero, data: format(new Date(p.data_hora), "dd/MM/yyyy HH:mm"),
    cliente: p.cliente?.nome ?? "—", status_comanda: p.status_comanda, status_pagamento: p.status_pagamento,
    total: Number(p.total).toFixed(2), recebido: Number(p.valor_pago || 0).toFixed(2),
    pendente: Number(p.valor_pendente || 0).toFixed(2), forma: p.forma_pagamento ?? "",
  }));
  const tableHtml = `<table><thead><tr><th>#</th><th>Data</th><th>Cliente</th><th>Status</th><th>Pagto</th><th>Total</th><th>Recebido</th><th>Pendente</th><th>Forma</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.numero}</td><td>${r.data}</td><td>${r.cliente}</td><td>${r.status_comanda}</td><td>${r.status_pagamento}</td><td>${brl(+r.total)}</td><td>${brl(+r.recebido)}</td><td>${brl(+r.pendente)}</td><td>${r.forma}</td></tr>`).join("")}</tbody></table><div class="totais"><b>Faturamento:</b> ${brl(faturamento)} • <b>A receber:</b> ${brl(aReceber)} • <b>Ticket médio:</b> ${brl(ticket)}</div>`;

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Faturamento" value={brl(faturamento)} accent="success" />
        <Kpi label="A receber" value={brl(aReceber)} accent="warn" />
        <Kpi label="Ticket médio" value={brl(ticket)} accent="primary" />
        <Kpi label="Desconto concedido" value={brl(descontoTotal)} />
        <Kpi label="Comandas pagas" value={num(pagas.length)} />
        <Kpi label="Parciais" value={num(parciais.length)} accent="warn" />
        <Kpi label="Pendentes" value={num(pendentes.length)} accent="warn" />
        <Kpi label="Canceladas" value={num(canceladas.length)} accent="danger" />
        <Kpi label="Abertas" value={num(abertas.length)} accent="primary" />
        <Kpi label="Total comandas" value={num(pedidos.length)} />
      </div>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Comandas no período</div>
          <ToolbarExport filename="vendas.csv" rows={rows} titulo="Relatório de Vendas" periodoLabel={label} tableHtml={tableHtml} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">#</th><th className="text-left">Data</th><th className="text-left">Cliente</th><th className="text-left">Status</th><th className="text-left">Pagto</th><th className="text-right">Total</th><th className="text-right">Recebido</th><th className="text-right">Pendente</th><th className="text-left">Forma</th></tr></thead>
            <tbody>
              {pedidos.map((p: any) => (
                <tr key={p.id} className="border-b">
                  <td className="py-1.5">#{p.numero}</td>
                  <td>{format(new Date(p.data_hora), "dd/MM HH:mm")}</td>
                  <td className="truncate max-w-[120px]">{p.cliente?.nome ?? "—"}</td>
                  <td><Badge variant="outline" className="text-[10px]">{p.status_comanda}</Badge></td>
                  <td><Badge variant="outline" className="text-[10px]">{p.status_pagamento}</Badge></td>
                  <td className="text-right">{brl(p.total)}</td>
                  <td className="text-right text-emerald-600">{brl(p.valor_pago)}</td>
                  <td className="text-right text-amber-600">{brl(p.valor_pendente)}</td>
                  <td className="capitalize">{p.forma_pagamento ?? "—"}</td>
                </tr>
              ))}
              {pedidos.length === 0 && <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Nenhuma comanda no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------- FINANCEIRO -------- */
function FinanceiroTab({ ini, fim, label }: any) {
  const { data: lancs = [] } = useQuery({
    queryKey: ["rel-fin", ini.toISOString(), fim.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from("financeiro_lancamentos").select("*")
        .gte("data", ini.toISOString().slice(0, 10)).lte("data", fim.toISOString().slice(0, 10))
        .order("data", { ascending: false });
      return data ?? [];
    },
  });
  const ativos = lancs.filter((l: any) => l.status === "ativo");
  const estornados = lancs.filter((l: any) => l.status === "estornado");
  const entradas = ativos.filter((l: any) => l.tipo === "entrada").reduce((s: number, l: any) => s + Number(l.valor), 0);
  const saidas = ativos.filter((l: any) => l.tipo === "saida").reduce((s: number, l: any) => s + Number(l.valor), 0);
  const saldo = entradas - saidas;

  const porForma: Record<string, number> = {};
  ativos.filter((l: any) => l.tipo === "entrada").forEach((l: any) => { const k = l.forma_pagamento || "—"; porForma[k] = (porForma[k] || 0) + Number(l.valor); });
  const porCategoria: Record<string, number> = {};
  ativos.forEach((l: any) => { const k = `${l.tipo}: ${l.categoria || "—"}`; porCategoria[k] = (porCategoria[k] || 0) + Number(l.valor); });

  const rows = lancs.map((l: any) => ({
    data: l.data, tipo: l.tipo, categoria: l.categoria, descricao: l.descricao,
    valor: Number(l.valor).toFixed(2), forma: l.forma_pagamento ?? "", status: l.status,
  }));
  const tableHtml = `<table><thead><tr><th>Data</th><th>Tipo</th><th>Categoria</th><th>Descrição</th><th>Valor</th><th>Forma</th><th>Status</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.data}</td><td>${r.tipo}</td><td>${r.categoria}</td><td>${r.descricao}</td><td>${brl(+r.valor)}</td><td>${r.forma}</td><td>${r.status}</td></tr>`).join("")}</tbody></table><div class="totais"><b>Entradas:</b> ${brl(entradas)} • <b>Saídas:</b> ${brl(saidas)} • <b>Saldo:</b> ${brl(saldo)}</div>`;

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Entradas (ativas)" value={brl(entradas)} accent="success" />
        <Kpi label="Saídas (ativas)" value={brl(saidas)} accent="danger" />
        <Kpi label="Saldo" value={brl(saldo)} accent={saldo >= 0 ? "primary" : "danger"} />
        <Kpi label="Lançamentos estornados" value={num(estornados.length)} accent="warn" />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Entradas por forma de pagamento</div>
          <ul className="space-y-1 text-sm">
            {Object.entries(porForma).map(([k, v]) => <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{brl(v)}</span></li>)}
            {!Object.keys(porForma).length && <li className="text-muted-foreground">—</li>}
          </ul>
        </Card>
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Por categoria</div>
          <ul className="space-y-1 text-sm max-h-56 overflow-auto">
            {Object.entries(porCategoria).map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold">{brl(v)}</span></li>)}
            {!Object.keys(porCategoria).length && <li className="text-muted-foreground">—</li>}
          </ul>
        </Card>
      </div>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Lançamentos</div>
          <ToolbarExport filename="financeiro.csv" rows={rows} titulo="Relatório Financeiro" periodoLabel={label} tableHtml={tableHtml} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">Data</th><th className="text-left">Tipo</th><th className="text-left">Categoria</th><th className="text-left">Descrição</th><th className="text-right">Valor</th><th className="text-left">Forma</th><th className="text-left">Status</th></tr></thead>
            <tbody>
              {lancs.map((l: any) => (
                <tr key={l.id} className="border-b">
                  <td className="py-1.5">{l.data}</td>
                  <td><Badge variant="outline" className="text-[10px]">{l.tipo}</Badge></td>
                  <td>{l.categoria}</td>
                  <td className="truncate max-w-[200px]">{l.descricao}</td>
                  <td className={`text-right ${l.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}`}>{brl(l.valor)}</td>
                  <td className="capitalize">{l.forma_pagamento ?? "—"}</td>
                  <td><Badge variant="outline" className="text-[10px]">{l.status}</Badge></td>
                </tr>
              ))}
              {!lancs.length && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Sem lançamentos.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------- PRODUTOS -------- */
function ProdutosTab({ ini, fim, label, podeFinanceiro }: any) {
  const { data: itens = [] } = useQuery({
    queryKey: ["rel-prod", ini.toISOString(), fim.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from("pedido_itens")
        .select("id,nome_produto,quantidade,subtotal,custo_unitario,sabor,status_preparo,pedido:pedidos!inner(status_pagamento,status_pedido,data_hora),produto:produtos(categoria:categorias_produtos(nome))")
        .gte("pedido.data_hora", ini.toISOString())
        .lte("pedido.data_hora", fim.toISOString());
      return data ?? [];
    },
  });
  const validos = itens.filter((i: any) => i.status_preparo !== "cancelado" && ["pago", "parcial"].includes(i.pedido?.status_pagamento) && i.pedido?.status_pedido !== "cancelado");

  const map = new Map<string, { nome: string; categoria: string; qtd: number; faturamento: number; custo: number }>();
  validos.forEach((i: any) => {
    const k = i.nome_produto;
    const cur = map.get(k) ?? { nome: i.nome_produto, categoria: i.produto?.categoria?.nome ?? "—", qtd: 0, faturamento: 0, custo: 0 };
    cur.qtd += Number(i.quantidade);
    cur.faturamento += Number(i.subtotal);
    cur.custo += Number(i.custo_unitario || 0) * Number(i.quantidade);
    map.set(k, cur);
  });
  const list = Array.from(map.values()).map((r) => ({ ...r, lucro: r.faturamento - r.custo, ticket: r.qtd ? r.faturamento / r.qtd : 0 })).sort((a, b) => b.qtd - a.qtd);

  const porCategoria = new Map<string, number>();
  list.forEach((r) => porCategoria.set(r.categoria, (porCategoria.get(r.categoria) ?? 0) + r.faturamento));

  const rows = list.map((r) => ({ produto: r.nome, categoria: r.categoria, qtd: r.qtd, faturamento: r.faturamento.toFixed(2), custo: r.custo.toFixed(2), lucro: r.lucro.toFixed(2), ticket: r.ticket.toFixed(2) }));
  const tableHtml = `<table><thead><tr><th>Produto</th><th>Categoria</th><th>Qtd</th><th>Faturamento</th>${podeFinanceiro ? "<th>Custo</th><th>Lucro</th>" : ""}<th>Ticket</th></tr></thead><tbody>${list.map(r => `<tr><td>${r.nome}</td><td>${r.categoria}</td><td>${r.qtd}</td><td>${brl(r.faturamento)}</td>${podeFinanceiro ? `<td>${brl(r.custo)}</td><td>${brl(r.lucro)}</td>` : ""}<td>${brl(r.ticket)}</td></tr>`).join("")}</tbody></table>`;

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Produtos vendidos (qtd)" value={num(list.reduce((s, r) => s + r.qtd, 0))} accent="primary" />
        <Kpi label="Faturamento por produtos" value={brl(list.reduce((s, r) => s + r.faturamento, 0))} accent="success" />
        {podeFinanceiro && <Kpi label="Lucro estimado" value={brl(list.reduce((s, r) => s + r.lucro, 0))} accent="primary" />}
        <Kpi label="Itens distintos" value={num(list.length)} />
      </div>
      <div className="grid lg:grid-cols-2 gap-3">
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Categorias mais vendidas</div>
          <ul className="text-sm space-y-1">
            {Array.from(porCategoria.entries()).sort((a, b) => b[1] - a[1]).map(([k, v]) => (
              <li key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold">{brl(v)}</span></li>
            ))}
            {!porCategoria.size && <li className="text-muted-foreground">—</li>}
          </ul>
        </Card>
        <Card className="p-3">
          <div className="text-sm font-semibold mb-2">Top 10 produtos (quantidade)</div>
          <ul className="text-sm space-y-1">
            {list.slice(0, 10).map((r) => <li key={r.nome} className="flex justify-between"><span className="truncate pr-2">{r.nome}</span><span className="font-semibold">{num(r.qtd)} • {brl(r.faturamento)}</span></li>)}
            {!list.length && <li className="text-muted-foreground">—</li>}
          </ul>
        </Card>
      </div>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Produtos</div>
          <ToolbarExport filename="produtos.csv" rows={rows} titulo="Relatório de Produtos" periodoLabel={label} tableHtml={tableHtml} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">Produto</th><th className="text-left">Categoria</th><th className="text-right">Qtd</th><th className="text-right">Faturamento</th>{podeFinanceiro && <><th className="text-right">Custo</th><th className="text-right">Lucro</th></>}<th className="text-right">Ticket</th></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.nome} className="border-b">
                  <td className="py-1.5">{r.nome}</td>
                  <td>{r.categoria}</td>
                  <td className="text-right">{num(r.qtd)}</td>
                  <td className="text-right">{brl(r.faturamento)}</td>
                  {podeFinanceiro && <><td className="text-right">{brl(r.custo)}</td><td className="text-right text-emerald-600">{brl(r.lucro)}</td></>}
                  <td className="text-right">{brl(r.ticket)}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Nenhum produto vendido no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------- CLIENTES -------- */
function ClientesTab({ ini, fim, label }: any) {
  const { data: pedidos = [] } = useQuery({
    queryKey: ["rel-cli", ini.toISOString(), fim.toISOString()],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos")
        .select("id,total,valor_pago,status_pagamento,status_pedido,data_hora,cliente:clientes(id,nome,telefone,quem_indicou)")
        .gte("data_hora", ini.toISOString()).lte("data_hora", fim.toISOString())
        .neq("status_pedido", "cancelado");
      return data ?? [];
    },
  });
  const map = new Map<string, { id: string; nome: string; telefone: string; quem_indicou: string | null; qtd: number; total: number; ultima: string }>();
  pedidos.forEach((p: any) => {
    if (!p.cliente) return;
    const cur = map.get(p.cliente.id) ?? { id: p.cliente.id, nome: p.cliente.nome, telefone: p.cliente.telefone, quem_indicou: p.cliente.quem_indicou, qtd: 0, total: 0, ultima: p.data_hora };
    cur.qtd += 1;
    const recebido = p.status_pagamento === "pago" ? Number(p.total) : Number(p.valor_pago || 0);
    cur.total += recebido;
    if (p.data_hora > cur.ultima) cur.ultima = p.data_hora;
    map.set(p.cliente.id, cur);
  });
  const list = Array.from(map.values()).map((c) => ({ ...c, ticket: c.qtd ? c.total / c.qtd : 0 })).sort((a, b) => b.total - a.total);

  const rows = list.map((c) => ({ cliente: c.nome, telefone: c.telefone ?? "", compras: c.qtd, total_gasto: c.total.toFixed(2), ticket: c.ticket.toFixed(2), ultima: format(new Date(c.ultima), "dd/MM/yyyy"), quem_indicou: c.quem_indicou ?? "" }));
  const tableHtml = `<table><thead><tr><th>Cliente</th><th>Telefone</th><th>Compras</th><th>Total</th><th>Ticket</th><th>Última</th></tr></thead><tbody>${list.map(c => `<tr><td>${c.nome}</td><td>${c.telefone ?? ""}</td><td>${c.qtd}</td><td>${brl(c.total)}</td><td>${brl(c.ticket)}</td><td>${format(new Date(c.ultima), "dd/MM/yyyy")}</td></tr>`).join("")}</tbody></table>`;

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Clientes ativos no período" value={num(list.length)} accent="primary" />
        <Kpi label="Total faturado por clientes" value={brl(list.reduce((s, c) => s + c.total, 0))} accent="success" />
        <Kpi label="Ticket médio" value={brl(list.length ? list.reduce((s, c) => s + c.total, 0) / list.reduce((s, c) => s + c.qtd, 0) : 0)} />
        <Kpi label="Compras totais" value={num(list.reduce((s, c) => s + c.qtd, 0))} />
      </div>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Clientes</div>
          <ToolbarExport filename="clientes.csv" rows={rows} titulo="Relatório de Clientes" periodoLabel={label} tableHtml={tableHtml} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">Cliente</th><th className="text-left">Telefone</th><th className="text-right">Compras</th><th className="text-right">Total</th><th className="text-right">Ticket</th><th className="text-left">Última</th><th></th></tr></thead>
            <tbody>
              {list.map((c) => (
                <tr key={c.id} className="border-b">
                  <td className="py-1.5">{c.nome}</td>
                  <td>{c.telefone ?? "—"}</td>
                  <td className="text-right">{num(c.qtd)}</td>
                  <td className="text-right">{brl(c.total)}</td>
                  <td className="text-right">{brl(c.ticket)}</td>
                  <td>{format(new Date(c.ultima), "dd/MM/yyyy")}</td>
                  <td>{c.telefone && <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="text-emerald-600"><MessageCircle className="size-4" /></a>}</td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={7} className="text-center py-6 text-muted-foreground">Sem clientes no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------- ESTOQUE -------- */
function EstoqueTab({ ini, fim, label }: any) {
  const { data: itens = [] } = useQuery({
    queryKey: ["rel-est"],
    queryFn: async () => (await supabase.from("estoque_itens").select("*").order("nome")).data ?? [],
  });
  const { data: movs = [] } = useQuery({
    queryKey: ["rel-est-mov", ini.toISOString(), fim.toISOString()],
    queryFn: async () => (await supabase.from("estoque_movimentacoes")
      .select("*,item:estoque_itens(nome,unidade_medida)")
      .gte("created_at", ini.toISOString()).lte("created_at", fim.toISOString())
      .order("created_at", { ascending: false })).data ?? [],
  });
  const baixos = itens.filter((i: any) => Number(i.quantidade_atual) > 0 && Number(i.quantidade_atual) <= Number(i.estoque_minimo || 0));
  const zerados = itens.filter((i: any) => Number(i.quantidade_atual) <= 0);
  const vencidos = itens.filter((i: any) => i.validade && new Date(i.validade) < new Date());
  const proxVenc = itens.filter((i: any) => {
    if (!i.validade) return false;
    const d = (new Date(i.validade).getTime() - Date.now()) / 86400000;
    return d >= 0 && d <= (i.alerta_vencimento_dias || 7);
  });

  const rowsItens = itens.map((i: any) => ({ item: i.nome, categoria: i.categoria ?? "", qtd: i.quantidade_atual, unidade: i.unidade_medida, minimo: i.estoque_minimo, custo: i.custo_unitario, validade: i.validade ?? "" }));
  const tableHtml = `<table><thead><tr><th>Item</th><th>Categoria</th><th>Qtd</th><th>Unidade</th><th>Mínimo</th><th>Validade</th></tr></thead><tbody>${itens.map((i: any) => `<tr><td>${i.nome}</td><td>${i.categoria ?? ""}</td><td>${i.quantidade_atual}</td><td>${i.unidade_medida}</td><td>${i.estoque_minimo}</td><td>${i.validade ?? ""}</td></tr>`).join("")}</tbody></table>`;

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Itens cadastrados" value={num(itens.length)} />
        <Kpi label="Abaixo do mínimo" value={num(baixos.length)} accent="warn" />
        <Kpi label="Zerados" value={num(zerados.length)} accent="danger" />
        <Kpi label="Próx. vencimento" value={num(proxVenc.length)} accent="warn" />
        <Kpi label="Vencidos" value={num(vencidos.length)} accent="danger" />
        <Kpi label="Movimentações no período" value={num(movs.length)} />
      </div>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Estoque atual</div>
          <ToolbarExport filename="estoque.csv" rows={rowsItens} titulo="Relatório de Estoque" periodoLabel={label} tableHtml={tableHtml} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">Item</th><th className="text-left">Categoria</th><th className="text-right">Qtd</th><th className="text-left">Un.</th><th className="text-right">Mínimo</th><th className="text-left">Validade</th><th className="text-left">Status</th></tr></thead>
            <tbody>
              {itens.map((i: any) => {
                const z = Number(i.quantidade_atual) <= 0;
                const b = !z && Number(i.quantidade_atual) <= Number(i.estoque_minimo || 0);
                return (
                  <tr key={i.id} className="border-b">
                    <td className="py-1.5">{i.nome}</td>
                    <td>{i.categoria ?? "—"}</td>
                    <td className={`text-right ${z ? "text-red-600 font-semibold" : b ? "text-amber-600" : ""}`}>{num(i.quantidade_atual)}</td>
                    <td>{i.unidade_medida}</td>
                    <td className="text-right">{num(i.estoque_minimo)}</td>
                    <td>{i.validade ?? "—"}</td>
                    <td>{z ? <Badge variant="destructive">Zerado</Badge> : b ? <Badge variant="outline" className="text-amber-700 border-amber-400">Baixo</Badge> : <Badge variant="outline">OK</Badge>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <Card className="p-3">
        <div className="text-sm font-semibold mb-2">Últimas movimentações</div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">Data</th><th className="text-left">Item</th><th className="text-left">Tipo</th><th className="text-right">Qtd</th><th className="text-left">Motivo</th></tr></thead>
            <tbody>
              {movs.slice(0, 50).map((m: any) => (
                <tr key={m.id} className="border-b">
                  <td className="py-1.5">{format(new Date(m.created_at), "dd/MM HH:mm")}</td>
                  <td>{m.item?.nome ?? "—"}</td>
                  <td><Badge variant="outline" className="text-[10px]">{m.tipo_movimentacao ?? m.tipo}</Badge></td>
                  <td className={`text-right ${m.tipo === "entrada" ? "text-emerald-600" : "text-red-600"}`}>{m.tipo === "entrada" ? "+" : "-"}{num(m.quantidade)}</td>
                  <td className="truncate max-w-[200px]">{m.motivo ?? "—"}</td>
                </tr>
              ))}
              {!movs.length && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Sem movimentações.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------- CAIXA -------- */
function CaixaTab({ ini, fim, label }: any) {
  const { data: caixas = [] } = useQuery({
    queryKey: ["rel-caixa", ini.toISOString(), fim.toISOString()],
    queryFn: async () => (await supabase.from("caixas").select("*")
      .gte("aberto_em", ini.toISOString()).lte("aberto_em", fim.toISOString())
      .order("aberto_em", { ascending: false })).data ?? [],
  });
  const rows = caixas.map((c: any) => ({
    aberto_em: format(new Date(c.aberto_em), "dd/MM/yyyy HH:mm"),
    status: c.status, valor_inicial: c.valor_inicial,
    pix: c.total_pix, dinheiro: c.total_dinheiro, debito: c.total_debito, credito: c.total_credito,
    sangrias: c.total_sangrias, reforcos: c.total_reforcos,
    esperado: c.valor_dinheiro_esperado, informado: c.valor_dinheiro_informado, diferenca: c.diferenca,
  }));
  const tableHtml = `<table><thead><tr><th>Aberto</th><th>Status</th><th>Inicial</th><th>Pix</th><th>Dinheiro</th><th>Débito</th><th>Crédito</th><th>Diferença</th></tr></thead><tbody>${caixas.map((c: any) => `<tr><td>${format(new Date(c.aberto_em), "dd/MM/yyyy HH:mm")}</td><td>${c.status}</td><td>${brl(c.valor_inicial)}</td><td>${brl(c.total_pix)}</td><td>${brl(c.total_dinheiro)}</td><td>${brl(c.total_debito)}</td><td>${brl(c.total_credito)}</td><td>${brl(c.diferenca || 0)}</td></tr>`).join("")}</tbody></table>`;

  const totDif = caixas.reduce((s: number, c: any) => s + Number(c.diferenca || 0), 0);
  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Caixas no período" value={num(caixas.length)} />
        <Kpi label="Divergentes" value={num(caixas.filter((c: any) => c.status === "divergente").length)} accent="warn" />
        <Kpi label="Diferença total" value={brl(totDif)} accent={Math.abs(totDif) < 0.01 ? "success" : "danger"} />
        <Kpi label="Abertos agora" value={num(caixas.filter((c: any) => c.status === "aberto").length)} accent="primary" />
      </div>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Caixas</div>
          <ToolbarExport filename="caixa.csv" rows={rows} titulo="Relatório de Caixa" periodoLabel={label} tableHtml={tableHtml} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">Aberto</th><th className="text-left">Status</th><th className="text-right">Inicial</th><th className="text-right">Pix</th><th className="text-right">Dinheiro</th><th className="text-right">Débito</th><th className="text-right">Crédito</th><th className="text-right">Sangrias</th><th className="text-right">Diferença</th></tr></thead>
            <tbody>
              {caixas.map((c: any) => (
                <tr key={c.id} className="border-b">
                  <td className="py-1.5">{format(new Date(c.aberto_em), "dd/MM HH:mm")}</td>
                  <td><Badge variant="outline" className="text-[10px]">{c.status}</Badge></td>
                  <td className="text-right">{brl(c.valor_inicial)}</td>
                  <td className="text-right">{brl(c.total_pix)}</td>
                  <td className="text-right">{brl(c.total_dinheiro)}</td>
                  <td className="text-right">{brl(c.total_debito)}</td>
                  <td className="text-right">{brl(c.total_credito)}</td>
                  <td className="text-right">{brl(c.total_sangrias)}</td>
                  <td className={`text-right ${Math.abs(Number(c.diferenca || 0)) > 0.01 ? "text-red-600" : ""}`}>{brl(c.diferenca || 0)}</td>
                </tr>
              ))}
              {!caixas.length && <tr><td colSpan={9} className="text-center py-6 text-muted-foreground">Nenhum caixa no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------- COZINHA -------- */
function CozinhaTab({ ini, fim, label }: any) {
  const { data: itens = [] } = useQuery({
    queryKey: ["rel-cozinha", ini.toISOString(), fim.toISOString()],
    queryFn: async () => (await supabase.from("pedido_itens")
      .select("id,nome_produto,quantidade,status_preparo,enviado_cozinha_em,preparo_iniciado_em,pronto_em,entregue_em,observacoes_cozinha,pedido:pedidos!inner(numero,data_hora,cliente:clientes(nome))")
      .eq("envia_para_cozinha", true)
      .gte("pedido.data_hora", ini.toISOString())
      .lte("pedido.data_hora", fim.toISOString())
      .order("enviado_cozinha_em", { ascending: false })).data ?? [],
  });
  const enviados = itens.filter((i: any) => i.enviado_cozinha_em);
  const prontos = itens.filter((i: any) => i.pronto_em);
  const entregues = itens.filter((i: any) => i.entregue_em);
  const cancelados = itens.filter((i: any) => i.status_preparo === "cancelado");
  const temposPreparo = itens
    .filter((i: any) => i.enviado_cozinha_em && i.pronto_em)
    .map((i: any) => (new Date(i.pronto_em).getTime() - new Date(i.enviado_cozinha_em).getTime()) / 60000);
  const tempoMedio = temposPreparo.length ? temposPreparo.reduce((a: number, b: number) => a + b, 0) / temposPreparo.length : 0;

  const rows = itens.map((i: any) => ({
    comanda: i.pedido?.numero, cliente: i.pedido?.cliente?.nome ?? "—", produto: i.nome_produto, qtd: i.quantidade,
    enviado: i.enviado_cozinha_em ? format(new Date(i.enviado_cozinha_em), "dd/MM HH:mm") : "",
    iniciado: i.preparo_iniciado_em ? format(new Date(i.preparo_iniciado_em), "HH:mm") : "",
    pronto: i.pronto_em ? format(new Date(i.pronto_em), "HH:mm") : "",
    entregue: i.entregue_em ? format(new Date(i.entregue_em), "HH:mm") : "",
    status: i.status_preparo,
  }));
  const tableHtml = `<table><thead><tr><th>Comanda</th><th>Produto</th><th>Qtd</th><th>Enviado</th><th>Pronto</th><th>Entregue</th><th>Status</th></tr></thead><tbody>${rows.map((r: any) => `<tr><td>#${r.comanda}</td><td>${r.produto}</td><td>${r.qtd}</td><td>${r.enviado}</td><td>${r.pronto}</td><td>${r.entregue}</td><td>${r.status}</td></tr>`).join("")}</tbody></table>`;

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Itens enviados" value={num(enviados.length)} accent="primary" />
        <Kpi label="Prontos" value={num(prontos.length)} accent="success" />
        <Kpi label="Entregues" value={num(entregues.length)} accent="success" />
        <Kpi label="Cancelados" value={num(cancelados.length)} accent="danger" />
        <Kpi label="Tempo médio (min)" value={tempoMedio.toFixed(1)} />
      </div>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Itens da cozinha</div>
          <ToolbarExport filename="cozinha.csv" rows={rows} titulo="Relatório da Cozinha" periodoLabel={label} tableHtml={tableHtml} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">Comanda</th><th className="text-left">Cliente</th><th className="text-left">Produto</th><th className="text-right">Qtd</th><th className="text-left">Enviado</th><th className="text-left">Pronto</th><th className="text-left">Entregue</th><th className="text-left">Status</th></tr></thead>
            <tbody>
              {itens.map((i: any) => (
                <tr key={i.id} className="border-b">
                  <td className="py-1.5">#{i.pedido?.numero}</td>
                  <td className="truncate max-w-[100px]">{i.pedido?.cliente?.nome ?? "—"}</td>
                  <td>{i.nome_produto}</td>
                  <td className="text-right">{num(i.quantidade)}</td>
                  <td>{i.enviado_cozinha_em ? format(new Date(i.enviado_cozinha_em), "dd/MM HH:mm") : "—"}</td>
                  <td>{i.pronto_em ? format(new Date(i.pronto_em), "HH:mm") : "—"}</td>
                  <td>{i.entregue_em ? format(new Date(i.entregue_em), "HH:mm") : "—"}</td>
                  <td><Badge variant="outline" className="text-[10px]">{i.status_preparo}</Badge></td>
                </tr>
              ))}
              {!itens.length && <tr><td colSpan={8} className="text-center py-6 text-muted-foreground">Sem itens.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}

/* -------- CANCELAMENTOS / CORTESIAS / PERDAS -------- */
function CancelamentosTab({ ini, fim, label }: any) {
  const { data: pedidosCanc = [] } = useQuery({
    queryKey: ["rel-canc-ped", ini.toISOString(), fim.toISOString()],
    queryFn: async () => (await supabase.from("pedidos")
      .select("id,numero,total,motivo_cancelamento,cancelado_em,cliente:clientes(nome)")
      .eq("status_pedido", "cancelado")
      .gte("cancelado_em", ini.toISOString()).lte("cancelado_em", fim.toISOString())).data ?? [],
  });
  const { data: itensCanc = [] } = useQuery({
    queryKey: ["rel-canc-it", ini.toISOString(), fim.toISOString()],
    queryFn: async () => (await supabase.from("pedido_itens")
      .select("id,nome_produto,quantidade,subtotal,motivo_cancelamento,cancelado_em,pedido:pedidos!inner(numero,data_hora)")
      .eq("status_preparo", "cancelado")
      .gte("cancelado_em", ini.toISOString()).lte("cancelado_em", fim.toISOString())).data ?? [],
  });
  const { data: perdas = [] } = useQuery({
    queryKey: ["rel-perdas", ini.toISOString(), fim.toISOString()],
    queryFn: async () => (await supabase.from("estoque_movimentacoes")
      .select("id,quantidade,motivo,tipo_movimentacao,created_at,item:estoque_itens(nome,custo_unitario)")
      .in("tipo_movimentacao", ["perda", "vencimento"])
      .gte("created_at", ini.toISOString()).lte("created_at", fim.toISOString())).data ?? [],
  });
  const valorCanc = pedidosCanc.reduce((s: number, p: any) => s + Number(p.total), 0);
  const valorItensCanc = itensCanc.reduce((s: number, i: any) => s + Number(i.subtotal), 0);
  const valorPerdas = perdas.reduce((s: number, p: any) => s + Number(p.quantidade) * Number(p.item?.custo_unitario || 0), 0);

  const rows = [
    ...pedidosCanc.map((p: any) => ({ tipo: "Comanda cancelada", referencia: `#${p.numero}`, cliente: p.cliente?.nome ?? "—", valor: Number(p.total).toFixed(2), motivo: p.motivo_cancelamento ?? "", data: format(new Date(p.cancelado_em), "dd/MM/yyyy HH:mm") })),
    ...itensCanc.map((i: any) => ({ tipo: "Item cancelado", referencia: i.nome_produto, cliente: `#${i.pedido?.numero}`, valor: Number(i.subtotal).toFixed(2), motivo: i.motivo_cancelamento ?? "", data: i.cancelado_em ? format(new Date(i.cancelado_em), "dd/MM/yyyy HH:mm") : "" })),
    ...perdas.map((p: any) => ({ tipo: p.tipo_movimentacao, referencia: p.item?.nome ?? "—", cliente: "", valor: (Number(p.quantidade) * Number(p.item?.custo_unitario || 0)).toFixed(2), motivo: p.motivo ?? "", data: format(new Date(p.created_at), "dd/MM/yyyy HH:mm") })),
  ];
  const tableHtml = `<table><thead><tr><th>Data</th><th>Tipo</th><th>Referência</th><th>Valor</th><th>Motivo</th></tr></thead><tbody>${rows.map(r => `<tr><td>${r.data}</td><td>${r.tipo}</td><td>${r.referencia}</td><td>${brl(+r.valor)}</td><td>${r.motivo}</td></tr>`).join("")}</tbody></table>`;

  return (
    <div className="space-y-3 mt-3">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
        <Kpi label="Comandas canceladas" value={num(pedidosCanc.length)} accent="danger" />
        <Kpi label="Itens cancelados" value={num(itensCanc.length)} accent="warn" />
        <Kpi label="Valor cancelado (comandas)" value={brl(valorCanc)} accent="danger" />
        <Kpi label="Valor cancelado (itens)" value={brl(valorItensCanc)} accent="warn" />
        <Kpi label="Perdas/Vencimentos" value={num(perdas.length)} accent="warn" />
        <Kpi label="Custo de perdas" value={brl(valorPerdas)} accent="danger" />
      </div>
      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <div className="text-sm font-semibold">Eventos</div>
          <ToolbarExport filename="cancelamentos.csv" rows={rows} titulo="Cancelamentos, Cortesias e Perdas" periodoLabel={label} tableHtml={tableHtml} />
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="text-muted-foreground"><tr className="border-b"><th className="text-left py-1.5">Data</th><th className="text-left">Tipo</th><th className="text-left">Referência</th><th className="text-left">Cliente</th><th className="text-right">Valor</th><th className="text-left">Motivo</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={i} className="border-b">
                  <td className="py-1.5">{r.data}</td>
                  <td><Badge variant="outline" className="text-[10px]">{r.tipo}</Badge></td>
                  <td>{r.referencia}</td>
                  <td>{r.cliente}</td>
                  <td className="text-right text-red-600">{brl(+r.valor)}</td>
                  <td className="truncate max-w-[200px]">{r.motivo}</td>
                </tr>
              ))}
              {!rows.length && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum evento no período.</td></tr>}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
