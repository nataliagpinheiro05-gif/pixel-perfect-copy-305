import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { brl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { useConfigLoja } from "@/hooks/use-config-loja";
import {
  ArrowLeft, Plus, Trash2, X, Search, Lock, Receipt, Clock, ChefHat,
  Banknote, Smartphone, CreditCard, Wallet, CheckCircle2,
} from "lucide-react";
import {
  STATUS_COMANDA_COLOR, STATUS_COMANDA_LABEL,
  PREPARO_COLOR, PREPARO_LABEL, MOTIVOS_CANCELAMENTO,
} from "@/lib/pedido-fluxo";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  head: () => ({ meta: [{ title: "Comanda — FitLounge" }] }),
  component: ComandaDetailPage,
});

type Item = {
  id: string;
  produto_id: string | null;
  nome_produto: string;
  quantidade: number;
  preco_unitario: number;
  sabor: string | null;
  adicionais: { nome: string; preco: number }[];
  observacoes: string | null;
  status_preparo: string;
  envia_para_cozinha: boolean;
  subtotal: number;
  rodada: number;
  motivo_cancelamento: string | null;
};

function ComandaDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [addOpen, setAddOpen] = useState(false);
  const [fecharOpen, setFecharOpen] = useState(false);

  const { data: comanda } = useQuery({
    queryKey: ["comanda", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*, cliente:clientes(id,nome,telefone), pedido_itens(*)")
        .eq("id", id).maybeSingle();
      return data as any;
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("comanda-" + id)
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_itens", filter: `pedido_id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["comanda", id] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos", filter: `id=eq.${id}` }, () => {
        qc.invalidateQueries({ queryKey: ["comanda", id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [id, qc]);

  if (!comanda) return <p className="text-muted-foreground">Carregando comanda...</p>;

  const status = comanda.status_comanda as string;
  const paga = status === "paga";
  const cancelada = status === "cancelada";
  const bloqueada = paga || cancelada;
  const itens = (comanda.pedido_itens ?? []) as Item[];
  const itensAtivos = itens.filter((i) => i.status_preparo !== "cancelado");
  const subtotal = itensAtivos.reduce((s, i) => s + Number(i.subtotal), 0);
  const clienteNome =
    comanda.cliente?.nome ?? comanda.cliente_nome_rapido ?? "Consumidor balcão";
  const clienteTel = comanda.cliente?.telefone ?? comanda.cliente_telefone_rapido;

  async function cancelarItem(it: Item) {
    if (it.status_preparo === "novo") {
      if (!confirm(`Remover ${it.nome_produto}?`)) return;
      const { error } = await supabase.rpc("cancelar_item_comanda", { _item_id: it.id, _motivo: (null as any) });
      if (error) toast.error(error.message);
      else { toast.success("Item removido"); qc.invalidateQueries({ queryKey: ["comanda", id] }); }
      return;
    }
    const motivo = prompt(`Motivo do cancelamento de "${it.nome_produto}":\n\n${MOTIVOS_CANCELAMENTO.join(" · ")}`, "");
    if (!motivo) return;
    const { error } = await supabase.rpc("cancelar_item_comanda", { _item_id: it.id, _motivo: motivo });
    if (error) toast.error(error.message);
    else { toast.success("Item cancelado"); qc.invalidateQueries({ queryKey: ["comanda", id] }); }
  }

  async function cancelarComanda() {
    const motivo = prompt("Motivo do cancelamento da comanda:", "");
    if (motivo === null) return;
    const { error } = await supabase.rpc("cancelar_pedido", { _pedido_id: id, _motivo: motivo || undefined });
    if (error) toast.error(error.message);
    else { toast.success("Comanda cancelada"); qc.invalidateQueries({ queryKey: ["comanda", id] }); }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pedidos" as any })}>
          <ArrowLeft className="size-4" />
        </Button>
        <div className="flex-1 min-w-[180px]">
          <div className="flex items-center gap-2">
            <Receipt className="size-5 text-primary" />
            <h1 className="text-2xl font-heading font-bold">Comanda #{comanda.numero}</h1>
            <Badge variant="outline" className={STATUS_COMANDA_COLOR[status]}>{STATUS_COMANDA_LABEL[status]}</Badge>
          </div>
          <p className="text-sm text-muted-foreground flex items-center gap-1.5 mt-0.5">
            <Clock className="size-3.5" />
            Aberta {new Date(comanda.aberta_em ?? comanda.data_hora).toLocaleString("pt-BR")}
            {paga && comanda.pago_em && <> · paga {new Date(comanda.pago_em).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</>}
          </p>
        </div>
        {bloqueada && (
          <Badge variant="outline" className="gap-1"><Lock className="size-3" /> Bloqueada para edição</Badge>
        )}
      </div>

      <div className="grid md:grid-cols-[1fr_340px] gap-4">
        {/* Itens */}
        <Card className="p-4">
          <div className="flex items-center justify-between mb-3">
            <div>
              <div className="text-sm text-muted-foreground">Cliente</div>
              <div className="font-medium">
                {clienteNome}
                {clienteTel && <span className="text-muted-foreground text-sm"> — {clienteTel}</span>}
              </div>
            </div>
            {!bloqueada && (
              <Button size="sm" onClick={() => setAddOpen(true)} className="bg-gold text-gold-foreground hover:bg-gold/90">
                <Plus className="size-4 mr-1" /> Adicionar produto
              </Button>
            )}
          </div>

          <div className="text-sm font-semibold mb-2 flex items-center gap-2">Itens <Badge variant="secondary">{itensAtivos.length}</Badge></div>

          {itensAtivos.length === 0 && (
            <div className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">
              Comanda sem itens ainda. Clique em <strong>Adicionar produto</strong>.
            </div>
          )}

          <ul className="divide-y divide-border">
            {itens.map((it) => {
              const cancelado = it.status_preparo === "cancelado";
              return (
                <li key={it.id} className={"py-2.5 " + (cancelado ? "opacity-50" : "")}>
                  <div className="flex justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <div className={"font-medium " + (cancelado ? "line-through" : "")}>{it.quantidade}× {it.nome_produto}</div>
                        {it.envia_para_cozinha && !cancelado && (
                          <Badge variant="outline" className={PREPARO_COLOR[it.status_preparo]}>
                            <ChefHat className="size-3 mr-1" />
                            {PREPARO_LABEL[it.status_preparo]}
                          </Badge>
                        )}
                        {cancelado && <Badge variant="outline" className={PREPARO_COLOR.cancelado}>Cancelado</Badge>}
                        <Badge variant="secondary" className="text-[10px]">Rod. {it.rodada}</Badge>
                      </div>
                      {it.sabor && <div className="text-xs text-muted-foreground">Sabor: {it.sabor}</div>}
                      {Array.isArray(it.adicionais) && it.adicionais.length > 0 && (
                        <div className="text-xs text-muted-foreground">+ {it.adicionais.map((a) => a.nome).join(", ")}</div>
                      )}
                      {it.observacoes && <div className="text-xs italic text-muted-foreground">"{it.observacoes}"</div>}
                      {it.motivo_cancelamento && (
                        <div className="text-xs text-destructive mt-0.5">Motivo: {it.motivo_cancelamento}</div>
                      )}
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{brl(it.subtotal)}</div>
                      {!bloqueada && !cancelado && (
                        <button onClick={() => cancelarItem(it)} className="text-xs text-destructive flex items-center gap-1 mt-1 ml-auto">
                          <X className="size-3" /> {it.status_preparo === "novo" ? "Remover" : "Cancelar"}
                        </button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>

          {comanda.observacoes && (
            <div className="mt-3 text-sm border-t border-border pt-3">
              <span className="font-semibold">Obs:</span> {comanda.observacoes}
            </div>
          )}
        </Card>

        {/* Resumo / ações */}
        <div className="space-y-3 h-fit">
          <Card className="p-4 space-y-2">
            <div className="flex justify-between text-sm"><span className="text-muted-foreground">Subtotal</span><span>{brl(subtotal)}</span></div>
            {Number(comanda.desconto) > 0 && (
              <div className="flex justify-between text-sm"><span className="text-muted-foreground">Desconto</span><span>-{brl(comanda.desconto)}</span></div>
            )}
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-border">
              <span>Total</span>
              <span className="text-primary">{brl(comanda.total)}</span>
            </div>
            {paga && (
              <div className="text-xs text-muted-foreground pt-2 border-t border-border">
                <div>Forma: <span className="text-foreground capitalize">{comanda.forma_pagamento ?? "—"}</span></div>
                {comanda.valor_recebido != null && <div>Recebido: {brl(comanda.valor_recebido)}</div>}
                {Number(comanda.troco) > 0 && <div>Troco: {brl(comanda.troco)}</div>}
              </div>
            )}
          </Card>

          {!bloqueada && (
            <>
              <Button
                className="w-full h-12 bg-gold text-gold-foreground hover:bg-gold/90 text-base"
                disabled={itensAtivos.length === 0}
                onClick={() => setFecharOpen(true)}
              >
                Fechar conta
              </Button>
              <Button variant="outline" className="w-full" onClick={cancelarComanda}>
                <X className="size-4 mr-1" /> Cancelar comanda
              </Button>
            </>
          )}
          {paga && (
            <>
              <Card className="p-3 bg-green-500/10 border-green-500/40">
                <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
                  <CheckCircle2 className="size-5" /> Comanda paga
                </div>
              </Card>
              {isAdmin && (
                <Button variant="outline" className="w-full" onClick={async () => {
                  const motivo = prompt("Motivo da reabertura (obrigatório):");
                  if (!motivo) return;
                  const { error } = await supabase.rpc("reabrir_comanda", { _pedido_id: id, _motivo: motivo });
                  if (error) toast.error(error.message);
                  else { toast.success("Comanda reaberta — estoque devolvido e financeiro estornado"); qc.invalidateQueries({ queryKey: ["comanda", id] }); }
                }}>
                  Reabrir comanda
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {addOpen && (
        <AdicionarProdutoDialog
          pedidoId={id}
          onClose={() => setAddOpen(false)}
          onAdded={() => qc.invalidateQueries({ queryKey: ["comanda", id] })}
        />
      )}
      {fecharOpen && (
        <FecharContaDialog
          pedidoId={id}
          numero={comanda.numero}
          subtotal={subtotal}
          descontoAtual={Number(comanda.desconto) || 0}
          onClose={() => setFecharOpen(false)}
          onClosed={() => { setFecharOpen(false); qc.invalidateQueries({ queryKey: ["comanda", id] }); }}
        />
      )}
    </>
  );
}

// ─────────────────────────── ADICIONAR PRODUTO ───────────────────────────

type ProdutoLista = {
  id: string;
  nome: string;
  preco: number;
  categoria_id: string | null;
  envia_para_cozinha: boolean;
  permite_sabor: boolean;
  permite_adicionais: boolean;
  categoria?: { nome: string } | null;
  produto_sabores: { sabores: { id: string; nome: string } }[];
  produto_adicionais: { adicionais: { id: string; nome: string; preco: number } }[];
};

function AdicionarProdutoDialog({ pedidoId, onClose, onAdded }: { pedidoId: string; onClose: () => void; onAdded: () => void }) {
  const [busca, setBusca] = useState("");
  const [catSel, setCatSel] = useState<string>("todas");
  const [selecionado, setSelecionado] = useState<ProdutoLista | null>(null);

  const { data: categorias = [] } = useQuery({
    queryKey: ["cats-comanda"],
    queryFn: async () => (await supabase.from("categorias_produtos").select("id,nome").eq("ativo", true).order("nome")).data ?? [],
  });

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-comanda"],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("id,nome,preco,categoria_id,envia_para_cozinha,permite_sabor,permite_adicionais,categoria:categorias_produtos(nome),produto_sabores(sabores(id,nome)),produto_adicionais(adicionais(id,nome,preco))")
        .eq("ativo", true).eq("aparece_no_pedido", true).order("nome");
      return (data ?? []) as unknown as ProdutoLista[];
    },
  });

  const filtrados = useMemo(
    () => produtos.filter((p) =>
      (catSel === "todas" || p.categoria_id === catSel) &&
      (!busca || p.nome.toLowerCase().includes(busca.toLowerCase()))),
    [produtos, busca, catSel]
  );

  if (selecionado) {
    return (
      <ItemConfigDialog
        produto={selecionado}
        pedidoId={pedidoId}
        onBack={() => setSelecionado(null)}
        onClose={onClose}
        onAdded={onAdded}
      />
    );
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>Adicionar produto</DialogTitle>
          <DialogDescription>Escolha um produto. Você pode decidir se ele vai para a cozinha na próxima etapa.</DialogDescription>
        </DialogHeader>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
            <Input className="pl-8" placeholder="Buscar produto..." value={busca} onChange={(e) => setBusca(e.target.value)} autoFocus />
          </div>
          <Select value={catSel} onValueChange={setCatSel}>
            <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todas categorias</SelectItem>
              {categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 overflow-y-auto">
          {filtrados.map((p) => (
            <button key={p.id} onClick={() => setSelecionado(p)}
              className="text-left rounded-xl border border-border p-3 hover:border-primary hover:bg-primary/5 transition-colors">
              <div className="text-[11px] text-muted-foreground uppercase tracking-wide flex items-center gap-1">
                {p.categoria?.nome ?? ""}
                {p.envia_para_cozinha && <ChefHat className="size-3" />}
              </div>
              <div className="font-medium text-sm leading-tight mt-0.5 line-clamp-2">{p.nome}</div>
              <div className="mt-2 text-primary font-semibold">{brl(p.preco)}</div>
            </button>
          ))}
          {filtrados.length === 0 && <div className="col-span-full text-center text-sm text-muted-foreground py-8">Nenhum produto.</div>}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ItemConfigDialog({ produto, pedidoId, onBack, onClose, onAdded }: {
  produto: ProdutoLista; pedidoId: string; onBack: () => void; onClose: () => void; onAdded: () => void;
}) {
  const sabores = produto.produto_sabores.map((ps) => ps.sabores).filter(Boolean);
  const adicionais = produto.produto_adicionais.map((pa) => pa.adicionais).filter(Boolean);
  const [sabor, setSabor] = useState<string | null>(sabores[0]?.nome ?? null);
  const [adicSel, setAdicSel] = useState<Record<string, boolean>>({});
  const [qtd, setQtd] = useState(1);
  const [obs, setObs] = useState("");
  const [enviaCozinha, setEnviaCozinha] = useState<boolean>(produto.envia_para_cozinha);
  const [saving, setSaving] = useState(false);

  const addList = adicionais.filter((a) => adicSel[a.id]).map((a) => ({ nome: a.nome, preco: Number(a.preco) }));
  const total = (Number(produto.preco) + addList.reduce((s, a) => s + a.preco, 0)) * qtd;

  async function adicionar() {
    setSaving(true);
    const { error } = await supabase.rpc("adicionar_item_comanda", {
      _pedido_id: pedidoId,
      _produto_id: produto.id,
      _quantidade: qtd,
      _sabor: (sabor || null) as any,
      _adicionais: addList as any,
      _observacoes: (obs || null) as any,
      _envia_para_cozinha: enviaCozinha as any,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(enviaCozinha ? "Item adicionado e enviado para cozinha." : "Item adicionado à comanda sem enviar para cozinha.");
    onAdded();
    onClose();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{produto.nome}</DialogTitle>
          <div className="text-sm text-muted-foreground flex items-center gap-2">
            {brl(produto.preco)}
            {produto.envia_para_cozinha && <Badge variant="outline"><ChefHat className="size-3 mr-1" /> vai para cozinha</Badge>}
          </div>
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

        <div>
          <Label>Quantidade</Label>
          <div className="flex items-center gap-2">
            <Button type="button" variant="outline" size="icon" onClick={() => setQtd((q) => Math.max(1, q - 1))}>−</Button>
            <Input type="number" min={1} value={qtd} onChange={(e) => setQtd(Math.max(1, parseInt(e.target.value) || 1))} className="text-center w-24" />
            <Button type="button" variant="outline" size="icon" onClick={() => setQtd((q) => q + 1)}>+</Button>
          </div>
        </div>

        <div>
          <Label>Observações do item</Label>
          <Textarea value={obs} onChange={(e) => setObs(e.target.value)} placeholder="Ex.: sem açúcar, gelado" />
        </div>

        <div className="space-y-2 rounded-lg border border-border p-3">
          <Label>Enviar este item para a cozinha?</Label>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setEnviaCozinha(true)}
              className={"flex items-center gap-2 px-3 py-2 text-sm rounded-lg border transition-colors " + (enviaCozinha ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}
            >
              <ChefHat className="size-4" /> Sim, enviar para cozinha
            </button>
            <button
              type="button"
              onClick={() => setEnviaCozinha(false)}
              className={"px-3 py-2 text-sm rounded-lg border transition-colors " + (!enviaCozinha ? "bg-primary text-primary-foreground border-primary" : "border-border hover:bg-muted")}
            >
              Não, apenas adicionar na comanda
            </button>
          </div>
        </div>

        <DialogFooter className="sm:justify-between gap-2 flex-wrap">
          <Button variant="ghost" onClick={onBack}>← Voltar</Button>
          <div className="flex items-center gap-3">
            <div className="text-lg font-bold">{brl(total)}</div>
            <Button onClick={adicionar} disabled={saving} className="bg-gold text-gold-foreground hover:bg-gold/90">
              <Plus className="mr-1 size-4" /> {saving ? "Adicionando..." : "Adicionar à comanda"}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ─────────────────────────── FECHAR CONTA (pagamento único/misto/parcial) ───────────────────────────

type Forma = "pix" | "dinheiro" | "debito" | "credito";
const FORMAS: { value: Forma; label: string; icon: any }[] = [
  { value: "pix", label: "Pix", icon: Smartphone },
  { value: "dinheiro", label: "Dinheiro", icon: Banknote },
  { value: "debito", label: "Débito", icon: CreditCard },
  { value: "credito", label: "Crédito", icon: Wallet },
];

type Linha = { id: string; forma: Forma; valor: string; recebido: string; obs: string };

function FecharContaDialog({ pedidoId, numero, subtotal, descontoAtual, onClose, onClosed }: {
  pedidoId: string; numero: number; subtotal: number; descontoAtual: number;
  onClose: () => void; onClosed: () => void;
}) {
  const { formasAtivas } = useConfigLoja();
  const formasDisponiveis = useMemo(
    () => FORMAS.filter(f => formasAtivas.length === 0 || formasAtivas.includes(f.value)),
    [formasAtivas]
  );
  const formaPadrao: Forma = (formasDisponiveis[0]?.value ?? "pix");
  const [desconto, setDesconto] = useState<string>(String(descontoAtual || 0));
  const [linhas, setLinhas] = useState<Linha[]>([
    { id: crypto.randomUUID(), forma: formaPadrao, valor: "", recebido: "", obs: "" },
  ]);
  const [saving, setSaving] = useState(false);

  const { data: pagamentosPrev = [] } = useQuery({
    queryKey: ["pagamentos-pedido", pedidoId],
    queryFn: async () => {
      const { data } = await supabase.from("pedido_pagamentos")
        .select("id,forma_pagamento,valor,troco,created_at,status")
        .eq("pedido_id", pedidoId).eq("status", "confirmado")
        .order("created_at", { ascending: true });
      return data ?? [];
    },
  });

  const total = Math.max(subtotal - (Number(desconto) || 0), 0);
  const jaPago = pagamentosPrev.reduce((s, p: any) => s + Number(p.valor), 0);
  const restanteAntes = Math.max(total - jaPago, 0);
  const somaNovos = linhas.reduce((s, l) => s + (Number(l.valor) || 0), 0);
  const restanteApos = Math.max(restanteAntes - somaNovos, 0);
  const trocoTotal = linhas.reduce((s, l) => {
    const v = Number(l.valor) || 0;
    const r = Number(l.recebido) || 0;
    return s + (l.forma === "dinheiro" && r > v ? r - v : 0);
  }, 0);

  function preencherRestante(idx: number) {
    setLinhas(arr => arr.map((l, i) => i === idx ? { ...l, valor: restanteAntes.toFixed(2) } : l));
  }

  function adicionar() {
    setLinhas(arr => [...arr, { id: crypto.randomUUID(), forma: "dinheiro", valor: "", recebido: "", obs: "" }]);
  }

  function remover(id: string) {
    setLinhas(arr => arr.filter(l => l.id !== id));
  }

  async function registrar(modo: "completo" | "parcial") {
    const pagamentos = linhas
      .filter(l => Number(l.valor) > 0)
      .map(l => ({
        forma: l.forma,
        valor: Number(l.valor),
        valor_recebido: l.forma === "dinheiro" && Number(l.recebido) > 0 ? Number(l.recebido) : Number(l.valor),
        observacoes: l.obs || undefined,
      }));
    if (pagamentos.length === 0) { toast.error("Adicione ao menos um pagamento."); return; }
    if (modo === "completo" && Math.abs(somaNovos - restanteAntes) > 0.005) {
      toast.error(`Soma dos pagamentos (${brl(somaNovos)}) não bate com o restante (${brl(restanteAntes)})`);
      return;
    }

    setSaving(true);
    // Aplica desconto/total antes de registrar pagamento
    if (Number(desconto) !== descontoAtual) {
      const { error } = await supabase.from("pedidos").update({ desconto: Number(desconto) || 0 }).eq("id", pedidoId);
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    const { error } = await supabase.rpc("registrar_pagamento_comanda", {
      _pedido_id: pedidoId,
      _pagamentos: pagamentos as any,
    });
    setSaving(false);
    if (error) { toast.error(error.message); return; }
    toast.success(modo === "completo"
      ? `Comanda #${numero} paga — pagamento registrado`
      : `Pagamento parcial registrado em #${numero}`);
    onClosed();
  }

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Fechar conta · Comanda #{numero}</DialogTitle>
          <DialogDescription>
            Pagamento feito fora do app. Registre uma ou mais formas. Soma deve bater com o total da comanda.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="rounded-lg border border-border p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{brl(subtotal)}</span></div>
            <div className="flex justify-between items-center">
              <span className="text-muted-foreground">Desconto (R$)</span>
              <Input type="number" step="0.01" value={desconto} onChange={(e) => setDesconto(e.target.value)} className="w-28 h-8 text-right" />
            </div>
            <div className="flex justify-between text-lg font-bold pt-1 border-t border-border">
              <span>Total da comanda</span>
              <span className="text-primary">{brl(total)}</span>
            </div>
            {jaPago > 0 && (
              <>
                <div className="flex justify-between text-sm pt-1 border-t border-border"><span className="text-muted-foreground">Já recebido</span><span className="text-green-700 font-semibold">{brl(jaPago)}</span></div>
                <div className="flex justify-between text-sm"><span className="text-muted-foreground">Restante</span><span className="text-amber-700 font-semibold">{brl(restanteAntes)}</span></div>
              </>
            )}
          </div>

          {pagamentosPrev.length > 0 && (
            <Card className="p-3 text-xs">
              <div className="font-semibold mb-1">Pagamentos anteriores</div>
              <ul className="space-y-0.5">
                {pagamentosPrev.map((p: any) => (
                  <li key={p.id} className="flex justify-between">
                    <span className="capitalize">{p.forma_pagamento} · {new Date(p.created_at).toLocaleString("pt-BR", { hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="font-semibold">{brl(p.valor)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <Label>Novos pagamentos</Label>
              <Button type="button" variant="outline" size="sm" onClick={adicionar}><Plus className="size-3 mr-1" /> Adicionar forma</Button>
            </div>
            <ul className="space-y-2">
              {linhas.map((l, idx) => (
                <li key={l.id} className="rounded-lg border border-border p-2 space-y-2">
                  <div className="grid grid-cols-4 gap-1.5">
                    {FORMAS.map((f) => {
                      const Icon = f.icon; const ativo = l.forma === f.value;
                      return (
                        <button key={f.value} onClick={() => setLinhas(arr => arr.map((x, i) => i === idx ? { ...x, forma: f.value } : x))}
                          className={"flex items-center justify-center gap-1 rounded-md border p-1.5 text-xs font-medium transition-colors " +
                            (ativo ? "border-gold bg-gold/10 text-gold-foreground" : "border-border hover:border-primary/40")}>
                          <Icon className="size-3" /> {f.label}
                        </button>
                      );
                    })}
                  </div>
                  <div className="grid grid-cols-[1fr_1fr_auto] gap-2 items-end">
                    <div>
                      <Label className="text-xs">Valor *</Label>
                      <div className="flex gap-1">
                        <Input type="number" step="0.01" value={l.valor}
                          onChange={(e) => setLinhas(arr => arr.map((x, i) => i === idx ? { ...x, valor: e.target.value } : x))}
                          placeholder="0,00" />
                        <Button type="button" variant="outline" size="sm" className="shrink-0" onClick={() => preencherRestante(idx)} title="Preencher com o restante">
                          {brl(restanteAntes)}
                        </Button>
                      </div>
                    </div>
                    {l.forma === "dinheiro" ? (
                      <div>
                        <Label className="text-xs">Recebido (p/ troco)</Label>
                        <Input type="number" step="0.01" value={l.recebido}
                          onChange={(e) => setLinhas(arr => arr.map((x, i) => i === idx ? { ...x, recebido: e.target.value } : x))}
                          placeholder={l.valor || "0,00"} />
                      </div>
                    ) : <div />}
                    {linhas.length > 1 && (
                      <Button type="button" variant="ghost" size="icon" onClick={() => remover(l.id)} className="text-destructive">
                        <Trash2 className="size-4" />
                      </Button>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-lg bg-muted/40 p-3 text-sm space-y-1">
            <div className="flex justify-between"><span className="text-muted-foreground">Soma dos novos pagamentos</span><span className="font-semibold">{brl(somaNovos)}</span></div>
            {trocoTotal > 0 && <div className="flex justify-between"><span className="text-muted-foreground">Troco</span><span>{brl(trocoTotal)}</span></div>}
            <div className="flex justify-between"><span className="text-muted-foreground">Restante após registro</span>
              <span className={"font-semibold " + (restanteApos < 0.005 ? "text-green-700" : "text-amber-700")}>{brl(restanteApos)}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancelar</Button>
          <Button variant="outline" onClick={() => registrar("parcial")} disabled={saving || somaNovos <= 0}>
            Registrar parcial
          </Button>
          <Button onClick={() => registrar("completo")} disabled={saving || somaNovos <= 0} className="bg-gold text-gold-foreground hover:bg-gold/90">
            <CheckCircle2 className="size-4 mr-1" /> {saving ? "Registrando..." : "Confirmar e fechar comanda"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

