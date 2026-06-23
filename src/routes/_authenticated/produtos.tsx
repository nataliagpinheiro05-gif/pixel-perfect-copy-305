import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/app-shell";
import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package, Tag, Sparkles, ShieldOff } from "lucide-react";

export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — FitLounge" }] }),
  component: ProdutosPage,
});

type Categoria = { id: string; nome: string; ativo: boolean };
type Sabor = { id: string; nome: string; ativo: boolean };
type Adicional = { id: string; nome: string; preco: number; ativo: boolean };
type Produto = {
  id: string;
  nome: string;
  descricao: string | null;
  categoria_id: string | null;
  preco: number;
  custo: number;
  ativo: boolean;
  aparece_no_pedido: boolean;
  categoria?: { nome: string } | null;
  produto_sabores?: { sabor_id: string }[];
  produto_adicionais?: { adicional_id: string }[];
};

function ProdutosPage() {
  const { isAdmin } = useAuth();

  if (!isAdmin) {
    return (
      <AppShell>
        <div className="text-center py-16 text-muted-foreground">
          <ShieldOff className="size-12 mx-auto mb-3 opacity-50" />
          <p>Acesso restrito ao administrador.</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="flex items-center gap-2 mb-4">
        <Package className="size-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Produtos & Cardápio</h1>
      </div>

      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="categorias">Categorias</TabsTrigger>
          <TabsTrigger value="sabores">Sabores</TabsTrigger>
          <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
        </TabsList>

        <TabsContent value="produtos" className="mt-4"><ProdutosTab /></TabsContent>
        <TabsContent value="categorias" className="mt-4"><CategoriasTab /></TabsContent>
        <TabsContent value="sabores" className="mt-4"><SaboresTab /></TabsContent>
        <TabsContent value="adicionais" className="mt-4"><AdicionaisTab /></TabsContent>
      </Tabs>
    </AppShell>
  );
}

// ─────────────────────────── PRODUTOS ───────────────────────────

function ProdutosTab() {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Produto | null>(null);
  const [open, setOpen] = useState(false);
  const [busca, setBusca] = useState("");

  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-admin"],
    queryFn: async () => {
      const { data } = await supabase
        .from("produtos")
        .select("*, categoria:categorias_produtos(nome), produto_sabores(sabor_id), produto_adicionais(adicional_id)")
        .order("nome");
      return (data ?? []) as unknown as Produto[];
    },
  });

  const filtrados = useMemo(
    () => produtos.filter((p) => !busca || p.nome.toLowerCase().includes(busca.toLowerCase())),
    [produtos, busca]
  );

  async function excluir(p: Produto) {
    if (!confirm(`Excluir "${p.nome}"?`)) return;
    const { error } = await supabase.from("produtos").delete().eq("id", p.id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); qc.invalidateQueries({ queryKey: ["produtos-admin"] }); }
  }

  function novo() { setEditing(null); setOpen(true); }
  function editar(p: Produto) { setEditing(p); setOpen(true); }

  return (
    <>
      <div className="flex gap-2 mb-3">
        <Input placeholder="Buscar produto..." value={busca} onChange={(e) => setBusca(e.target.value)} />
        <Button onClick={novo} className="bg-gold text-gold-foreground hover:bg-gold/90 shrink-0">
          <Plus className="size-4 mr-1" /> Novo produto
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtrados.map((p) => (
          <Card key={p.id} className="p-4">
            <div className="flex items-start justify-between mb-1">
              <div className="font-heading font-semibold">{p.nome}</div>
              <div className="flex gap-1">
                <Button size="icon" variant="ghost" onClick={() => editar(p)}><Pencil className="size-4" /></Button>
                <Button size="icon" variant="ghost" onClick={() => excluir(p)}><Trash2 className="size-4 text-destructive" /></Button>
              </div>
            </div>
            <div className="text-xs text-muted-foreground mb-2">{p.categoria?.nome ?? "Sem categoria"}</div>
            {p.descricao && <p className="text-sm text-muted-foreground mb-2 line-clamp-2">{p.descricao}</p>}
            <div className="flex items-center justify-between">
              <div>
                <div className="text-lg font-bold text-primary">{brl(p.preco)}</div>
                <div className="text-xs text-muted-foreground">custo {brl(p.custo)}</div>
              </div>
              <div className="flex flex-col gap-1 items-end">
                {!p.ativo && <Badge variant="outline" className="text-xs">Inativo</Badge>}
                {!p.aparece_no_pedido && <Badge variant="outline" className="text-xs">Oculto</Badge>}
              </div>
            </div>
          </Card>
        ))}
        {filtrados.length === 0 && <p className="text-center col-span-full py-12 text-muted-foreground">Nenhum produto.</p>}
      </div>

      <ProdutoDialog open={open} onOpenChange={setOpen} produto={editing} />
    </>
  );
}

