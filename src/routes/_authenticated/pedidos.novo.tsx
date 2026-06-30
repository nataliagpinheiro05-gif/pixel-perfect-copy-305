import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { toast } from "sonner";
import { ArrowLeft, ChevronRight, Search, UserPlus, User2, UserCheck, Coffee } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  head: () => ({ meta: [{ title: "Nova comanda — FitLounge" }] }),
  component: NovaComandaPage,
});

type Cliente = { id: string; nome: string; telefone: string | null };
type Modo = "cadastrado" | "rapido" | "balcao";

function NovaComandaPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<Modo>("cadastrado");
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [nomeRapido, setNomeRapido] = useState("");
  const [telRapido, setTelRapido] = useState("");
  const [obs, setObs] = useState("");
  const [abrindo, setAbrindo] = useState(false);

  async function abrirComanda() {
    if (modo === "cadastrado" && !cliente) {
      toast.error("Selecione o cliente ou troque o modo");
      return;
    }
    if (modo === "rapido" && !nomeRapido.trim() && !telRapido.trim()) {
      toast.error("Informe ao menos o nome ou o telefone");
      return;
    }
    setAbrindo(true);
    const { data, error } = await supabase.rpc("abrir_comanda", {
      _cliente_id: modo === "cadastrado" ? cliente!.id : (null as any),
      _cliente_nome: modo === "rapido" ? nomeRapido.trim() : modo === "balcao" ? "Consumidor balcão" : (null as any),
      _cliente_telefone: modo === "rapido" ? telRapido.replace(/\D/g, "") : (null as any),
      _observacoes: (obs || null) as any,
    });
    setAbrindo(false);
    if (error || !data) {
      toast.error(error?.message ?? "Erro ao abrir comanda");
      return;
    }
    const ped = data as any;
    toast.success(`Comanda #${ped.numero} aberta`);
    navigate({ to: "/pedidos/$id" as any, params: { id: ped.id } as any });
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pedidos" as any })}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold">Nova comanda</h1>
          <p className="text-sm text-muted-foreground">Identifique o cliente e abra a comanda. Os produtos são adicionados depois.</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto space-y-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Como identificar o cliente?</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
              <ModoBtn icon={UserCheck} label="Cadastrado" ativo={modo === "cadastrado"} onClick={() => setModo("cadastrado")} />
              <ModoBtn icon={User2} label="Cliente rápido" ativo={modo === "rapido"} onClick={() => setModo("rapido")} />
              <ModoBtn icon={Coffee} label="Balcão" ativo={modo === "balcao"} onClick={() => setModo("balcao")} />
            </div>

            {modo === "cadastrado" && (
              <ClienteSelector cliente={cliente} onChange={setCliente} />
            )}

            {modo === "rapido" && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={nomeRapido} onChange={(e) => setNomeRapido(e.target.value)} placeholder="Ex.: Maria" />
                </div>
                <div>
                  <Label>Telefone / WhatsApp</Label>
                  <Input value={telRapido} onChange={(e) => setTelRapido(e.target.value)} placeholder="Só números" />
                </div>
                <p className="sm:col-span-2 text-xs text-muted-foreground">
                  Útil para venda rápida. Você pode completar o cadastro do cliente depois, em Clientes.
                </p>
              </div>
            )}

            {modo === "balcao" && (
              <div className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
                Comanda em nome de <strong className="text-foreground">Consumidor balcão</strong> — sem vínculo com cadastro.
              </div>
            )}

            <div>
              <Label>Observações (opcional)</Label>
              <Textarea rows={2} value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: mesa 3, viagem, retirada..." />
            </div>
          </CardContent>
        </Card>

        <Button
          className="w-full h-12 bg-gold text-gold-foreground hover:bg-gold/90 text-base"
          disabled={abrindo}
          onClick={abrirComanda}
        >
          {abrindo ? "Abrindo..." : "Abrir comanda"}
        </Button>
      </div>
    </>
  );
}

function ModoBtn({ icon: Icon, label, ativo, onClick }: { icon: any; label: string; ativo: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={
        "flex flex-col items-center gap-1.5 rounded-lg border p-3 text-sm font-medium transition-colors " +
        (ativo ? "border-gold bg-gold/10 text-gold-foreground" : "border-border hover:border-primary/40")
      }
    >
      <Icon className="size-5" />
      {label}
    </button>
  );
}

