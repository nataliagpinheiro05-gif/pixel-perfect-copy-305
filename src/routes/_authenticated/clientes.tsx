import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Users, Plus, Search, MessageCircle, Pencil } from "lucide-react";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — FitLounge" }] }),
  component: ClientesPage,
});

type Cliente = {
  id: string; nome: string; telefone: string | null; data_nascimento: string | null;
  por_quem_veio: string | null; quem_indicou: string | null; observacoes: string | null; created_at: string;
};

function ClientesPage() {
  const [busca, setBusca] = useState("");
  const [editar, setEditar] = useState<Cliente | null>(null);
  const [novo, setNovo] = useState(false);
  const [detalhe, setDetalhe] = useState<Cliente | null>(null);

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes", busca],
    queryFn: async () => {
      let q = supabase.from("clientes").select("*").order("nome").limit(200);
      if (busca) q = q.or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`);
      const { data } = await q;
      return (data ?? []) as Cliente[];
    },
  });

  return (
    <>
      <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Users className="size-6 text-primary" />
          <h1 className="text-2xl font-heading font-bold">Clientes</h1>
        </div>
        <Button onClick={() => setNovo(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
          <Plus className="size-4 mr-1" /> Novo cliente
        </Button>
      </div>

      <div className="relative mb-3 max-w-md">
        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input className="pl-8" placeholder="Buscar por nome ou telefone..." value={busca} onChange={(e) => setBusca(e.target.value)} />
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {clientes.map((c) => (
          <Card key={c.id} className="p-3 hover:border-primary transition-colors cursor-pointer" onClick={() => setDetalhe(c)}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="font-semibold truncate">{c.nome}</div>
                <div className="text-xs text-muted-foreground">{c.telefone ?? "Sem telefone"}</div>
                {c.por_quem_veio && <div className="text-xs text-muted-foreground mt-0.5">Veio por: {c.por_quem_veio}</div>}
              </div>
              <div className="flex gap-1">
                {c.telefone && (
                  <a href={`https://wa.me/55${c.telefone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="size-8"><MessageCircle className="size-4 text-green-600" /></Button>
                  </a>
                )}
                <Button variant="ghost" size="icon" className="size-8" onClick={(e) => { e.stopPropagation(); setEditar(c); }}>
                  <Pencil className="size-4" />
                </Button>
              </div>
            </div>
          </Card>
        ))}
        {clientes.length === 0 && <p className="text-center py-12 text-muted-foreground col-span-full">Nenhum cliente.</p>}
      </div>

      {(novo || editar) && <ClienteFormDialog cliente={editar} onClose={() => { setNovo(false); setEditar(null); }} />}
      {detalhe && <ClienteDetalhe cliente={detalhe} onClose={() => setDetalhe(null)} />}
    </>
  );
}