function ProdutoDialog({ open, onOpenChange, produto }: { open: boolean; onOpenChange: (b: boolean) => void; produto: Produto | null }) {
  const qc = useQueryClient();
  const { data: categorias = [] } = useQuery({
    queryKey: ["categorias-all"],
    queryFn: async () => (await supabase.from("categorias_produtos").select("*").order("nome")).data ?? [],
  });
  const { data: sabores = [] } = useQuery({
    queryKey: ["sabores-all"],
    queryFn: async () => (await supabase.from("sabores").select("*").order("nome")).data ?? [],
  });
  const { data: adicionais = [] } = useQuery({
    queryKey: ["adicionais-all"],
    queryFn: async () => (await supabase.from("adicionais").select("*").order("nome")).data ?? [],
  });

  const [form, setForm] = useState({
    nome: "", descricao: "", categoria_id: "", preco: "0", custo: "0",
    ativo: true, aparece_no_pedido: true,
    sabores: [] as string[], adicionais: [] as string[],
  });

  function reset() {
    if (produto) {
      setForm({
        nome: produto.nome, descricao: produto.descricao ?? "",
        categoria_id: produto.categoria_id ?? "", preco: String(produto.preco), custo: String(produto.custo),
        ativo: produto.ativo, aparece_no_pedido: produto.aparece_no_pedido,
        sabores: (produto.produto_sabores ?? []).map((s) => s.sabor_id),
        adicionais: (produto.produto_adicionais ?? []).map((a) => a.adicional_id),
      });
    } else {
      setForm({ nome: "", descricao: "", categoria_id: "", preco: "0", custo: "0", ativo: true, aparece_no_pedido: true, sabores: [], adicionais: [] });
    }
  }

  // sync when dialog opens
  useMemo(() => { if (open) reset(); /* eslint-disable-next-line */ }, [open, produto?.id]);

  async function salvar() {
    if (!form.nome.trim()) { toast.error("Nome obrigatório"); return; }
    const payload = {
      nome: form.nome.trim(),
      descricao: form.descricao || null,
      categoria_id: form.categoria_id || null,
      preco: Number(form.preco) || 0,
      custo: Number(form.custo) || 0,
      ativo: form.ativo,
      aparece_no_pedido: form.aparece_no_pedido,
    };
    let prodId = produto?.id;
    if (produto) {
      const { error } = await supabase.from("produtos").update(payload).eq("id", produto.id);
      if (error) { toast.error(error.message); return; }
    } else {
      const { data, error } = await supabase.from("produtos").insert(payload).select("id").single();
      if (error || !data) { toast.error(error?.message ?? "Erro"); return; }
      prodId = data.id;
    }
    // sync sabores
    await supabase.from("produto_sabores").delete().eq("produto_id", prodId!);
    if (form.sabores.length) {
      await supabase.from("produto_sabores").insert(form.sabores.map((sid) => ({ produto_id: prodId!, sabor_id: sid })));
    }
    // sync adicionais
    await supabase.from("produto_adicionais").delete().eq("produto_id", prodId!);
    if (form.adicionais.length) {
      await supabase.from("produto_adicionais").insert(form.adicionais.map((aid) => ({ produto_id: prodId!, adicional_id: aid })));
    }
    toast.success(produto ? "Atualizado" : "Produto criado");
    qc.invalidateQueries({ queryKey: ["produtos-admin"] });
    qc.invalidateQueries({ queryKey: ["produtos-novo-pedido"] });
    onOpenChange(false);
  }

  function toggleArr(key: "sabores" | "adicionais", id: string) {
    setForm((f) => ({ ...f, [key]: f[key].includes(id) ? f[key].filter((x) => x !== id) : [...f[key], id] }));
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{produto ? "Editar produto" : "Novo produto"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div><Label>Nome*</Label><Input value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></div>
          <div><Label>Descrição</Label><Textarea value={form.descricao} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></div>
          <div className="grid sm:grid-cols-3 gap-3">
            <div>
              <Label>Categoria</Label>
              <Select value={form.categoria_id || "none"} onValueChange={(v) => setForm({ ...form, categoria_id: v === "none" ? "" : v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— sem categoria —</SelectItem>
                  {categorias.map((c: any) => <SelectItem key={c.id} value={c.id}>{c.nome}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Preço (R$)</Label><Input type="number" step="0.01" value={form.preco} onChange={(e) => setForm({ ...form, preco: e.target.value })} /></div>
            <div><Label>Custo (R$)</Label><Input type="number" step="0.01" value={form.custo} onChange={(e) => setForm({ ...form, custo: e.target.value })} /></div>
          </div>

          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.ativo} onCheckedChange={(v) => setForm({ ...form, ativo: v })} /> Ativo</label>
            <label className="flex items-center gap-2 text-sm"><Switch checked={form.aparece_no_pedido} onCheckedChange={(v) => setForm({ ...form, aparece_no_pedido: v })} /> Aparece no pedido</label>
          </div>

          <div>
            <Label className="mb-1.5 block">Sabores disponíveis</Label>
            <div className="flex flex-wrap gap-1.5">
              {sabores.map((s: any) => (
                <Button key={s.id} type="button" size="sm" variant={form.sabores.includes(s.id) ? "default" : "outline"} onClick={() => toggleArr("sabores", s.id)}>
                  {s.nome}
                </Button>
              ))}
              {sabores.length === 0 && <p className="text-xs text-muted-foreground">Cadastre sabores na aba Sabores.</p>}
            </div>
          </div>
          <div>
            <Label className="mb-1.5 block">Adicionais disponíveis</Label>
            <div className="flex flex-wrap gap-1.5">
              {adicionais.map((a: any) => (
                <Button key={a.id} type="button" size="sm" variant={form.adicionais.includes(a.id) ? "default" : "outline"} onClick={() => toggleArr("adicionais", a.id)}>
                  {a.nome} <span className="ml-1 text-xs opacity-70">+{brl(a.preco)}</span>
                </Button>
              ))}
              {adicionais.length === 0 && <p className="text-xs text-muted-foreground">Cadastre adicionais na aba Adicionais.</p>}
            </div>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button onClick={salvar} className="bg-primary">Salvar</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ───────────────── Simple CRUDs (categorias / sabores / adicionais) ─────────────────

function SimpleListCRUD<T extends { id: string; nome: string; ativo: boolean }>({
  table, queryKey, titulo, icone: Icon, extraField,
}: {
  table: "categorias_produtos" | "sabores" | "adicionais";
  queryKey: string;
  titulo: string;
  icone: any;
  extraField?: { key: "preco"; label: string };
}) {
  const qc = useQueryClient();
  const [novo, setNovo] = useState("");
  const [novoExtra, setNovoExtra] = useState("0");
  const { data: lista = [] } = useQuery({
    queryKey: [queryKey],
    queryFn: async () => (await supabase.from(table).select("*").order("nome")).data ?? [],
  });

  async function adicionar() {
    if (!novo.trim()) return;
    const payload: any = { nome: novo.trim() };
    if (extraField) payload[extraField.key] = Number(novoExtra) || 0;
    const { error } = await supabase.from(table).insert(payload);
    if (error) toast.error(error.message);
    else { setNovo(""); setNovoExtra("0"); qc.invalidateQueries({ queryKey: [queryKey] }); }
  }
  async function toggleAtivo(item: any) {
    const { error } = await supabase.from(table).update({ ativo: !item.ativo }).eq("id", item.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: [queryKey] });
  }
  async function renomear(item: any) {
    const novoNome = prompt("Novo nome:", item.nome);
    if (!novoNome) return;
    const { error } = await supabase.from(table).update({ nome: novoNome.trim() }).eq("id", item.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: [queryKey] });
  }
  async function editarPreco(item: any) {
    const v = prompt("Novo preço (R$):", String(item.preco));
    if (v == null) return;
    const { error } = await supabase.from(table).update({ preco: Number(v) || 0 }).eq("id", item.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: [queryKey] });
  }
  async function excluir(item: any) {
    if (!confirm(`Excluir "${item.nome}"?`)) return;
    const { error } = await supabase.from(table).delete().eq("id", item.id);
    if (error) toast.error(error.message); else qc.invalidateQueries({ queryKey: [queryKey] });
  }

  return (
    <Card className="p-4">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="size-5 text-primary" />
        <h2 className="font-heading font-semibold">{titulo}</h2>
      </div>
      <div className="flex gap-2 mb-4">
        <Input placeholder={"Novo " + titulo.toLowerCase()} value={novo} onChange={(e) => setNovo(e.target.value)} />
        {extraField && <Input type="number" step="0.01" placeholder="0.00" value={novoExtra} onChange={(e) => setNovoExtra(e.target.value)} className="w-28" />}
        <Button onClick={adicionar}><Plus className="size-4 mr-1" /> Adicionar</Button>
      </div>
      <ul className="divide-y divide-border">
        {lista.map((it: any) => (
          <li key={it.id} className="py-2 flex items-center gap-2">
            <div className="flex-1">
              <span className={it.ativo ? "" : "text-muted-foreground line-through"}>{it.nome}</span>
              {extraField && <span className="ml-2 text-sm text-muted-foreground">{brl(it.preco)}</span>}
            </div>
            <Switch checked={it.ativo} onCheckedChange={() => toggleAtivo(it)} />
            <Button size="icon" variant="ghost" onClick={() => renomear(it)}><Pencil className="size-4" /></Button>
            {extraField && <Button size="sm" variant="ghost" onClick={() => editarPreco(it)}>R$</Button>}
            <Button size="icon" variant="ghost" onClick={() => excluir(it)}><Trash2 className="size-4 text-destructive" /></Button>
          </li>
        ))}
        {lista.length === 0 && <li className="py-6 text-center text-sm text-muted-foreground">Nenhum item.</li>}
      </ul>
    </Card>
  );
}

function CategoriasTab() { return <SimpleListCRUD table="categorias_produtos" queryKey="cat-admin" titulo="Categorias" icone={Tag} />; }
function SaboresTab() { return <SimpleListCRUD table="sabores" queryKey="sab-admin" titulo="Sabores" icone={Sparkles} />; }
function AdicionaisTab() { return <SimpleListCRUD table="adicionais" queryKey="add-admin" titulo="Adicionais" icone={Plus} extraField={{ key: "preco", label: "Preço" }} />; }
