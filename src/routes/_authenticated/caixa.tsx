import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { useAuth } from "@/hooks/use-auth";
import {
  Banknote, ArrowUpRight, ArrowDownRight, Lock, Unlock, AlertTriangle,
  Wallet, History, PlusCircle, MinusCircle, CheckCircle2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/caixa")({
  head: () => ({ meta: [{ title: "Caixa — FitLounge" }] }),
  component: CaixaPage,
});

const STATUS_COLOR: Record<string, string> = {
  aberto: "bg-green-500/10 text-green-700 border-green-500/30 dark:text-green-400",
  fechado: "bg-gray-500/10 text-gray-700 border-gray-500/30 dark:text-gray-400",
  divergente: "bg-red-500/10 text-red-700 border-red-500/30 dark:text-red-400",
};

function CaixaPage() {
  const qc = useQueryClient();
  const { podeFinanceiro } = useAuth();
  const [abrirOpen, setAbrirOpen] = useState(false);
  const [fecharOpen, setFecharOpen] = useState(false);
  const [sangriaOpen, setSangriaOpen] = useState(false);
  const [reforcoOpen, setReforcoOpen] = useState(false);

  const { data: atual } = useQuery({
    queryKey: ["caixa-atual"],
    queryFn: async () => {
      const { data } = await supabase.from("caixas")
        .select("*").eq("status", "aberto").maybeSingle();
      return data as any;
    },
  });

  const { data: historico = [] } = useQuery({
    queryKey: ["caixa-historico"],
    queryFn: async () => {
      const { data } = await supabase.from("caixas")
        .select("*").neq("status", "aberto")
        .order("fechado_em", { ascending: false }).limit(30);
      return data ?? [];
    },
  });

  const { data: movs = [] } = useQuery({
    queryKey: ["caixa-movs", atual?.id],
    enabled: !!atual?.id,
    queryFn: async () => {
      const { data } = await supabase.from("caixa_movimentacoes")
        .select("*").eq("caixa_id", atual!.id)
        .order("created_at", { ascending: false });
      return data ?? [];
    },
  });

  function refresh() {
    qc.invalidateQueries({ queryKey: ["caixa-atual"] });
    qc.invalidateQueries({ queryKey: ["caixa-historico"] });
    qc.invalidateQueries({ queryKey: ["caixa-movs"] });
  }

  const esperado = atual
    ? Number(atual.valor_inicial) + Number(atual.total_dinheiro) +
      Number(atual.total_reforcos) - Number(atual.total_sangrias) -
      Number(atual.total_saidas)
    : 0;

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Banknote className="size-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Caixa</h1>
          {atual ? (
            <Badge variant="outline" className={STATUS_COLOR.aberto}><Unlock className="size-3 mr-1" /> Aberto</Badge>
          ) : (
            <Badge variant="outline" className={STATUS_COLOR.fechado}><Lock className="size-3 mr-1" /> Fechado</Badge>
          )}
        </div>
        <div className="flex gap-2">
          {!atual && (
            <Button onClick={() => setAbrirOpen(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Unlock className="size-4 mr-1" /> Abrir caixa
            </Button>
          )}
          {atual && (
            <>
              <Button variant="outline" onClick={() => setReforcoOpen(true)}>
                <PlusCircle className="size-4 mr-1" /> Reforço
              </Button>
              <Button variant="outline" onClick={() => setSangriaOpen(true)}>
                <MinusCircle className="size-4 mr-1" /> Sangria
              </Button>
              {podeFinanceiro && (
                <Button onClick={() => setFecharOpen(true)} className="bg-primary text-primary-foreground">
                  <Lock className="size-4 mr-1" /> Fechar caixa
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      <Tabs defaultValue="atual" className="space-y-4">
        <TabsList>
          <TabsTrigger value="atual">Caixa atual</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="atual" className="space-y-4">
          {!atual && (
            <Card className="p-8 text-center text-muted-foreground">
              Nenhum caixa aberto no momento. Clique em <strong>Abrir caixa</strong> para começar o dia.
            </Card>
          )}

          {atual && (
            <>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <Kpi label="Valor inicial" value={brl(atual.valor_inicial)} />
                <Kpi label="Entradas em dinheiro" value={brl(atual.total_dinheiro)} icon={<ArrowUpRight className="size-4 text-green-600" />} />
                <Kpi label="Reforços" value={brl(atual.total_reforcos)} icon={<PlusCircle className="size-4 text-emerald-600" />} />
                <Kpi label="Sangrias" value={brl(atual.total_sangrias)} icon={<MinusCircle className="size-4 text-orange-600" />} />
                <Kpi label="Pix" value={brl(atual.total_pix)} />
                <Kpi label="Débito" value={brl(atual.total_debito)} />
                <Kpi label="Crédito" value={brl(atual.total_credito)} />
                <Kpi label="Esperado em caixa (dinheiro)" value={brl(esperado)} highlight />
              </div>

              <Card className="p-4">
                <div className="text-sm font-semibold mb-2 flex items-center gap-2">
                  <History className="size-4" /> Movimentações ({movs.length})
                </div>
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                      <tr><th className="text-left py-2">Hora</th><th className="text-left">Tipo</th><th className="text-left">Descrição</th><th className="text-left">Forma</th><th className="text-right">Valor</th></tr>
                    </thead>
                    <tbody>
                      {movs.map((m: any) => (
                        <tr key={m.id} className="border-b border-border">
                          <td className="py-2">{new Date(m.created_at).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</td>
                          <td><Badge variant="outline" className="capitalize">{m.tipo}</Badge></td>
                          <td className="text-muted-foreground">{m.descricao ?? "—"}</td>
                          <td className="capitalize text-muted-foreground">{m.forma_pagamento ?? "—"}</td>
                          <td className={"text-right font-semibold " + (["sangria", "saida", "fechamento"].includes(m.tipo) ? "text-red-600" : "text-green-600")}>
                            {["sangria", "saida"].includes(m.tipo) ? "−" : ""}{brl(m.valor)}
                          </td>
                        </tr>
                      ))}
                      {movs.length === 0 && <tr><td colSpan={5} className="text-center py-8 text-muted-foreground">Sem movimentações ainda.</td></tr>}
                    </tbody>
                  </table>
                </div>
              </Card>
            </>
          )}
        </TabsContent>

        <TabsContent value="historico" className="space-y-2">
          <Card className="p-4">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="text-xs uppercase text-muted-foreground border-b border-border">
                  <tr>
                    <th className="text-left py-2">Aberto</th>
                    <th className="text-left">Fechado</th>
                    <th className="text-left">Status</th>
                    <th className="text-right">Inicial</th>
                    <th className="text-right">Esperado</th>
                    <th className="text-right">Contado</th>
                    <th className="text-right">Diferença</th>
                  </tr>
                </thead>
                <tbody>
                  {historico.map((c: any) => (
                    <tr key={c.id} className="border-b border-border">
                      <td className="py-2">{new Date(c.aberto_em).toLocaleString("pt-BR")}</td>
                      <td className="text-muted-foreground">{c.fechado_em ? new Date(c.fechado_em).toLocaleString("pt-BR") : "—"}</td>
                      <td><Badge variant="outline" className={STATUS_COLOR[c.status]}>{c.status === "divergente" && <AlertTriangle className="size-3 mr-1" />}{c.status}</Badge></td>
                      <td className="text-right">{brl(c.valor_inicial)}</td>
                      <td className="text-right">{brl(c.valor_dinheiro_esperado)}</td>
                      <td className="text-right">{brl(c.valor_dinheiro_informado)}</td>
                      <td className={"text-right font-semibold " + (Math.abs(Number(c.diferenca || 0)) < 0.005 ? "" : "text-red-600")}>
                        {brl(c.diferenca)}
                      </td>
                    </tr>
                  ))}
                  {historico.length === 0 && <tr><td colSpan={7} className="text-center py-8 text-muted-foreground">Sem caixas fechados.</td></tr>}
                </tbody>
              </table>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      {abrirOpen && <AbrirCaixaDialog onClose={() => setAbrirOpen(false)} onDone={() => { setAbrirOpen(false); refresh(); }} />}
      {fecharOpen && atual && <FecharCaixaDialog esperado={esperado} onClose={() => setFecharOpen(false)} onDone={() => { setFecharOpen(false); refresh(); }} />}
      {sangriaOpen && <SangriaDialog tipo="sangria" onClose={() => setSangriaOpen(false)} onDone={() => { setSangriaOpen(false); refresh(); }} />}
      {reforcoOpen && <SangriaDialog tipo="reforco" onClose={() => setReforcoOpen(false)} onDone={() => { setReforcoOpen(false); refresh(); }} />}
    </>
  );
}

function Kpi({ label, value, icon, highlight }: { label: string; value: string; icon?: React.ReactNode; highlight?: boolean }) {
  return (
    <Card className={"p-3 " + (highlight ? "border-gold/40 bg-gold/5" : "")}>
      <div className="text-[11px] uppercase text-muted-foreground flex items-center gap-1">{icon} {label}</div>
      <div className={"text-lg font-bold " + (highlight ? "text-gold-foreground" : "")}>{value}</div>
    </Card>
  );
}

function AbrirCaixaDialog({ onClose, onDone }: { onClose: () => void; onDone: () => void }) {
  const [valor, setValor] = useState("0");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  async function abrir() {
    setSaving(true);
    const { error } = await supabase.rpc("abrir_caixa", {
      _valor_inicial: Number(valor) || 0,
      _observacoes: obs || (null as any),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Caixa aberto"); onDone();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Abrir caixa</DialogTitle>
          <DialogDescription>Informe o valor em dinheiro presente no caixa neste momento.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Valor inicial em dinheiro</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Observações</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={abrir} disabled={saving} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <Unlock className="size-4 mr-1" /> {saving ? "Abrindo..." : "Abrir caixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function FecharCaixaDialog({ esperado, onClose, onDone }: { esperado: number; onClose: () => void; onDone: () => void }) {
  const [valor, setValor] = useState(String(esperado.toFixed(2)));
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);
  const dif = Number(valor) - esperado;
  async function fechar() {
    setSaving(true);
    const { error } = await supabase.rpc("fechar_caixa", {
      _valor_dinheiro: Number(valor) || 0,
      _observacoes: obs || (null as any),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Caixa fechado"); onDone();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Fechar caixa</DialogTitle>
          <DialogDescription>Conte o dinheiro físico e informe abaixo. O sistema calcula a diferença automaticamente.</DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Esperado em dinheiro</span><span className="font-semibold">{brl(esperado)}</span></div>
          </div>
          <div><Label>Valor contado (dinheiro)</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          {Math.abs(dif) > 0.005 && (
            <div className={"rounded-lg p-3 text-sm flex items-center gap-2 " + (dif < 0 ? "bg-red-500/10 text-red-700 dark:text-red-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400")}>
              <AlertTriangle className="size-4" /> Diferença de {brl(dif)} — informe observação abaixo.
            </div>
          )}
          <div><Label>Observações {Math.abs(dif) > 0.005 && <span className="text-destructive">*</span>}</Label><Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={fechar} disabled={saving || (Math.abs(dif) > 0.005 && !obs.trim())}>
            <Lock className="size-4 mr-1" /> {saving ? "Fechando..." : "Fechar caixa"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SangriaDialog({ tipo, onClose, onDone }: { tipo: "sangria" | "reforco"; onClose: () => void; onDone: () => void }) {
  const [valor, setValor] = useState("");
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);
  async function salvar() {
    if (!Number(valor)) { toast.error("Valor obrigatório"); return; }
    setSaving(true);
    const fn = tipo === "sangria" ? "registrar_sangria" : "registrar_reforco";
    const { error } = await supabase.rpc(fn, {
      _valor: Number(valor),
      _motivo: motivo || (tipo === "sangria" ? "Sangria" : "Reforço"),
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(tipo === "sangria" ? "Sangria registrada" : "Reforço registrado"); onDone();
  }
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{tipo === "sangria" ? "Sangria de caixa" : "Reforço de caixa"}</DialogTitle>
          <DialogDescription>
            {tipo === "sangria"
              ? "Retirada de dinheiro do caixa (ex.: pagar fornecedor à vista)."
              : "Entrada manual de dinheiro no caixa (ex.: trocado para pagar troco)."}
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div><Label>Valor</Label><Input type="number" step="0.01" value={valor} onChange={(e) => setValor(e.target.value)} /></div>
          <div><Label>Motivo</Label><Input value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: troco, fornecedor X" /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <CheckCircle2 className="size-4 mr-1" /> {saving ? "Salvando..." : "Confirmar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