function ClienteFormDialog({ cliente, onClose }: { cliente: Cliente | null; onClose: () => void }) {
  const qc = useQueryClient();
  const [nome, setNome] = useState(cliente?.nome ?? "");
  const [telefone, setTelefone] = useState(cliente?.telefone ?? "");
  const [nasc, setNasc] = useState(cliente?.data_nascimento ?? "");
  const [porQuem, setPorQuem] = useState(cliente?.por_quem_veio ?? "");
  const [quemIndicou, setQuemIndicou] = useState(cliente?.quem_indicou ?? "");
  const [obs, setObs] = useState(cliente?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const payload = {
      _nome: nome.trim(),
      _telefone: telefone.replace(/\D/g, "") || null as any,
      _data_nascimento: nasc || null as any,
      _por_quem_veio: porQuem || null as any,
      _quem_indicou: quemIndicou || null as any,
      _observacoes: obs || null as any,
    };
    if (cliente) {
      const { error } = await supabase.from("clientes").update({
        nome: nome.trim(), telefone: telefone.replace(/\D/g, "") || null,
        data_nascimento: nasc || null, por_quem_veio: porQuem || null,
        quem_indicou: quemIndicou || null, observacoes: obs || null,
      }).eq("id", cliente.id);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
    } else {
      const { error } = await supabase.rpc("upsert_cliente", payload);
      setSaving(false);
      if (error) { toast.error(error.message); return; }
    }
    toast.success("Cliente salvo");
    qc.invalidateQueries({ queryKey: ["clientes"] });
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="DDD + número" /></div>
          <div><Label>Data de nascimento</Label><Input type="date" value={nasc ?? ""} onChange={(e) => setNasc(e.target.value)} /></div>
          <div><Label>Por quem veio</Label><Input value={porQuem} onChange={(e) => setPorQuem(e.target.value)} /></div>
          <div><Label>Quem indicou</Label><Input value={quemIndicou} onChange={(e) => setQuemIndicou(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>{saving ? "Salvando..." : "Salvar"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ClienteDetalhe({ cliente, onClose }: { cliente: Cliente; onClose: () => void }) {
  const { data: pedidos = [] } = useQuery({
    queryKey: ["cliente-pedidos", cliente.id],
    queryFn: async () => {
      const { data } = await supabase.from("pedidos")
        .select("id,numero,data_hora,total,status_pedido,status_pagamento")
        .eq("cliente_id", cliente.id).order("data_hora", { ascending: false }).limit(50);
      return data ?? [];
    },
  });
  const { data: indicados = [] } = useQuery({
    queryKey: ["cliente-indicados", cliente.nome],
    queryFn: async () => {
      const { data } = await supabase.from("clientes").select("id,nome,telefone").eq("quem_indicou", cliente.nome);
      return data ?? [];
    },
  });

  const pagas = pedidos.filter((p: any) => p.status_pagamento === "pago");
  const total = pagas.reduce((s, p: any) => s + Number(p.total), 0);
  const pendente = pedidos.filter((p: any) => p.status_pagamento === "pendente").reduce((s, p: any) => s + Number(p.total), 0);
  const ticket = pagas.length ? total / pagas.length : 0;

  return (
    <Sheet open onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-lg overflow-y-auto">
        <SheetHeader><SheetTitle>{cliente.nome}</SheetTitle></SheetHeader>
        <div className="space-y-4 mt-4">
          <div className="text-sm text-muted-foreground">{cliente.telefone ?? "Sem telefone"}</div>
          <div className="grid grid-cols-2 gap-2">
            <Card className="p-3"><div className="text-xs text-muted-foreground">Compras pagas</div><div className="text-xl font-bold">{pagas.length}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Total gasto</div><div className="text-xl font-bold text-primary">{brl(total)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Ticket médio</div><div className="text-lg font-semibold">{brl(ticket)}</div></Card>
            <Card className="p-3"><div className="text-xs text-muted-foreground">Pendente</div><div className="text-lg font-semibold text-amber-600">{brl(pendente)}</div></Card>
          </div>

          <div>
            <div className="text-sm font-semibold mb-2">Histórico ({pedidos.length})</div>
            <ul className="divide-y divide-border max-h-80 overflow-y-auto">
              {pedidos.map((p: any) => (
                <li key={p.id} className="py-2 flex items-center justify-between text-sm">
                  <div>
                    <div className="font-medium">#{p.numero}</div>
                    <div className="text-xs text-muted-foreground">{new Date(p.data_hora).toLocaleDateString("pt-BR")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">{brl(p.total)}</div>
                    <Badge variant="outline" className="text-[10px]">{p.status_pagamento}</Badge>
                  </div>
                </li>
              ))}
              {pedidos.length === 0 && <li className="text-muted-foreground text-sm py-3">Sem pedidos.</li>}
            </ul>
          </div>

          {indicados.length > 0 && (
            <CardContent className="p-0">
              <div className="text-sm font-semibold mb-2">Indicou ({indicados.length})</div>
              <ul className="text-sm text-muted-foreground">
                {indicados.map((i: any) => <li key={i.id}>• {i.nome}</li>)}
              </ul>
            </CardContent>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
