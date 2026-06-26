import { createFileRoute, useNavigate } from "@tanstack/react-router";

import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Trash2, ChevronRight, Search, UserPlus, ArrowLeft, Check } from "lucide-react";

export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo pedido — FitLounge" }] }),
  component: NovoPedidoPage,
});

type Cliente = { id: string; nome: string; telefone: string | null };
type Adicional = { id: string; nome: string; preco: number };
type Sabor = { id: string; nome: string };
type Produto = {
  id: string;
  nome: string;
  preco: number;
  custo: number;
  categoria_id: string | null;
  categoria?: { nome: string } | null;
  produto_sabores: { sabores: Sabor }[];
  produto_adicionais: { adicionais: Adicional }[];
};
type Categoria = { id: string; nome: string };

type ItemCarrinho = {
  uid: string;
  produto: Produto;
  sabor: string | null;
  adicionais: { nome: string; preco: number }[];
  quantidade: number;
  observacoes: string;
};

function NovoPedidoPage() {
  const navigate = useNavigate();
  const { perfil } = useAuth();
  const [cliente, setCliente] = useState<Cliente | null>(null);
  const [itens, setItens] = useState<ItemCarrinho[]>([]);
  const [formaPagamento] = useState<string | null>(null);
  const [statusPagamento] = useState<string>("pendente");
  const [observacoes, setObservacoes] = useState("");
  const [produtoOpen, setProdutoOpen] = useState<Produto | null>(null);
  const [salvando, setSalvando] = useState(false);

  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-ativas"],
    queryFn: async () => {
      const { data } = await supabase.from("categorias_produtos").select("id,nome").eq("ativo", true).order("nome");
      return (data ?? []) as Categoria[];
    },
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-novo-pedido"],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id,nome,preco,custo,categoria_id,categoria:categorias_produtos(nome),produto_sabores(sabores(id,nome)),produto_adicionais(adicionais(id,nome,preco))")
        .eq("ativo", true)
        .eq("aparece_no_pedido", true)
        .order("nome");
      return (data ?? []) as unknown as Produto[];
    },
  });

  const [catSel, setCatSel] = useState<string | "todas">("todas");
  const [buscaProduto, setBuscaProduto] = useState("");
  const produtosFiltrados = useMemo(() => {
    return produtos.filter((p) => {
      const okCat = catSel === "todas" || p.categoria_id === catSel;
      const okBusca = !buscaProduto || p.nome.toLowerCase().includes(buscaProduto.toLowerCase());
      return okCat && okBusca;
    });
  }, [produtos, catSel, buscaProduto]);

  const subtotal = itens.reduce((acc, it) => {
    const add = it.adicionais.reduce((s, a) => s + Number(a.preco), 0);
    return acc + (Number(it.produto.preco) + add) * it.quantidade;
  }, 0);

  async function salvar() {
    if (itens.length === 0) {
      toast.error("Adicione pelo menos um item ao pedido");
      return;
    }
    setSalvando(true);
    try {
      const { data: pedido, error: e1 } = await supabase
        .from("pedidos")
        .insert({
          cliente_id: cliente?.id ?? null,
          forma_pagamento: formaPagamento as any,
          status_pagamento: statusPagamento as any,
          observacoes: observacoes || null,
          usuario_id: perfil?.id ?? null,
        })
        .select("id, numero")
        .single();
      if (e1 || !pedido) throw e1 ?? new Error("Falha ao criar pedido");

      const payload = itens.map((it) => ({
        pedido_id: pedido.id,
        produto_id: it.produto.id,
        nome_produto: it.produto.nome,
        quantidade: it.quantidade,
        preco_unitario: Number(it.produto.preco),
        custo_unitario: Number(it.produto.custo),
        sabor: it.sabor,
        adicionais: it.adicionais as any,
        observacoes: it.observacoes || null,
      }));
      const { error: e2 } = await supabase.from("pedido_itens").insert(payload);
      if (e2) throw e2;

      toast.success(`Pedido #${pedido.numero} criado!`);
      navigate({ to: "/cozinha" });
    } catch (err: any) {
      toast.error(err.message ?? "Erro ao salvar pedido");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/" })}>
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-heading font-bold">Novo Pedido</h1>
          <p className="text-sm text-muted-foreground">Cliente, produtos e pagamento em poucos toques.</p>
        </div>
      </div>

      <div className="grid lg:grid-cols-[1fr_380px] gap-4">
        <div className="space-y-4">
          {/* Cliente */}
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">1. Cliente</CardTitle></CardHeader>
            <CardContent>
              <ClienteSelector cliente={cliente} onChange={setCliente} />
            </CardContent>
          </Card>

          {/* Produtos */}
          <Card>
            <CardHeader className="pb-3 flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">2. Produtos</CardTitle>
              <Badge variant="secondary">{itens.length} {itens.length === 1 ? "item" : "itens"}</Badge>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                  <Input className="pl-8" placeholder="Buscar produto..." value={buscaProduto} onChange={(e) => setBuscaProduto(e.target.value)} />
                </div>
                <Select value={catSel} onValueChange={(v) => setCatSel(v as any)}>
                  <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todas">Todas categorias</SelectItem>
                    {categorias.map((c) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {produtosFiltrados.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => setProdutoOpen(p)}
                    className="group text-left rounded-xl border border-border p-3 hover:border-primary hover:bg-primary/5 transition-colors"
                  >
                    <div className="text-[11px] text-muted-foreground uppercase tracking-wide">{p.categoria?.nome ?? ""}</div>
                    <div className="font-medium text-sm leading-tight mt-0.5 line-clamp-2">{p.nome}</div>
                    <div className="mt-2 text-primary font-semibold">{brl(p.preco)}</div>
                  </button>
                ))}
                {produtosFiltrados.length === 0 && (
                  <div className="col-span-full text-center text-sm text-muted-foreground py-8">Nenhum produto encontrado.</div>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Observações — pagamento acontece após a entrega */}
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">3. Observações</CardTitle>
              <p className="text-xs text-muted-foreground">O pedido entra no sistema e segue pelo fluxo: cozinha → produção → pronto → entrega → pagamento.</p>
            </CardHeader>
            <CardContent>
              <Label>Observações do pedido</Label>
              <Textarea value={observacoes} onChange={(e) => setObservacoes(e.target.value)} placeholder="Opcional" />
            </CardContent>
          </Card>
        </div>

        {/* Carrinho lateral */}
        <div className="lg:sticky lg:top-16 h-fit">
          <Card>
            <CardHeader className="pb-3"><CardTitle className="text-base">Resumo</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {itens.length === 0 && <p className="text-sm text-muted-foreground text-center py-6">Nenhum item adicionado ainda.</p>}
              {itens.map((it) => {
                const addTotal = it.adicionais.reduce((s, a) => s + Number(a.preco), 0);
                const total = (Number(it.produto.preco) + addTotal) * it.quantidade;
                return (
                  <div key={it.uid} className="rounded-lg border border-border p-2.5">
                    <div className="flex justify-between gap-2 items-start">
                      <div className="min-w-0">
                        <div className="text-sm font-medium leading-tight">{it.quantidade}× {it.produto.nome}</div>
                        {it.sabor && <div className="text-xs text-muted-foreground">Sabor: {it.sabor}</div>}
                        {it.adicionais.length > 0 && <div className="text-xs text-muted-foreground">+ {it.adicionais.map(a => a.nome).join(", ")}</div>}
                        {it.observacoes && <div className="text-xs italic text-muted-foreground mt-0.5">"{it.observacoes}"</div>}
                      </div>
                      <div className="text-sm font-semibold whitespace-nowrap">{brl(total)}</div>
                    </div>
                    <button onClick={() => setItens((arr) => arr.filter((x) => x.uid !== it.uid))} className="mt-1.5 text-xs text-destructive flex items-center gap-1">
                      <Trash2 className="size-3" /> Remover
                    </button>
                  </div>
                );
              })}
              <Separator />
              <div className="flex justify-between text-lg font-bold">
                <span>Total</span>
                <span className="text-primary">{brl(subtotal)}</span>
              </div>
              <Button className="w-full h-11 bg-gold text-gold-foreground hover:bg-gold/90" disabled={salvando || itens.length === 0} onClick={salvar}>
                <Check className="mr-2 size-4" /> {salvando ? "Salvando..." : "Finalizar pedido"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>

      {produtoOpen && (
        <ProdutoDialog
          produto={produtoOpen}
          onClose={() => setProdutoOpen(null)}
          onAdd={(item) => { setItens((arr) => [...arr, item]); setProdutoOpen(null); }}
        />
      )}
    </>
  );
}

function ClienteSelector({ cliente, onChange }: { cliente: Cliente | null; onChange: (c: Cliente | null) => void }) {
  const [busca, setBusca] = useState("");
  const [open, setOpen] = useState(false);
  const [novoOpen, setNovoOpen] = useState(false);

  const { data: resultados = [] } = useQuery({
    queryKey: ["busca-cliente", busca],
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
      <div className="flex gap-2">
        <Button variant="outline" size="sm" onClick={() => setNovoOpen(true)}>
          <UserPlus className="mr-2 size-4" /> Novo cliente
        </Button>
        <Button variant="ghost" size="sm" onClick={() => onChange(null)} className="text-muted-foreground">
          Continuar sem cliente
        </Button>
      </div>
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
  const [porQuem, setPorQuem] = useState("");
  const [quemIndicou, setQuemIndicou] = useState("");
  const [obs, setObs] = useState("");
  const [saving, setSaving] = useState(false);

  async function salvar() {
    if (!nome.trim()) { toast.error("Informe o nome"); return; }
    setSaving(true);
    const { data, error } = await supabase.rpc("upsert_cliente", {
      _nome: nome.trim(),
      _telefone: telefone.replace(/\D/g, "") || null as any,
      _data_nascimento: dataNasc || null as any,
      _por_quem_veio: porQuem || null as any,
      _quem_indicou: quemIndicou || null as any,
      _observacoes: obs || null as any,
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
          <div><Label>Telefone</Label><Input value={telefone} onChange={(e) => setTelefone(e.target.value)} placeholder="Só números" /></div>
          <div><Label>Data de nascimento</Label><Input type="date" value={dataNasc} onChange={(e) => setDataNasc(e.target.value)} /></div>
          <div><Label>Por quem veio</Label><Input value={porQuem} onChange={(e) => setPorQuem(e.target.value)} /></div>
          <div><Label>Quem indicou</Label><Input value={quemIndicou} onChange={(e) => setQuemIndicou(e.target.value)} /></div>
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

function ProdutoDialog({ produto, onClose, onAdd }: { produto: Produto; onClose: () => void; onAdd: (i: ItemCarrinho) => void }) {
  const sabores = produto.produto_sabores.map((ps) => ps.sabores).filter(Boolean);
  const adicionais = produto.produto_adicionais.map((pa) => pa.adicionais).filter(Boolean);
  const [sabor, setSabor] = useState<string | null>(sabores[0]?.nome ?? null);
  const [adicSel, setAdicSel] = useState<Record<string, boolean>>({});
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");

  const addList = adicionais.filter((a) => adicSel[a.id]).map((a) => ({ nome: a.nome, preco: Number(a.preco) }));
  const total = (Number(produto.preco) + addList.reduce((s, a) => s + a.preco, 0)) * qtd;

  function confirmar() {
    onAdd({
      uid: crypto.randomUUID(),
      produto,
      sabor,
      adicionais: addList,
      quantidade: qtd,
      observacoes: obs,
    });
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{produto.nome}</DialogTitle>
          <div className="text-sm text-muted-foreground">{brl(produto.preco)}</div>
        </DialogHeader>

        {sabores.length > 0 && (
          <div className="space-y-2">
            <Label>Sabor</Label>
            <div className="flex flex-wrap gap-2">
              {sabores.map((s) => (
                <button key={s.id} onClick={() => setSabor(s.nome)}
                  className={"px-3 py-1.5 text-sm rounded-full border transition-colors " + (sabor === s.nome ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}>
                  {s.nome}
                </button>
              ))}
            </div>
          </div>
        )}

        {adicionais.length > 0 && (
          <div className="space-y-2">
            <Label>Adicionais</Label>
            <div className="space-y-1.5">
              {adicionais.map((a) => (
                <label key={a.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-2 cursor-pointer hover:bg-muted/50">
                  <div className="flex items-center gap-2">
                    <input type="checkbox" checked={!!adicSel[a.id]} onChange={(e) => setAdicSel((s) => ({ ...s, [a.id]: e.target.checked }))} className="size-4 accent-primary" />
                    <span className="text-sm">{a.nome}</span>
                  </div>
                  <span className="text-sm text-muted-foreground">+{brl(a.preco)}</span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label>Quantidade</Label>
            <div className="flex items-center gap-2">
              <Button type="button" variant="outline" size="icon" onClick={() => setQtd((q) => Math.max(1, q - 1))}>−</Button>
              <Input type="number" min={1} value={qtd} onChange={(e) => setQtd(Math.max(1, parseInt(e.target.value) || 1))} className="text-center" />
              <Button type="button" variant="outline" size="icon" onClick={() => setQtd((q) => q + 1)}>+</Button>
            </div>
          </div>
        </div>

        <div>
          <Label>Observações do item</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: sem açúcar, gelado" />
        </div>

        <DialogFooter className="sm:justify-between gap-2">
          <div className="text-lg font-bold">{brl(total)}</div>
          <Button onClick={confirmar} className="bg-primary"><Plus className="mr-1 size-4" /> Adicionar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
