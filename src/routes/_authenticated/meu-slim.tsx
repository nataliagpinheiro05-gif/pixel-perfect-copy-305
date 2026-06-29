import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Sparkles, Plus, CheckCircle2 } from "lucide-react";

export const Route = createFileRoute("/_authenticated/meu-slim")({
  head: () => ({ meta: [{ title: "Meu Slim — FitLounge" }] }),
  component: MeuSlimPage,
});

const KITS = ["Kit 3 dias", "Kit 6 dias", "Kit personalizado"];
const FORMAS = ["pix","dinheiro","debito","credito"];
const STATUS_ENT = ["pendente","em_producao","entregue","cancelado"];

function MeuSlimPage() {
  const qc = useQueryClient();
  const [nova, setNova] = useState(false);

  const { data: vendas = [] } = useQuery({
    queryKey: ["slim"],
    queryFn: async () => {
      const { data } = await supabase.from("meu_slim_vendas").select("*").order("data_venda", { ascending: false }).limit(200);
      return data ?? [];
    },
  });

  async function setStatusEntrega(id: string, status: string) {
    const { error } = await supabase.from("meu_slim_vendas").update({ status_entrega: status as any }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["slim"] }); }
  }

  async function confirmarPag(id: string) {
    const forma = prompt("Forma (pix, dinheiro, debito, credito):", "pix");
    if (!forma) return;
    const { error } = await supabase.from("meu_slim_vendas").update({ status_pagamento: "pago" as any, forma_pagamento: forma as any }).eq("id", id);
    if (error) toast.error(error.message); else { toast.success("Pagamento confirmado"); qc.invalidateQueries({ queryKey: ["slim"] }); }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2"><Sparkles className="size-6 text-gold" /><h1 className="text-2xl font-heading font-bold">Meu Slim / Kits Detox</h1></div>
        <Button onClick={() => setNova(true)} className="bg-gold text-gold-foreground hover:bg-gold/90"><Plus className="size-4 mr-1" /> Nova venda</Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {vendas.map((v: any) => (
          <Card key={v.id} className="p-3">
            <div className="flex justify-between mb-1">
              <div className="font-semibold">{v.nome_cliente}</div>
              <Badge variant="outline" className={v.status_pagamento === "pago" ? "text-green-600" : "text-amber-600"}>{v.status_pagamento}</Badge>
            </div>
            <div className="text-xs text-muted-foreground">{v.tipo_kit}</div>
            <div className="text-xs text-muted-foreground">{v.telefone}</div>
            <div className="mt-2 flex justify-between text-sm">
              <span className="text-muted-foreground">{new Date(v.data_venda).toLocaleDateString("pt-BR")}</span>
              <span className="font-bold text-primary">{brl(v.valor)}</span>
            </div>
            {v.data_prevista_entrega && <div className="text-xs text-muted-foreground">Entrega prevista: {new Date(v.data_prevista_entrega).toLocaleDateString("pt-BR")}</div>}
            <div className="mt-2 flex gap-1 flex-wrap">
              <Select value={v.status_entrega} onValueChange={(s) => setStatusEntrega(v.id, s)}>
                <SelectTrigger className="h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>{STATUS_ENT.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent>
              </Select>
              {v.status_pagamento !== "pago" && (
                <Button size="sm" className="bg-gold text-gold-foreground hover:bg-gold/90 h-8" onClick={() => confirmarPag(v.id)}>
                  <CheckCircle2 className="size-3.5 mr-1" /> Dar baixa
                </Button>
              )}
            </div>
          </Card>
        ))}
        {vendas.length === 0 && <p className="text-center col-span-full py-12 text-muted-foreground">Nenhuma venda Meu Slim.</p>}
      </div>

      {nova && <NovaSlimDialog onClose={() => { setNova(false); qc.invalidateQueries({ queryKey: ["slim"] }); }} />}
    </>
  );
}

function NovaSlimDialog({ onClose }: { onClose: () => void }) {
  const { perfil } = useAuth();
  const [f, setF] = useState({
    nome_cliente: "", telefone: "", tipo_kit: KITS[0],
    data_venda: new Date().toISOString().slice(0, 10), data_prevista_entrega: "",
    valor: 0, custo: 0, forma_pagamento: "pix" as any,
    status_pagamento: "pendente" as any, status_entrega: "pendente" as any, observacoes: "",
  });
  const [saving, setSaving] = useState(false);
  async function salvar() {
    if (!f.nome_cliente.trim() || f.valor <= 0) { toast.error("Cliente e valor obrigatórios"); return; }
    setSaving(true);
    const { error } = await supabase.from("meu_slim_vendas").insert({
      ...f, data_prevista_entrega: f.data_prevista_entrega || null,
      lucro: Number(f.valor) - Number(f.custo), usuario_id: perfil?.id ?? null,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Venda registrada"); onClose();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Nova venda Meu Slim</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div><Label>Cliente *</Label><Input value={f.nome_cliente} onChange={e => setF({ ...f, nome_cliente: e.target.value })} /></div>
          <div><Label>Telefone</Label><Input value={f.telefone} onChange={e => setF({ ...f, telefone: e.target.value })} /></div>
          <div><Label>Kit</Label><Select value={f.tipo_kit} onValueChange={v => setF({ ...f, tipo_kit: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{KITS.map(k => <SelectItem key={k} value={k}>{k}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Forma pgto</Label><Select value={f.forma_pagamento} onValueChange={v => setF({ ...f, forma_pagamento: v as any })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{FORMAS.map(o => <SelectItem key={o} value={o}>{o}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Valor *</Label><Input type="number" step="0.01" value={f.valor} onChange={e => setF({ ...f, valor: Number(e.target.value) })} /></div>
          <div><Label>Custo</Label><Input type="number" step="0.01" value={f.custo} onChange={e => setF({ ...f, custo: Number(e.target.value) })} /></div>
          <div><Label>Data venda</Label><Input type="date" value={f.data_venda} onChange={e => setF({ ...f, data_venda: e.target.value })} /></div>
          <div><Label>Entrega prevista</Label><Input type="date" value={f.data_prevista_entrega} onChange={e => setF({ ...f, data_prevista_entrega: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Observações</Label><Textarea value={f.observacoes} onChange={e => setF({ ...f, observacoes: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
