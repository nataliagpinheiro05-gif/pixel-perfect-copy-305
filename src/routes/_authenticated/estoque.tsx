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
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Package, Plus, Pencil, ArrowDown, ArrowUp, AlertTriangle, History } from "lucide-react";

export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — FitLounge" }] }),
  component: EstoquePage,
});

type Item = {
  id: string; nome: string; categoria: string | null; quantidade_atual: number;
  unidade_medida: string; estoque_minimo: number; custo_unitario: number;
  fornecedor: string | null; validade: string | null; ativo: boolean;
};

const UNIDADES = ["unidade","pote","sachê","dose","caixa","pacote","g","kg","l","ml"];
const CATEGORIAS = ["Insumos Herbalife","Embalagens","Ingredientes","Kits Meu Slim","Outros"];

function EstoquePage() {
  const { perfil } = useAuth();
  const qc = useQueryClient();
  const [editar, setEditar] = useState<Item | null>(null);
  const [novo, setNovo] = useState(false);
  const [movItem, setMovItem] = useState<Item | null>(null);
  const [histItem, setHistItem] = useState<Item | null>(null);

  const { data: itens = [] } = useQuery({
    queryKey: ["estoque"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_itens").select("*").order("nome");
      return (data ?? []) as Item[];
    },
  });

  const baixo = itens.filter(i => i.estoque_minimo > 0 && i.quantidade_atual <= i.estoque_minimo);
  const vencendo = itens.filter(i => i.validade && (new Date(i.validade).getTime() - Date.now()) < 7 * 24 * 3600 * 1000);

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Package className="size-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Estoque</h1>
        </div>
        <Button onClick={() => setNovo(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Plus className="size-4 mr-1" /> Novo item
        </Button>
      </div>

      {(baixo.length > 0 || vencendo.length > 0) && (
        <Card className="p-3 mb-4 border-amber-500/40 bg-amber-500/5">
          <div className="flex items-center gap-2 text-amber-700 dark:text-amber-400 mb-1">
            <AlertTriangle className="size-4" /><span className="font-semibold">Alertas</span>
          </div>
          {baixo.length > 0 && <div className="text-sm">{baixo.length} item(ns) abaixo do mínimo</div>}
          {vencendo.length > 0 && <div className="text-sm">{vencendo.length} item(ns) vencendo em até 7 dias</div>}
        </Card>
      )}

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="text-xs uppercase text-muted-foreground border-b border-border">
            <tr><th className="text-left py-2">Item</th><th className="text-left">Categoria</th><th className="text-right">Qtd</th><th className="text-right">Mín</th><th className="text-right">Custo un.</th><th className="text-left">Validade</th><th></th></tr>
          </thead>
          <tbody>
            {itens.map((i) => {
              const ok = i.estoque_minimo === 0 || i.quantidade_atual > i.estoque_minimo;
              return (
                <tr key={i.id} className="border-b border-border hover:bg-muted/40">
                  <td className="py-2 font-medium">{i.nome}</td>
                  <td className="text-muted-foreground">{i.categoria ?? "—"}</td>
                  <td className="text-right">
                    <span className={ok ? "" : "text-amber-600 font-semibold"}>{i.quantidade_atual} {i.unidade_medida}</span>
                  </td>
                  <td className="text-right text-muted-foreground">{i.estoque_minimo}</td>
                  <td className="text-right">{brl(i.custo_unitario)}</td>
                  <td>{i.validade ? new Date(i.validade).toLocaleDateString("pt-BR") : "—"}</td>
                  <td className="text-right whitespace-nowrap">
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setMovItem(i)}><ArrowUp className="size-4 text-green-600" /></Button>
                    <Button variant="ghost" size="icon" className="size-8" onClick={() => setHistItem(i)}><History className="size-4" /></Button>
                    {perfil?.role === "admin" && <Button variant="ghost" size="icon" className="size-8" onClick={() => setEditar(i)}><Pencil className="size-4" /></Button>}
                  </td>
                </tr>
              );
            })}
            {itens.length === 0 && <tr><td colSpan={7} className="text-center py-12 text-muted-foreground">Nenhum item cadastrado.</td></tr>}
          </tbody>
        </table>
      </div>

      {(novo || editar) && <ItemForm item={editar} onClose={() => { setNovo(false); setEditar(null); qc.invalidateQueries({ queryKey: ["estoque"] }); }} />}
      {movItem && <MovDialog item={movItem} onClose={() => { setMovItem(null); qc.invalidateQueries({ queryKey: ["estoque"] }); }} />}
      {histItem && <HistDialog item={histItem} onClose={() => setHistItem(null)} />}
    </>
  );
}

