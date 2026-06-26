import { createFileRoute } from "@tanstack/react-router";

import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { brl } from "@/lib/format";
import { toast } from "sonner";
import { ChefHat, Clock, Flame, CheckCircle2, X } from "lucide-react";
import { STATUS_COLOR, STATUS_LABEL, nextStatus, NEXT_LABEL } from "@/lib/pedido-fluxo";

export const Route = createFileRoute("/_authenticated/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha — FitLounge" }] }),
  component: CozinhaPage,
});

type Item = {
  id: string;
  nome_produto: string;
  quantidade: number;
  sabor: string | null;
  adicionais: { nome: string; preco: number }[];
  observacoes: string | null;
};
type Pedido = {
  id: string;
  numero: number;
  data_hora: string;
  total: number;
  status_pedido: string;
  observacoes: string | null;
  cliente: { nome: string; telefone: string | null } | null;
  pedido_itens: Item[];
};

const COLUNAS: { key: string[]; titulo: string; icone: any; tone: string }[] = [
  { key: ["na_cozinha"], titulo: "Na cozinha", icone: ChefHat, tone: "border-orange-500" },
  { key: ["em_producao", "em_preparo"], titulo: "Em produção", icone: Flame, tone: "border-yellow-500" },
  { key: ["pronto"], titulo: "Pronto", icone: CheckCircle2, tone: "border-green-500" },
];

function CozinhaPage() {
  const qc = useQueryClient();

  const { data: pedidos = [], isLoading } = useQuery({
    queryKey: ["cozinha-pedidos"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("id,numero,data_hora,total,status_pedido,observacoes,cliente:clientes(nome,telefone),pedido_itens(id,nome_produto,quantidade,sabor,adicionais,observacoes)")
        .in("status_pedido", ["na_cozinha", "em_producao", "em_preparo", "pronto"])
        .order("data_hora", { ascending: true });
      return (data ?? []) as unknown as Pedido[];
    },
  });

  useEffect(() => {
    const ch = supabase
      .channel("cozinha-pedidos")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        qc.invalidateQueries({ queryKey: ["cozinha-pedidos"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_itens" }, () => {
        qc.invalidateQueries({ queryKey: ["cozinha-pedidos"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function mudarStatus(p: Pedido, novo: string) {
    const { error } = await supabase.from("pedidos").update({ status_pedido: novo as any }).eq("id", p.id);
    if (error) { toast.error(error.message); return; }
    toast.success(`Pedido #${p.numero} → ${STATUS_LABEL[novo]}`);
    qc.invalidateQueries({ queryKey: ["cozinha-pedidos"] });
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <ChefHat className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">Cozinha / Produção</h1>
          <p className="text-sm text-muted-foreground">Atualizado em tempo real · novos pedidos chegam em "Na cozinha"</p>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      <div className="grid lg:grid-cols-3 gap-4">
        {COLUNAS.map(({ key, titulo, icone: Icon, tone }) => {
          const lista = pedidos.filter((p) => key.includes(p.status_pedido));
          return (
            <div key={titulo}>
              <div className="flex items-center justify-between mb-2 px-1">
                <div className="flex items-center gap-2">
                  <Icon className="size-4 text-muted-foreground" />
                  <span className="font-heading font-semibold">{titulo}</span>
                </div>
                <Badge variant="secondary">{lista.length}</Badge>
              </div>
              <div className="space-y-3">
                {lista.length === 0 && (
                  <div className="border border-dashed border-border rounded-lg p-6 text-center text-xs text-muted-foreground">vazio</div>
                )}
                {lista.map((p) => {
                  const idadeMin = (Date.now() - new Date(p.data_hora).getTime()) / 60000;
                  const urgente = idadeMin > 10 && p.status_pedido !== "pronto";
                  const proximo = nextStatus(p.status_pedido as any);
                  return (
                    <Card key={p.id} className={"p-3 border-l-4 " + (urgente ? "border-l-destructive" : tone)}>
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="text-base font-bold">#{p.numero}</div>
                        <Badge variant="outline" className={STATUS_COLOR[p.status_pedido]}>{STATUS_LABEL[p.status_pedido]}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-2">
                        <Clock className="size-3" />
                        {new Date(p.data_hora).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
                        {urgente && <span className="ml-1 text-destructive font-semibold">há {Math.round(idadeMin)}min</span>}
                      </div>
                      {p.cliente && <div className="text-sm font-medium mb-1.5">{p.cliente.nome}</div>}
                      <ul className="space-y-1 text-sm border-y border-border py-1.5 mb-2">
                        {p.pedido_itens.map((it) => (
                          <li key={it.id}>
                            <div className="font-medium">{it.quantidade}× {it.nome_produto}</div>
                            {it.sabor && <div className="text-xs text-muted-foreground pl-3">• {it.sabor}</div>}
                            {Array.isArray(it.adicionais) && it.adicionais.length > 0 && (
                              <div className="text-xs text-muted-foreground pl-3">+ {it.adicionais.map((a) => a.nome).join(", ")}</div>
                            )}
                            {it.observacoes && <div className="text-xs italic text-muted-foreground pl-3">"{it.observacoes}"</div>}
                          </li>
                        ))}
                      </ul>
                      {p.observacoes && <div className="text-xs italic text-muted-foreground mb-2">Obs: {p.observacoes}</div>}
                      <div className="text-xs text-muted-foreground mb-2">{brl(p.total)}</div>
                      <div className="flex gap-1.5">
                        {proximo && (
                          <Button size="sm" className="flex-1" onClick={() => mudarStatus(p, proximo)}>
                            {NEXT_LABEL[p.status_pedido]}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => mudarStatus(p, "cancelado")}>
                          <X className="size-4" />
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
