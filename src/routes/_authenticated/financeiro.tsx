import { createFileRoute, redirect } from "@tanstack/react-router";
import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import { Wallet, Plus, TrendingUp, TrendingDown, Ban, Undo2 } from "lucide-react";
import { startOfDay, endOfDay, startOfMonth, startOfWeek, subDays, startOfYear } from "date-fns";

export const Route = createFileRoute("/_authenticated/financeiro")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase.from("users_profiles").select("role,pode_ver_financeiro").eq("user_id", u.user.id).maybeSingle();
    if (!perfil || (perfil.role !== "admin" && !perfil.pode_ver_financeiro)) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Financeiro — FitLounge" }] }),
  component: FinanceiroPage,
});

type Periodo = "hoje" | "semana" | "mes" | "ano";
const CATEGORIAS_SAIDA = ["Compras de produtos","Mercado","Embalagens","Uber/entrega","Aluguel","Energia","Água","Internet","Taxas de cartão","Manutenção","Outros"];

function range(p: Periodo) {
  const n = new Date();
  if (p === "hoje") return { ini: startOfDay(n), fim: endOfDay(n) };
  if (p === "semana") return { ini: startOfWeek(n, { weekStartsOn: 1 }), fim: endOfDay(n) };
  if (p === "mes") return { ini: startOfMonth(n), fim: endOfDay(n) };
  return { ini: startOfYear(n), fim: endOfDay(n) };
}