function ItemForm({ item, onClose }: { item: Item | null; onClose: () => void }) {
  const [f, setF] = useState({
    nome: item?.nome ?? "", categoria: item?.categoria ?? "Insumos Herbalife",
    quantidade_atual: item?.quantidade_atual ?? 0, unidade_medida: item?.unidade_medida ?? "unidade",
    estoque_minimo: item?.estoque_minimo ?? 0, custo_unitario: item?.custo_unitario ?? 0,
    fornecedor: item?.fornecedor ?? "", validade: item?.validade ?? "", ativo: item?.ativo ?? true,
  });
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!f.nome.trim()) { toast.error("Nome obrigatório"); return; }
    setSaving(true);
    const payload = { ...f, validade: f.validade || null, fornecedor: f.fornecedor || null };
    const op = item
      ? supabase.from("estoque_itens").update(payload).eq("id", item.id)
      : supabase.from("estoque_itens").insert(payload);
    const { error } = await op;
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Item salvo"); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{item ? "Editar item" : "Novo item"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Nome *</Label><Input value={f.nome} onChange={e => setF({ ...f, nome: e.target.value })} /></div>
          <div><Label>Categoria</Label>
            <Select value={f.categoria} onValueChange={v => setF({ ...f, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{CATEGORIAS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Unidade</Label>
            <Select value={f.unidade_medida} onValueChange={v => setF({ ...f, unidade_medida: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{UNIDADES.map(u => <SelectItem key={u} value={u}>{u}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Quantidade atual</Label><Input type="number" step="0.01" value={f.quantidade_atual} onChange={e => setF({ ...f, quantidade_atual: Number(e.target.value) })} /></div>
          <div><Label>Estoque mínimo</Label><Input type="number" step="0.01" value={f.estoque_minimo} onChange={e => setF({ ...f, estoque_minimo: Number(e.target.value) })} /></div>
          <div><Label>Custo unitário</Label><Input type="number" step="0.01" value={f.custo_unitario} onChange={e => setF({ ...f, custo_unitario: Number(e.target.value) })} /></div>
          <div><Label>Validade</Label><Input type="date" value={f.validade ?? ""} onChange={e => setF({ ...f, validade: e.target.value })} /></div>
          <div className="sm:col-span-2"><Label>Fornecedor</Label><Input value={f.fornecedor ?? ""} onChange={e => setF({ ...f, fornecedor: e.target.value })} /></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function MovDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { perfil } = useAuth();
  const [tipo, setTipo] = useState<"entrada" | "saida">("entrada");
  const [tipoMov, setTipoMov] = useState("compra");
  const [qtd, setQtd] = useState(0);
  const [motivo, setMotivo] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (qtd <= 0) { toast.error("Quantidade > 0"); return; }
    setSaving(true);
    const nova = tipo === "entrada" ? Number(item.quantidade_atual) + qtd : Number(item.quantidade_atual) - qtd;
    const { error: e1 } = await supabase.from("estoque_itens").update({ quantidade_atual: nova }).eq("id", item.id);
    if (e1) { setSaving(false); toast.error(e1.message); return; }
    const { error: e2 } = await supabase.from("estoque_movimentacoes").insert({
      item_id: item.id, tipo, tipo_movimentacao: tipoMov, quantidade: qtd,
      motivo: motivo || tipoMov, usuario_id: perfil?.id ?? null,
    });
    setSaving(false);
    if (e2) { toast.error(e2.message); return; }
    toast.success("Movimentação registrada"); onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Movimentar {item.nome}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <Tabs value={tipo} onValueChange={(v) => setTipo(v as any)}>
            <TabsList className="grid grid-cols-2 w-full">
              <TabsTrigger value="entrada"><ArrowUp className="size-4 mr-1 text-green-600" /> Entrada</TabsTrigger>
              <TabsTrigger value="saida"><ArrowDown className="size-4 mr-1 text-red-600" /> Saída/Ajuste</TabsTrigger>
            </TabsList>
            <TabsContent value="entrada" className="space-y-3 mt-3">
              <Select value={tipoMov} onValueChange={setTipoMov}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="compra">Compra</SelectItem>
                  <SelectItem value="ajuste">Ajuste positivo</SelectItem>
                  <SelectItem value="devolucao">Devolução</SelectItem>
                </SelectContent>
              </Select>
            </TabsContent>
            <TabsContent value="saida" className="space-y-3 mt-3">
              <Select value={tipoMov} onValueChange={setTipoMov}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ajuste">Ajuste negativo</SelectItem>
                  <SelectItem value="perda">Perda</SelectItem>
                  <SelectItem value="uso_interno">Uso interno</SelectItem>
                  <SelectItem value="vencimento">Vencimento</SelectItem>
                </SelectContent>
              </Select>
            </TabsContent>
          </Tabs>
          <div><Label>Quantidade ({item.unidade_medida})</Label><Input type="number" step="0.01" value={qtd} onChange={e => setQtd(Number(e.target.value))} /></div>
          <div><Label>Motivo / observação</Label><Textarea value={motivo} onChange={e => setMotivo(e.target.value)} /></div>
          <div className="text-sm text-muted-foreground">Saldo atual: <span className="font-semibold">{item.quantidade_atual}</span> → Após: <span className="font-semibold">{tipo === "entrada" ? Number(item.quantidade_atual) + qtd : Number(item.quantidade_atual) - qtd}</span></div>
        </div>
        <DialogFooter><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Confirmar"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function HistDialog({ item, onClose }: { item: Item; onClose: () => void }) {
  const { data: movs = [] } = useQuery({
    queryKey: ["mov", item.id],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_movimentacoes").select("*").eq("item_id", item.id).order("created_at", { ascending: false }).limit(80);
      return data ?? [];
    },
  });
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>Histórico — {item.nome}</DialogTitle></DialogHeader>
        <ul className="max-h-96 overflow-y-auto divide-y divide-border text-sm">
          {movs.map((m: any) => (
            <li key={m.id} className="py-2 flex justify-between gap-2">
              <div>
                <div className="font-medium flex items-center gap-2">
                  {m.tipo === "entrada" ? <ArrowUp className="size-4 text-green-600" /> : <ArrowDown className="size-4 text-red-600" />}
                  {m.tipo_movimentacao ?? m.tipo}
                </div>
                <div className="text-xs text-muted-foreground">{m.motivo}</div>
                <div className="text-xs text-muted-foreground">{new Date(m.created_at).toLocaleString("pt-BR")}</div>
              </div>
              <Badge variant="outline" className={m.tipo === "entrada" ? "text-green-600" : "text-red-600"}>
                {m.tipo === "entrada" ? "+" : "−"}{m.quantidade}
              </Badge>
            </li>
          ))}
          {movs.length === 0 && <li className="text-center py-6 text-muted-foreground">Sem movimentações.</li>}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
