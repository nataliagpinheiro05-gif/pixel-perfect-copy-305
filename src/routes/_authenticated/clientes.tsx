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
import { clienteSchema, formatZodError } from "@/lib/validations";
import { handleError } from "@/lib/errors";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — FitLounge" }] }),
  component: ClientesPage,
});

type Cliente = {
  id: string; nome: string; telefone: string | null; data_nascimento: string | null;
  quem_indicou: string | null; observacoes: string | null; created_at: string;
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
                {c.quem_indicou && <div className="text-xs text-muted-foreground mt-0.5">Indicado por: {c.quem_indicou}</div>}
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
  const [quemIndicou, setQuemIndicou] = useState(cliente?.quem_indicou ?? "");
  const [obs, setObs] = useState(cliente?.observacoes ?? "");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    const parsed = clienteSchema.safeParse({
      nome, telefone, data_nascimento: nasc,
      quem_indicou: quemIndicou, observacoes: obs,
    });
    if (!parsed.success) { toast.error(formatZodError(parsed.error)); return; }
    const v = parsed.data;
    setSaving(true);
    try {
      if (cliente) {
        const { error } = await supabase.from("clientes").update({
          nome: v.nome, telefone: v.telefone || null,
          data_nascimento: v.data_nascimento || null,
          quem_indicou: v.quem_indicou || null, observacoes: v.observacoes || null,
        }).eq("id", cliente.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.rpc("upsert_cliente", {
          _nome: v.nome,
          _telefone: (v.telefone || null) as any,
          _data_nascimento: (v.data_nascimento || null) as any,
          _por_quem_veio: null as any,
          _quem_indicou: (v.quem_indicou || null) as any,
          _observacoes: (v.observacoes || null) as any,
        });
        if (error) throw error;
      }
      toast.success("Cliente salvo");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      onClose();
    } catch (err) {
      handleError(err, "Não foi possível salvar o cliente");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader><DialogTitle>{cliente ? "Editar cliente" : "Novo cliente"}</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>Telefone / WhatsApp</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="DDD + número" /></div>
          <div><Label>Data de nascimento</Label><Input type="date" value={nasc ?? ""} onChange={(e) => setNasc(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Quem indicou</Label><Input value={quemIndicou} onChange={(e) => setQuemIndicou(e.target.value)} /></div>
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
