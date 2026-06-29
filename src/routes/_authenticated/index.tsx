import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { brl, num } from "@/lib/format";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChefHat, Receipt, TrendingUp, Wallet, AlertTriangle, Sparkles, Users, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import {
  Bar, BarChart, CartesianGrid, Cell, Legend, Line, LineChart, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from "recharts";
import { format, startOfDay, startOfMonth, startOfWeek, subDays, endOfDay } from "date-fns";
import { ptBR } from "date-fns/locale";

export const Route = createFileRoute("/_authenticated/")({
  head: () => ({ meta: [{ title: "Dashboard — Gestão FitLounge" }] }),
  component: Dashboard,
});

type Periodo = "hoje" | "ontem" | "semana" | "mes";

function rangeFor(p: Periodo): { ini: Date; fim: Date; label: string } {
  const now = new Date();
  if (p === "hoje") return { ini: startOfDay(now), fim: endOfDay(now), label: "Hoje" };
  if (p === "ontem") { const y = subDays(now, 1); return { ini: startOfDay(y), fim: endOfDay(y), label: "Ontem" }; }
  if (p === "semana") return { ini: startOfWeek(now, { weekStartsOn: 1 }), fim: endOfDay(now), label: "Esta semana" };
  return { ini: startOfMonth(now), fim: endOfDay(now), label: "Este mês" };
}

function Dashboard() {
  const { perfil, podeFinanceiro } = useAuth();
  const [periodo, setPeriodo] = useState<Periodo>("hoje");
  const { ini, fim, label } = rangeFor(periodo);

  const { data: pedidos } = useQuery({
    queryKey: ["dash-pedidos", periodo],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("pedidos")
        .select("id,total,custo_total,lucro_estimado,forma_pagamento,status_pedido,status_pagamento,data_hora")
        .gte("data_hora", ini.toISOString())
        .lte("data_hora", fim.toISOString());
      if (error) throw error;
      return data ?? [];
    },
  });

  const validos = (pedidos ?? []).filter((p: any) => p.status_pedido !== "cancelado");
  const pagas = validos.filter((p: any) => p.status_pagamento === "pago");
  const pendentes = validos.filter((p: any) => p.status_pagamento === "pendente");
  const faturamento = pagas.reduce((acc: number, p: any) => acc + Number(p.total), 0);
  const aReceber = pendentes.reduce((acc: number, p: any) => acc + Number(p.total), 0);
  const lucro = pagas.reduce((acc: number, p: any) => acc + Number(p.lucro_estimado), 0);
  const ticket = pagas.length ? faturamento / pagas.length : 0;

  const porPagamento = ["pix", "dinheiro", "debito", "credito"].map((fp) => ({
    nome: fp.charAt(0).toUpperCase() + fp.slice(1),
    valor: pagas.filter((p: any) => p.forma_pagamento === fp).reduce((a: number, p: any) => a + Number(p.total), 0),
  }));

  const { data: topProdutos } = useQuery({
    queryKey: ["dash-top-prod"],
    queryFn: async () => {
      const { data } = await supabase.from("vw_produtos_mais_vendidos").select("*").limit(7);
      return data ?? [];
    },
  });

  const { data: topClientes } = useQuery({
    queryKey: ["dash-top-cli"],
    queryFn: async () => {
      const { data } = await supabase.from("vw_clientes_top").select("*").limit(6);
      return data ?? [];
    },
  });

  const { data: alertas } = useQuery({
    queryKey: ["dash-alertas"],
    queryFn: async () => {
      const { data } = await supabase.from("vw_estoque_alertas").select("*").in("alerta", ["abaixo_minimo", "em_falta", "vencido", "proximo_vencimento"]).limit(8);
      return data ?? [];
    },
  });

  const { data: emPreparo } = useQuery({
    queryKey: ["dash-em-preparo"],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos").select("id,numero,data_hora").eq("status_pedido", "em_preparo").order("data_hora", { ascending: true }).limit(8);
      return data ?? [];
    },
  });

  const { data: slimPendentes } = useQuery({
    queryKey: ["dash-slim-pendentes"],
    queryFn: async () => {
      const { data } = await supabase.from("meu_slim_vendas").select("id,nome_cliente,tipo_kit,data_prevista_entrega,status_entrega").in("status_entrega", ["pendente", "em_producao"]).order("data_prevista_entrega", { ascending: true }).limit(6);
      return data ?? [];
    },
  });

  // série diária últimos 14 dias
  const { data: serie } = useQuery({
    queryKey: ["dash-serie"],
    queryFn: async () => {
      const ini14 = startOfDay(subDays(new Date(), 13));
      const { data } = await supabase.from("pedidos").select("data_hora,total,status_pedido").gte("data_hora", ini14.toISOString());
      const dias: Record<string, number> = {};
      for (let i = 13; i >= 0; i--) {
        const d = format(subDays(new Date(), i), "dd/MM");
        dias[d] = 0;
      }
      (data ?? []).forEach((p: any) => {
        if (p.status_pedido === "cancelado") return;
        const d = format(new Date(p.data_hora), "dd/MM");
        if (d in dias) dias[d] += Number(p.total);
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
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList>
            <TabsTrigger value="hoje">Hoje</TabsTrigger>
            <TabsTrigger value="ontem">Ontem</TabsTrigger>
            <TabsTrigger value="semana">Semana</TabsTrigger>
            <TabsTrigger value="mes">Mês</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
        <Kpi title="Faturamento (pago)" value={brl(faturamento)} icon={TrendingUp} accent="primary" />
        <Kpi title="A receber" value={brl(aReceber)} icon={Wallet} accent="warning" />
        <Kpi title="Vendas pagas" value={num(pagas.length)} icon={Receipt} accent="gold" />
        {podeFinanceiro ? (
          <Kpi title="Lucro estimado" value={brl(lucro)} icon={TrendingUp} accent="gold" />
        ) : (
          <Kpi title="Ticket médio" value={brl(ticket)} icon={Wallet} accent="success" />
        )}
      </div>

      {/* Formas de pagamento + Vendas dia */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="font-heading text-lg">Vendas por dia (últimos 14)</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={serie ?? []} margin={{ top: 8, right: 8, bottom: 0, left: -10 }}>
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
          <CardHeader>
            <CardTitle className="font-heading text-lg">Forma de pagamento</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={porPagamento} dataKey="valor" nameKey="nome" innerRadius={45} outerRadius={80} paddingAngle={3}>
                  {porPagamento.map((_, i) => <Cell key={i} fill={palette[i % palette.length]} />)}
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
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2"><Trophy className="size-5 text-gold" /> Produtos mais vendidos</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={(topProdutos ?? []).map((p: any) => ({ nome: (p.nome_produto ?? "?").slice(0, 18), qtd: Number(p.qtd_vendida) }))} layout="vertical" margin={{ left: 10, right: 16 }}>
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
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2"><Users className="size-5 text-primary" /> Clientes que mais compram</CardTitle>
          </CardHeader>
          <CardContent>
            {(topClientes ?? []).length === 0 ? (
              <Empty>Sem dados ainda. Registre pedidos para ver seu ranking.</Empty>
            ) : (
              <ul className="divide-y divide-border">
                {(topClientes ?? []).map((c: any) => (
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

      {/* Operacional: cozinha, estoque, slim */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2"><ChefHat className="size-5 text-warning" /> Em preparo</CardTitle>
          </CardHeader>
          <CardContent>
            {(emPreparo ?? []).length === 0 ? <Empty>Nenhum pedido em preparo.</Empty> : (
              <ul className="space-y-2">
                {(emPreparo ?? []).map((p: any) => (
                  <li key={p.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <span className="font-medium">Pedido #{p.numero}</span>
                    <span className="text-xs text-muted-foreground">{format(new Date(p.data_hora), "HH:mm")}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2"><AlertTriangle className="size-5 text-destructive" /> Alertas de estoque</CardTitle>
          </CardHeader>
          <CardContent>
            {(alertas ?? []).length === 0 ? <Empty>Tudo certo no estoque.</Empty> : (
              <ul className="space-y-2">
                {(alertas ?? []).map((a: any) => (
                  <li key={a.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2 gap-2">
                    <span className="font-medium text-sm truncate">{a.nome}</span>
                    <AlertaBadge tipo={a.alerta} />
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="font-heading text-lg flex items-center gap-2"><Sparkles className="size-5 text-gold" /> Kits Meu Slim pendentes</CardTitle>
          </CardHeader>
          <CardContent>
            {(slimPendentes ?? []).length === 0 ? <Empty>Nenhum kit pendente.</Empty> : (
              <ul className="space-y-2">
                {(slimPendentes ?? []).map((k: any) => (
                  <li key={k.id} className="flex items-center justify-between rounded-lg bg-muted/50 px-3 py-2">
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">{k.nome_cliente}</div>
                      <div className="text-xs text-muted-foreground">{k.tipo_kit}</div>
                    </div>
                    {k.data_prevista_entrega && <span className="text-xs text-muted-foreground">{format(new Date(k.data_prevista_entrega), "dd/MM")}</span>}
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Kpi({ title, value, icon: Icon, accent }: { title: string; value: string; icon: React.ComponentType<{ className?: string }>; accent: "primary" | "gold" | "success" | "warning" }) {
  const map = {
    primary: "bg-primary/10 text-primary",
    gold: "bg-gold/15 text-gold",
    success: "bg-success/15 text-success-foreground",
    warning: "bg-warning/15 text-warning-foreground",
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
