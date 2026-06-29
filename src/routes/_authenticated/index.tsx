import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl, num } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  ChefHat, Receipt, TrendingUp, Wallet, AlertTriangle, Sparkles, Users, Trophy,
  CreditCard, PiggyBank, ArrowDownCircle, ArrowUpCircle, Lock, Unlock,
} from "lucide-react";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, startOfDay, subDays } from "date-fns";
import { ptBR } from "date-fns/locale";
import { rangeFor, type Periodo } from "@/lib/relatorios";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Gestão FitLounge" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { perfil, podeFinanceiro } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const [custom, setCustom] = useState({ de: "", ate: "" });
  const { ini, fim, label } = rangeFor(periodo, custom);

  const { data: pedidos = [] } = useQuery({
    queryKey: ["dash-pedidos", periodo, custom.de, custom.ate],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id,numero,total,valor_pago,valor_pendente,custo_total,lucro_estimado,forma_pagamento,status_pedido,status_pagamento,status_comanda,data_hora,desconto")
        .gte("data_hora", ini.toISOString()).lte("data_hora", fim.toISOString());
      return data ?? [];
    },
  });

  const { data: lancs = [] } = useQuery({
    queryKey: ["dash-fin", periodo, custom.de, custom.ate],
    queryFn: async () => {
      const { data } = await supabase.from("financeiro_lancamentos").select("tipo,valor,forma_pagamento,categoria,status,data")
        .eq("status", "ativo")
        .gte("data", ini.toISOString().slice(0, 10)).lte("data", fim.toISOString().slice(0, 10));
      return data ?? [];
    },
  });

  const { data: caixa } = useQuery({
    queryKey: ["dash-caixa-aberto"],
    queryFn: async () => (await supabase.from("caixas").select("*").eq("status", "aberto").maybeSingle()).data,
  });

  const validos = pedidos.filter((p: any) => p.status_pedido !== "cancelado" && p.status_comanda !== "cancelada");
  const pagas = validos.filter((p: any) => p.status_pagamento === "pago");
  const parciais = validos.filter((p: any) => p.status_pagamento === "parcial");
  const pendentes = validos.filter((p: any) => p.status_pagamento === "pendente");
  const abertas = validos.filter((p: any) => ["aberta", "em_consumo"].includes(p.status_comanda));
  const aguardandoPag = validos.filter((p: any) => p.status_comanda === "aguardando_pagamento");
  const canceladas = pedidos.filter((p: any) => p.status_pedido === "cancelado" || p.status_comanda === "cancelada");

  const faturamento = pagas.reduce((s: number, p: any) => s + Number(p.total), 0) + parciais.reduce((s: number, p: any) => s + Number(p.valor_pago || 0), 0);
  const aReceber = pendentes.reduce((s: number, p: any) => s + Number(p.total), 0) + parciais.reduce((s: number, p: any) => s + Number(p.valor_pendente || 0), 0);
  const lucro = pagas.reduce((s: number, p: any) => s + Number(p.lucro_estimado), 0);
  const ticket = pagas.length ? pagas.reduce((s: number, p: any) => s + Number(p.total), 0) / pagas.length : 0;

  const entradas = lancs.filter((l: any) => l.tipo === "entrada").reduce((s: number, l: any) => s + Number(l.valor), 0);
  const saidas = lancs.filter((l: any) => l.tipo === "saida").reduce((s: number, l: any) => s + Number(l.valor), 0);
  const saldo = entradas - saidas;

  const formas = ["pix", "dinheiro", "debito", "credito"] as const;
  const porForma = formas.map((fp) => ({
    nome: fp.charAt(0).toUpperCase() + fp.slice(1),
    valor: lancs.filter((l: any) => l.tipo === "entrada" && l.forma_pagamento === fp).reduce((a: number, l: any) => a + Number(l.valor), 0),
  }));

  const { data: topProdutos = [] } = useQuery({
    queryKey: ["dash-top-prod"],
    queryFn: async () => (await supabase.from("vw_produtos_mais_vendidos").select("*").limit(7)).data ?? [],
  });
  const { data: topClientes = [] } = useQuery({
    queryKey: ["dash-top-cli"],
    queryFn: async () => (await supabase.from("vw_clientes_top").select("*").limit(6)).data ?? [],
  });
  const { data: alertas = [] } = useQuery({
    queryKey: ["dash-alertas"],
    queryFn: async () => (await supabase.from("vw_estoque_alertas").select("*").in("alerta", ["abaixo_minimo", "em_falta", "vencido", "proximo_vencimento"]).limit(8)).data ?? [],
  });

  // Cozinha: itens hoje
  const { data: cozItens = [] } = useQuery({
    queryKey: ["dash-cozinha"],
    queryFn: async () => {
      const hojeIni = startOfDay(new Date()).toISOString();
      const { data } = await supabase.from("pedido_itens")
        .select("id,status_preparo,enviado_cozinha_em,pronto_em,nome_produto,pedido:pedidos!inner(numero,data_hora)")
        .eq("envia_para_cozinha", true)
        .gte("pedido.data_hora", hojeIni)
        .order("enviado_cozinha_em", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const cozNovos = cozItens.filter((i: any) => i.status_preparo === "novo").length;
  const cozPreparo = cozItens.filter((i: any) => i.status_preparo === "em_preparo").length;
  const cozProntos = cozItens.filter((i: any) => i.status_preparo === "pronto").length;
  const cozTempos = cozItens.filter((i: any) => i.enviado_cozinha_em && i.pronto_em)
    .map((i: any) => (new Date(i.pronto_em).getTime() - new Date(i.enviado_cozinha_em).getTime()) / 60000);
  const cozTempoMedio = cozTempos.length ? cozTempos.reduce((a: number, b: number) => a + b, 0) / cozTempos.length : 0;

  // série diária últimos 14 dias
  const { data: serie = [] } = useQuery({
    queryKey: ["dash-serie"],
    queryFn: async () => {
      const ini14 = startOfDay(subDays(new Date(), 13));
      const { data } = await supabase.from("pedidos").select("data_hora,total,valor_pago,status_pagamento,status_pedido").gte("data_hora", ini14.toISOString());
      const dias: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) dias[format(subDays(new Date(), i), "dd/MM")] = 0;
      (data ?? []).forEach((p: any) => {
        if (p.status_pedido === "cancelado") return;
        const d = format(new Date(p.data_hora), "dd/MM");
        if (!(d in dias)) return;
        if (p.status_pagamento === "pago") dias[d] += Number(p.total);
        else if (p.status_pagamento === "parcial") dias[d] += Number(p.valor_pago || 0);
      });
      return Object.entries(dias).map(([dia, total]) => ({ dia, total }));
    },
  });

  const palette = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)", "var(--chart-5)"];

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-heading font-bold">Olá, {perfil?.nome?.split(" ")[0] ?? "equipe"} 👋</h1>
          <p className="text-sm text-muted-foreground">Visão da loja • {label} • {format(new Date(), "EEEE, dd 'de' MMMM", { locale: ptBR })}</p>
        </div>
        <div className="space-y-2">
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <TabsList className="flex flex-wrap h-auto">
              <TabsTrigger value="hoje">Hoje</TabsTrigger>
              <TabsTrigger value="ontem">Ontem</TabsTrigger>
              <TabsTrigger value="semana">Semana</TabsTrigger>
              <TabsTrigger value="mes">Mês</TabsTrigger>
              <TabsTrigger value="7d">7d</TabsTrigger>
              <TabsTrigger value="30d">30d</TabsTrigger>
              <TabsTrigger value="custom">Custom</TabsTrigger>
            </TabsList>
          </Tabs>
          {periodo === "custom" && (
            <div className="flex gap-2 items-end">
              <div><Label className="text-xs">De</Label><Input type="date" value={custom.de} onChange={(e) => setCustom({ ...custom, de: e.target.value })} /></div>
              <div><Label className="text-xs">Até</Label><Input type="date" value={custom.ate} onChange={(e) => setCustom({ ...custom, ate: e.target.value })} /></div>
            </div>
          )}
        </div>
      </div>

      {/* KPIs principais */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Kpi title="Faturamento confirmado" value={brl(faturamento)} icon={TrendingUp} accent="primary" />
        <Kpi title="A receber" value={brl(aReceber)} icon={Wallet} accent="warning" />
        <Kpi title="Ticket médio" value={brl(ticket)} icon={Receipt} accent="success" />
        {podeFinanceiro ? (
          <Kpi title="Lucro estimado" value={brl(lucro)} icon={PiggyBank} accent="gold" />
        ) : (
          <Kpi title="Comandas pagas" value={num(pagas.length)} icon={Receipt} accent="gold" />
        )}
      </div>

      {/* KPIs financeiros */}
      {podeFinanceiro && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Kpi title="Entradas (lançadas)" value={brl(entradas)} icon={ArrowUpCircle} accent="success" />
          <Kpi title="Saídas" value={brl(saidas)} icon={ArrowDownCircle} accent="danger" />
          <Kpi title="Saldo do período" value={brl(saldo)} icon={Wallet} accent={saldo >= 0 ? "primary" : "danger"} />
          <Kpi
            title={caixa ? "Caixa aberto" : "Caixa fechado"}
            value={caixa ? brl(Number(caixa.valor_inicial) + Number(caixa.total_dinheiro) + Number(caixa.total_reforcos) - Number(caixa.total_sangrias) - Number(caixa.total_saidas)) : "—"}
            icon={caixa ? Unlock : Lock}
            accent={caixa ? "success" : "warning"}
          />
        </div>
      )}

      {/* Comandas — visão operacional */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <MiniStat label="Abertas" value={abertas.length} accent="primary" />
        <MiniStat label="Aguardando pagto" value={aguardandoPag.length} accent="warning" />
        <MiniStat label="Pagas" value={pagas.length} accent="success" />
        <MiniStat label="Parciais" value={parciais.length} accent="warning" />
        <MiniStat label="Canceladas" value={canceladas.length} accent="danger" />
      </div>

      {/* Formas de pagamento (cards) */}
      {podeFinanceiro && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {porForma.map((f) => (
            <Card key={f.nome}>
              <CardContent className="p-4 flex items-center gap-3">
                <CreditCard className="size-5 text-primary" />
                <div className="min-w-0">
                  <div className="text-xs uppercase text-muted-foreground">{f.nome}</div>
                  <div className="text-lg font-bold truncate">{brl(f.valor)}</div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Vendas dia + Forma pgto pie */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader><CardTitle className="font-heading text-lg">Vendas confirmadas por dia (últimos 14)</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="dia" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" tickFormatter={(v) => `R$${v}`} />
                <Tooltip formatter={(v: any) => brl(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Line type="monotone" dataKey="total" stroke="var(--chart-1)" strokeWidth={2.5} dot={{ r: 3 }} />
              </LineChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-heading text-lg">Forma de pagamento</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porForma.filter((f) => f.valor > 0)} dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {porForma.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
                </Pie>
                <Tooltip formatter={(v: any) => brl(Number(v))} contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Legend wrapperStyle={{ fontSize: 12 }} />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>

      {/* Mais vendidos + Top clientes */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><Trophy className="size-5 text-gold" /> Produtos mais vendidos</CardTitle></CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topProdutos.map((p: any) => ({ nome: (p.nome_produto ?? "?").slice(0, 18), qtd: Number(p.qtd_vendida) }))} layout="vertical" margin={{ left: 10, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis type="number" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" />
                <YAxis dataKey="nome" type="category" tick={{ fontSize: 11 }} stroke="var(--muted-foreground)" width={100} />
                <Tooltip contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }} />
                <Bar dataKey="qtd" fill="var(--chart-2)" radius={[0, 6, 6, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><Users className="size-5 text-primary" /> Clientes que mais compram</CardTitle></CardHeader>
          <CardContent>
            {!topClientes.length ? <Empty>Sem dados ainda.</Empty> : (
              <ul className="divide-y divide-border">
                {topClientes.map((c: any) => (
                  <li key={c.id} className="py-2.5 flex items-center gap-3">
                    <div className="size-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-semibold text-sm">{(c.nome ?? "?").slice(0, 1).toUpperCase()}</div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.nome}</div>
                      <div className="text-xs text-muted-foreground">{num(c.qtd_pedidos)} pedidos</div>
                    </div>
                    <div className="text-sm font-semibold text-primary">{brl(c.total_gasto)}</div>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Cozinha + Estoque */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><ChefHat className="size-5 text-warning" /> Cozinha hoje</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-3 gap-2 mb-3">
              <MiniStat label="Novos" value={cozNovos} accent="primary" />
              <MiniStat label="Em preparo" value={cozPreparo} accent="warning" />
              <MiniStat label="Prontos" value={cozProntos} accent="success" />
            </div>
            <div className="text-xs text-muted-foreground mb-2">Tempo médio de preparo: <b>{cozTempoMedio.toFixed(1)} min</b></div>
            <ul className="space-y-1.5 max-h-44 overflow-auto">
              {cozItens.slice(0, 6).map((i: any) => (
                <li key={i.id} className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-2.5 py-1.5">
                  <span className="truncate">#{i.pedido?.numero} • {i.nome_produto}</span>
                  <Badge variant="outline" className="text-[10px]">{i.status_preparo}</Badge>
                </li>
              ))}
              {!cozItens.length && <li className="text-sm text-muted-foreground py-2 text-center">Sem itens na cozinha.</li>}
            </ul>
            <Link to="/cozinha" className="block text-xs text-primary hover:underline mt-2 text-right">Abrir cozinha →</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><AlertTriangle className="size-5 text-destructive" /> Alertas de estoque</CardTitle></CardHeader>
          <CardContent>
            {!alertas.length ? <Empty>Tudo certo no estoque.</Empty> : (
              <ul className="space-y-2">
                {alertas.map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 gap-2">
                    <span className="font-medium text-sm truncate">{a.nome}</span>
                    <AlertaBadge tipo={a.alerta} />
                  </li>
                ))}
              </ul>
            )}
            <Link to="/estoque" className="block text-xs text-primary hover:underline mt-2 text-right">Abrir estoque →</Link>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="font-heading text-lg flex items-center gap-2"><Sparkles className="size-5 text-gold" /> Comandas abertas</CardTitle></CardHeader>
          <CardContent>
            {!abertas.length && !aguardandoPag.length ? <Empty>Nenhuma comanda aberta.</Empty> : (
              <ul className="space-y-1.5 max-h-44 overflow-auto">
                {[...abertas, ...aguardandoPag].slice(0, 8).map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between text-sm rounded-md bg-muted/50 px-2.5 py-1.5">
                    <span>#{p.numero}</span>
                    <span className="flex items-center gap-2">
                      <Badge variant="outline" className="text-[10px]">{p.status_comanda}</Badge>
                      <span className="font-semibold">{brl(p.total)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link to="/pedidos" className="block text-xs text-primary hover:underline mt-2 text-right">Ver comandas →</Link>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon: Icon, accent }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: "primary" | "gold" | "success" | "warning" | "danger" }) {
  const map: Record<string, string> = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold",
    success: "bg-emerald-500/15 text-emerald-600",
    warning: "bg-amber-500/15 text-amber-600",
    danger: "bg-red-500/15 text-red-600",
  };
  return (
    <Card>
      <CardContent className="p-4 md:p-5 flex items-center gap-4">
        <div className={`size-11 rounded-xl flex items-center justify-center ${map[accent]}`}><Icon className="size-5" /></div>
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wide text-muted-foreground">{title}</div>
          <div className="text-xl md:text-2xl font-heading font-bold leading-tight truncate">{value}</div>
        </div>
      </CardContent>
    </Card>
  );
}

function MiniStat({ label, value, accent }: { label: string; value: number; accent: "primary" | "success" | "warning" | "danger" }) {
  const cls: Record<string, string> = {
    primary: "text-primary", success: "text-emerald-600", warning: "text-amber-600", danger: "text-red-600",
  };
  return (
    <Card>
      <CardContent className="p-3 text-center">
        <div className={`text-2xl font-heading font-bold ${cls[accent]}`}>{num(value)}</div>
        <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      </CardContent>
    </Card>
  );
}

function AlertaBadge({ tipo }: { tipo: string }) {
  const cfg: Record<string, { label: string; cls: string }> = {
    vencido: { label: "Vencido", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    em_falta: { label: "Em falta", cls: "bg-destructive/15 text-destructive border-destructive/30" },
    proximo_vencimento: { label: "Próx. vencimento", cls: "bg-warning/20 text-warning-foreground border-warning/40" },
    abaixo_minimo: { label: "Abaixo do mínimo", cls: "bg-warning/15 text-warning-foreground border-warning/30" },
  };
  const c = cfg[tipo] ?? { label: tipo, cls: "" };
  return <Badge variant="outline" className={c.cls + " text-[10px] uppercase"}>{c.label}</Badge>;
}

function Empty({ children }: { children: React.ReactNode }) {
  return <div className="text-sm text-muted-foreground py-6 text-center">{children}</div>;
}