function ClienteSelector({ cliente, onChange }: { cliente: Cliente | null; onChange: (c: Cliente | null) => void }) {
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: resultados = [] } = useQuery({
    queryKey: ["busca-cliente-comanda", busca],
    enabled: busca.length >= 2 && !cliente,
    queryFn: async () => {
      const { data } = await supabase
        .from("clientes")
        .select("id,nome,telefone")
        .or(`nome.ilike.%${busca}%,telefone.ilike.%${busca}%`)
        .limit(8);
      return (data ?? []) as Cliente[];
    },
  });

  if (cliente) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-border p-3 bg-primary/5">
        <div>
          <div className="font-medium">{cliente.nome}</div>
          <div className="text-xs text-muted-foreground">{cliente.telefone ?? "Sem telefone"}</div>
        </div>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)}>Trocar</Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
        <Input
          className="pl-8"
          placeholder="Buscar por nome ou telefone..."
          value={busca}
          onChange={(e) => { setBusca(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
        />
      </div>
      {open && busca.length >= 2 && (
        <div className="rounded-lg border border-border bg-card max-h-60 overflow-y-auto">
          {resultados.map((c) => (
            <button key={c.id} onClick={() => { onChange(c); setOpen(false); setBusca(""); }} className="w-full text-left px-3 py-2 hover:bg-muted flex items-center justify-between">
              <div>
                <div className="text-sm font-medium">{c.nome}</div>
                <div className="text-xs text-muted-foreground">{c.telefone ?? "—"}</div>
              </div>
              <ChevronRight className="size-4 text-muted-foreground" />
            </button>
          ))}
          {resultados.length === 0 && <div className="px-3 py-3 text-sm text-muted-foreground">Nenhum cliente. Cadastre um novo abaixo.</div>}
        </div>
      )}
      <Button variant="outline" size="sm" onClick={() => setNovoOpen(true)}>
        <UserPlus className="mr-2 size-4" /> Cadastrar novo cliente
      </Button>
      {novoOpen && (
        <NovoClienteDialog
          telefoneInicial={/^\d/.test(busca) ? busca : ""}
          nomeInicial={!/^\d/.test(busca) ? busca : ""}
          onClose={() => setNovoOpen(false)}
          onSaved={(c) => { onChange(c); setNovoOpen(false); setBusca(""); }}
        />
      )}
    </div>
  );
}

function NovoClienteDialog({ telefoneInicial, nomeInicial, onClose, onSaved }: { telefoneInicial: string; nomeInicial: string; onClose: () => void; onSaved: (c: Cliente) => void }) {
  const [nome, setNome] = useState(nomeInicial);
  const [telefone, setTelefone] = useState(telefoneInicial);
  const [dataNasc, setDataNasc] = useState("");
  const [quemIndicou, setQuemIndicou] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("upsert_cliente", {
      _nome: nome.trim(),
      _telefone: (telefone.replace(/\D/g, "") || null) as any,
      _data_nascimento: (dataNasc || null) as any,
      _por_quem_veio: null as any,
      _quem_indicou: (quemIndicou || null) as any,
      _observacoes: (obs || null) as any,
    });
    setSaving(false);
    if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
    const c = data as any;
    onSaved({ id: c.id, nome: c.nome, telefone: c.telefone });
    toast.success("Cliente salvo");
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent>
        <DialogHeader><DialogTitle>Novo cliente</DialogTitle></DialogHeader>
        <div className="grid sm:grid-cols-2 gap-3">
          <div className="sm:col-span-2"><Label>Nome *</Label><Input value={nome} onChange={(e) => setNome(e.target.value)} /></div>
          <div><Label>Telefone / WhatsApp</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Só números" /></div>
          <div><Label>Data de nascimento</Label><Input type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Quem indicou</Label><Input value={quemIndicou} onChange={(e) => setQuemIndicou(e.target.value)} /></div>
          <div className="sm:col-span-2"><Label>Observações</Label><Textarea value={obs} onChange={(e) => setObs(e.target.value)} /></div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Cancelar</Button>
          <Button onClick={salvar} disabled={saving}>Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
