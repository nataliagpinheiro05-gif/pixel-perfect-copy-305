import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { Blocks, Plus, Trash2 } from "lucide-react";
import { Navigate } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/composicao")({
  head: () => ({ meta: [{ title: "Composição — FitLounge" }] }),
  component: ComposicaoPage,
});

function ComposicaoPage() {
  const { isAdmin } = useAuth();
  if (!isAdmin) return <Navigate to="/" />;
  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <Blocks className="size-6 text-primary" />
        <h1 className="text-2xl font-heading font-bold">Composição</h1>
      </div>
      <Tabs defaultValue="produtos">
        <TabsList>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="adicionais">Adicionais</TabsTrigger>
        </TabsList>
        <TabsContent value="produtos" className="mt-4"><ProdutosComposicao /></TabsContent>
        <TabsContent value="adicionais" className="mt-4"><AdicionaisComposicao /></TabsContent>
      </Tabs>
    </>
  );
}

function useItens() {
  return useQuery({
    queryKey: ["estoque-min"],
    queryFn: async () => {
      const { data } = await supabase.from("estoque_itens").select("id,nome,unidade_medida").eq("ativo", true).order("nome");
      return data ?? [];
    },
  });
}

function ProdutosComposicao() {
  const qc = useQueryClient();
  const [busca, setBusca] = useState("");
  const { data: produtos = [] } = useQuery({
    queryKey: ["produtos-comp"],
    queryFn: async () => {
      const { data } = await supabase.from("produtos").select("id,nome,categoria_id,ativo,controla_estoque").order("nome");
      return data ?? [];
    },
  });
  const [selId, setSelId] = useState<string | null>(null);
  const filtrados = produtos.filter(p => p.nome.toLowerCase().includes(busca.toLowerCase()));
  const selecionado = produtos.find(p => p.id === selId) ?? filtrados[0];

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      <Card className="p-3 max-h-[70vh] overflow-y-auto">
        <Input placeholder="Buscar produto..." value={busca} onChange={e => setBusca(e.target.value)} className="mb-2" />
        <ul className="space-y-1">
          {filtrados.map(p => (
            <li key={p.id}>
              <button
                className={"w-full text-left px-2 py-2 rounded-md text-sm hover:bg-muted " + (selecionado?.id === p.id ? "bg-muted font-semibold" : "")}
                onClick={() => setSelId(p.id)}
              >
                {p.nome}
                {!p.controla_estoque && <Badge variant="outline" className="ml-2 text-[10px]">sem estoque</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </Card>
      {selecionado && <ProdutoComposicaoEditor produtoId={selecionado.id} nome={selecionado.nome}
        controla={selecionado.controla_estoque}
        onChanged={() => qc.invalidateQueries({ queryKey: ["produtos-comp"] })} />}
    </div>
  );
}

function ProdutoComposicaoEditor({ produtoId, nome, controla, onChanged }: { produtoId: string; nome: string; controla: boolean; onChanged: () => void }) {
  const { data: itens = [] } = useItens();
  const { data: comp = [], refetch } = useQuery({
    queryKey: ["produto-comp", produtoId],
    queryFn: async () => {
      const { data } = await supabase.from("produto_composicao")
        .select("id,estoque_item_id,quantidade_por_unidade,unidade_medida,obrigatorio,ativo,estoque_itens(nome,unidade_medida)")
        .eq("produto_id", produtoId);
      return (data ?? []) as any[];
    },
  });
  const [novo, setNovo] = useState({ item: "", qtd: 1, obrig: true });

  async function adicionar() {
    if (!novo.item) { toast.error("Selecione o item"); return; }
    const { error } = await supabase.from("produto_composicao").insert({
      produto_id: produtoId, estoque_item_id: novo.item,
      quantidade_por_unidade: novo.qtd, obrigatorio: novo.obrig, ativo: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Adicionado"); setNovo({ item: "", qtd: 1, obrig: true }); refetch();
  }
  async function remover(id: string) {
    const { error } = await supabase.from("produto_composicao").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    refetch();
  }
  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("produto_composicao").update({ ativo }).eq("id", id);
    refetch();
  }
  async function setControla(v: boolean) {
    await supabase.from("produtos").update({ controla_estoque: v }).eq("id", produtoId);
    onChanged();
  }

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <div>
          <div className="text-xs text-muted-foreground">Produto</div>
          <h2 className="text-lg font-semibold">{nome}</h2>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Switch checked={controla} onCheckedChange={setControla} />
          Controla estoque
        </label>
      </div>

      <table className="w-full text-sm mb-4">
        <thead className="text-xs uppercase text-muted-foreground border-b border-border">
          <tr><th className="text-left py-2">Item</th><th className="text-right">Qtd</th><th>Un</th><th>Obrig.</th><th>Ativo</th><th></th></tr>
        </thead>
        <tbody>
          {comp.map((c: any) => (
            <tr key={c.id} className="border-b border-border">
              <td className="py-2">{c.estoque_itens?.nome}</td>
              <td className="text-right">{c.quantidade_por_unidade}</td>
              <td className="text-muted-foreground">{c.estoque_itens?.unidade_medida}</td>
              <td className="text-center">{c.obrigatorio ? "Sim" : "Opc."}</td>
              <td className="text-center"><Switch checked={c.ativo} onCheckedChange={(v) => toggleAtivo(c.id, v)} /></td>
              <td className="text-right"><Button size="icon" variant="ghost" className="size-8" onClick={() => remover(c.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
            </tr>
          ))}
          {comp.length === 0 && <tr><td colSpan={6} className="text-center py-6 text-muted-foreground">Nenhum item configurado.</td></tr>}
        </tbody>
      </table>

      <div className="grid grid-cols-[1fr_100px_120px_auto] gap-2 items-end pt-3 border-t border-border">
        <div>
          <Label className="text-xs">Item do estoque</Label>
          <Select value={novo.item} onValueChange={v => setNovo({ ...novo, item: v })}>
            <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
            <SelectContent>{itens.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Qtd</Label>
          <Input type="number" step="0.001" value={novo.qtd} onChange={e => setNovo({ ...novo, qtd: Number(e.target.value) })} />
        </div>
        <label className="flex items-center gap-2 text-sm pb-2">
          <Switch checked={novo.obrig} onCheckedChange={v => setNovo({ ...novo, obrig: v })} /> Obrigatório
        </label>
        <Button onClick={adicionar}><Plus className="size-4 mr-1" /> Adicionar</Button>
      </div>
    </Card>
  );
}

function AdicionaisComposicao() {
  const { data: adicionais = [] } = useQuery({
    queryKey: ["adicionais-list"],
    queryFn: async () => {
      const { data } = await supabase.from("adicionais").select("id,nome,ativo").order("nome");
      return data ?? [];
    },
  });
  const [selId, setSelId] = useState<string | null>(null);
  const sel = adicionais.find((a: any) => a.id === selId) ?? adicionais[0];

  return (
    <div className="grid md:grid-cols-[280px_1fr] gap-4">
      <Card className="p-3 max-h-[70vh] overflow-y-auto">
        <ul className="space-y-1">
          {adicionais.map((a: any) => (
            <li key={a.id}>
              <button
                className={"w-full text-left px-2 py-2 rounded-md text-sm hover:bg-muted " + (sel?.id === a.id ? "bg-muted font-semibold" : "")}
                onClick={() => setSelId(a.id)}
              >{a.nome}</button>
            </li>
          ))}
          {adicionais.length === 0 && <li className="text-sm text-muted-foreground p-2">Nenhum adicional cadastrado.</li>}
        </ul>
      </Card>
      {sel && <AdicionalCompEditor adicionalId={sel.id} nome={sel.nome} />}
    </div>
  );
}

function AdicionalCompEditor({ adicionalId, nome }: { adicionalId: string; nome: string }) {
  const { data: itens = [] } = useItens();
  const { data: comp = [], refetch } = useQuery({
    queryKey: ["ad-comp", adicionalId],
    queryFn: async () => {
      const { data } = await supabase.from("adicional_composicao")
        .select("id,estoque_item_id,quantidade_utilizada,ativo,estoque_itens(nome,unidade_medida)")
        .eq("adicional_id", adicionalId);
      return (data ?? []) as any[];
    },
  });
  const [novo, setNovo] = useState({ item: "", qtd: 1 });

  async function adicionar() {
    if (!novo.item) { toast.error("Selecione o item"); return; }
    const { error } = await supabase.from("adicional_composicao").insert({
      adicional_id: adicionalId, nome_adicional: nome,
      estoque_item_id: novo.item, quantidade_utilizada: novo.qtd, ativo: true,
    });
    if (error) { toast.error(error.message); return; }
    toast.success("Adicionado"); setNovo({ item: "", qtd: 1 }); refetch();
  }
  async function remover(id: string) {
    await supabase.from("adicional_composicao").delete().eq("id", id); refetch();
  }
  async function toggleAtivo(id: string, ativo: boolean) {
    await supabase.from("adicional_composicao").update({ ativo }).eq("id", id); refetch();
  }

  return (
    <Card className="p-4">
      <div className="mb-3">
        <div className="text-xs text-muted-foreground">Adicional</div>
        <h2 className="text-lg font-semibold">{nome}</h2>
      </div>
      <table className="w-full text-sm mb-4">
        <thead className="text-xs uppercase text-muted-foreground border-b border-border">
          <tr><th className="text-left py-2">Item</th><th className="text-right">Qtd</th><th>Un</th><th>Ativo</th><th></th></tr>
        </thead>
        <tbody>
          {comp.map((c: any) => (
            <tr key={c.id} className="border-b border-border">
              <td className="py-2">{c.estoque_itens?.nome}</td>
              <td className="text-right">{c.quantidade_utilizada}</td>
              <td className="text-muted-foreground">{c.estoque_itens?.unidade_medida}</td>
              <td className="text-center"><Switch checked={c.ativo} onCheckedChange={v => toggleAtivo(c.id, v)} /></td>
              <td className="text-right"><Button size="icon" variant="ghost" className="size-8" onClick={() => remover(c.id)}><Trash2 className="size-4 text-destructive" /></Button></td>
            </tr>
          ))}
          {comp.length === 0 && <tr><td colSpan={5} className="text-center py-6 text-muted-foreground">Nenhum item configurado.</td></tr>}
        </tbody>
      </table>
      <div className="grid grid-cols-[1fr_100px_auto] gap-2 items-end pt-3 border-t border-border">
        <div>
          <Label className="text-xs">Item</Label>
          <Select value={novo.item} onValueChange={v => setNovo({ ...novo, item: v })}>
            <SelectTrigger><SelectValue placeholder="Escolher..." /></SelectTrigger>
            <SelectContent>{itens.map((i: any) => <SelectItem key={i.id} value={i.id}>{i.nome} ({i.unidade_medida})</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div>
          <Label className="text-xs">Qtd</Label>
          <Input type="number" step="0.001" value={novo.qtd} onChange={e => setNovo({ ...novo, qtd: Number(e.target.value) })} />
        </div>
        <Button onClick={adicionar}><Plus className="size-4 mr-1" /> Adicionar</Button>
      </div>
    </Card>
  );
}