function FinanceiroPage() {
  const qc = useQueryClient();
  const [periodo, setPeriodo] = useState<Periodo>("mes");
  const [novaSaida, setNovaSaida] = useState(false);
  const { ini, fim } = range(periodo);
  const { isAdmin } = useAuth();

  const { data: lancs = [] } = useQuery({
    queryKey: ["financ", periodo],
    queryFn: async () => {
      const { data } = await supabase.from("financeiro_lancamentos")
        .select("*").eq("status", "ativo")
        .gte("data", ini.toISOString().slice(0, 10))
        .lte("data", fim.toISOString().slice(0, 10))
        .order("data", { ascending: false });
      return data ?? [];
    },
  });

  const entradas = lancs.filter((l: any) => l.tipo === "entrada");
  const saidas = lancs.filter((l: any) => l.tipo === "saida");
  const totalE = entradas.reduce((s, l: any) => s + Number(l.valor), 0);
  const totalS = saidas.reduce((s, l: any) => s + Number(l.valor), 0);
  const liquido = totalE - totalS;

  const { data: pendentes = [] } = useQuery({
    queryKey: ["financ-pendentes"],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos")
        .select("id,numero,total,data_hora,cliente:clientes(nome)")
        .eq("status_pagamento", "pendente").not("status_pedido", "eq", "cancelado")
        .order("data_hora", { ascending: false });
      return data ?? [];
    },
  });
  const totalPendente = pendentes.reduce((s, p: any) => s + Number(p.total), 0);

  const porForma = useMemo(() => {
    const map: Record<string, number> = {};
    entradas.forEach((l: any) => { const k = l.forma_pagamento ?? "—"; map[k] = (map[k] || 0) + Number(l.valor); });
    return Object.entries(map);
  }, [entradas]);

  const porCatSaida = useMemo(() => {
    const map: Record<string, number> = {};
    saidas.forEach((l: any) => { map[l.categoria] = (map[l.categoria] || 0) + Number(l.valor); });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
  }, [saidas]);

  async function cancelar(id: string) {
    if (!isAdmin) return;
    const motivo = prompt("Motivo do cancelamento:");
    if (!motivo) return;
    const { error } = await supabase.rpc("cancelar_lancamento_financeiro", { _id: id, _motivo: motivo });
    if (error) toast.error(error.message);
    else { toast.success("Lançamento cancelado"); qc.invalidateQueries({ queryKey: ["financ"] }); }
  }
  async function estornar(id: string) {
    if (!isAdmin) return;
    const motivo = prompt("Motivo do estorno (gera lançamento reverso):");
    if (!motivo) return;
    const { error } = await supabase.rpc("estornar_lancamento", { _lancamento_id: id, _motivo: motivo });
    if (error) toast.error(error.message);
    else { toast.success("Lançamento estornado"); qc.invalidateQueries({ queryKey: ["financ"] }); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Wallet className="size-6 text-primary" /><h1 className="text-2xl font-heading font-bold">Financeiro</h1></div>
        <div className="flex gap-2">
          <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
            <TabsList><TabsTrigger value="hoje">Hoje</TabsTrigger><TabsTrigger value="semana">Semana</TabsTrigger><TabsTrigger value="mes">Mês</TabsTrigger><TabsTrigger value="ano">Ano</TabsTrigger></TabsList>
          </Tabs>
          <Button onClick={() => setNovaSaida(true)} variant="outline"><Plus className="size-4 mr-1" /> Despesa</Button>
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
        <Card className="p-4"><div className="flex items-center gap-2 text-green-600 mb-1"><TrendingUp className="size-4" /><span className="text-xs uppercase">Entradas</span></div><div className="text-2xl font-bold">{brl(totalE)}</div></Card>
        <Card className="p-4"><div className="flex items-center gap-2 text-red-600 mb-1"><TrendingDown className="size-4" /><span className="text-xs uppercase">Saídas</span></div><div className="text-2xl font-bold">{brl(totalS)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground mb-1">Lucro líquido</div><div className={`text-2xl font-bold ${liquido >= 0 ? "text-primary" : "text-red-600"}`}>{brl(liquido)}</div></Card>
        <Card className="p-4"><div className="text-xs uppercase text-muted-foreground mb-1">A receber (pendente)</div><div className="text-2xl font-bold text-amber-600">{brl(totalPendente)}</div><div className="text-xs text-muted-foreground">{pendentes.length} pedido(s)</div></Card>
      </div>

      <div className="grid lg:grid-cols-2 gap-4 mb-4">
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Entradas por forma de pagamento</div>
          <ul className="space-y-1.5 text-sm">
            {porForma.map(([k, v]) => <li key={k} className="flex justify-between"><span className="capitalize">{k}</span><span className="font-semibold">{brl(v)}</span></li>)}
            {porForma.length === 0 && <li className="text-muted-foreground">Sem entradas no período.</li>}
          </ul>
        </Card>
        <Card className="p-4">
          <div className="text-sm font-semibold mb-2">Despesas por categoria</div>
          <ul className="space-y-1.5 text-sm">
            {porCatSaida.map(([k, v]) => <li key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold">{brl(v)}</span></li>)}
            {porCatSaida.length === 0 && <li className="text-muted-foreground">Sem despesas no período.</li>}
          </ul>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          <div className="px-4 py-3 border-b border-border text-sm font-semibold">Lançamentos ({lancs.length})</div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                <tr><th className="text-left py-2 px-3">Data</th><th className="text-left">Descrição</th><th className="text-left">Categoria</th><th className="text-left">Forma</th><th className="text-right">Valor</th><th></th></tr>
              </thead>
              <tbody>
                {lancs.map((l: any) => (
                  <tr key={l.id} className="border-b border-border">
                    <td className="py-2 px-3">{new Date(l.data).toLocaleDateString("pt-BR")}</td>
                    <td>{l.descricao}</td>
                    <td className="text-muted-foreground">{l.categoria}</td>
                    <td className="capitalize text-muted-foreground">{l.forma_pagamento ?? "—"}</td>
                    <td className={`text-right font-semibold ${l.tipo === "entrada" ? "text-green-600" : "text-red-600"}`}>
                      {l.tipo === "entrada" ? "+" : "−"}{brl(l.valor)}
                    </td>
                    <td className="text-right pr-3 whitespace-nowrap">{isAdmin && (<>
                      <Button variant="ghost" size="icon" className="size-7" title="Cancelar lançamento" onClick={() => cancelar(l.id)}><Ban className="size-3.5 text-amber-600" /></Button>
                      <Button variant="ghost" size="icon" className="size-7" title="Estornar (gera reverso)" onClick={() => estornar(l.id)}><Undo2 className="size-3.5 text-red-600" /></Button>
                    </>)}</td>
                  </tr>
                ))}
                {lancs.length === 0 && <tr><td colSpan={6} className="text-center py-8 text-muted-foreground">Sem lançamentos.</td></tr>}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {pendentes.length > 0 && (
        <Card className="mt-4 p-4">
          <div className="text-sm font-semibold mb-2 flex items-center gap-2">A receber <Badge variant="outline">{pendentes.length}</Badge></div>
          <ul className="divide-y divide-border text-sm">
            {pendentes.slice(0, 12).map((p: any) => (
              <li key={p.id} className="py-2 flex justify-between">
                <span>#{p.numero} — {p.cliente?.nome ?? "Sem cliente"}</span>
                <span className="font-semibold text-amber-600">{brl(p.total)}</span>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {novaSaida && <SaidaDialog onClose={() => { setNovaSaida(false); qc.invalidateQueries({ queryKey: ["financ"] }); }} />}
    </>
  );
}

function SaidaDialog({ onClose }: { onClose: () => void }) {
  const { perfil } = useAuth();
  const { formasAtivas } = useConfigLoja();
  const formas = formasAtivas.length > 0 ? formasAtivas : (["pix","dinheiro","debito","credito"] as const);
  const [f, setF] = useState({
    descricao: "", categoria: CATEGORIAS_SAIDA[0], valor: 0,
    forma_pagamento: formas[0] as any, data: new Date().toISOString().slice(0, 10), observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  async function salvar() {
    if (!f.descricao.trim() || f.valor <= 0) { toast.error("Descrição e valor obrigatórios"); return; }
    setSaving(true);
    const { error } = await supabase.from("financeiro_lancamentos").insert({
      tipo: "saida", ...f, usuario_id: perfil?.id ?? null, status: "ativo",
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Despesa registrada"); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Nova despesa</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Descrição *</Label><Input value={f.descricao} onChange={e => setF({ ...f, descricao: e.target.value })} /></div>
          <div><Label>Categoria</Label><Select value={f.categoria} onValueChange={v => setF({ ...f, categoria: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{CATEGORIAS_SAIDA.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Valor *</Label><Input type="number" step="0.01" value={f.valor} onChange={e => setF({ ...f, valor: Number(e.target.value) })} /></div>
          <div><Label>Forma de pagamento</Label><Select value={f.forma_pagamento} onValueChange={v => setF({ ...f, forma_pagamento: v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{["pix","dinheiro","debito","credito"].map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Data</Label><Input type="date" value={f.data} onChange={e => setF({ ...f, data: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Observações</Label><Textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
