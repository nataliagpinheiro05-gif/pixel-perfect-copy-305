import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ChefHat, Clock, Flame, CheckCircle2, X, PackageCheck } from "lucide-react";
import { PREPARO_COLOR, PREPARO_LABEL, MOTIVOS_CANCELAMENTO } from "@/lib/pedido-fluxo";

export const Route = createFileRoute("/_authenticated/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha — FitLounge" }] }),
  component: CozinhaPage,
});

type ItemCozinha = {
  id: string;
  pedido_id: string;
  nome_produto: string;
  quantidade: number;
  sabor: string | null;
  adicionais: { nome: string; preco: number }[];
  observacoes: string | null;
  observacoes_cozinha: string | null;
  status_preparo: string;
  enviado_cozinha_em: string | null;
  rodada: number;
  pedido: {
    numero: number;
    status_comanda: string;
    cliente_nome_rapido: string | null;
    cliente: { nome: string; telefone: string | null } | null;
  };
};

const COLUNAS: { keys: string[]; titulo: string; icone: any; tone: string; proximo?: string; proximoLabel?: string }[] = [
  { keys: ["novo"], titulo: "Novos", icone: ChefHat, tone: "border-blue-500", proximo: "em_preparo", proximoLabel: "Iniciar preparo" },
  { keys: ["em_preparo"], titulo: "Em preparo", icone: Flame, tone: "border-yellow-500", proximo: "pronto", proximoLabel: "Marcar como pronto" },
  { keys: ["pronto"], titulo: "Pronto", icone: CheckCircle2, tone: "border-green-500", proximo: "entregue", proximoLabel: "Marcar entregue" },
];

function CozinhaPage() {
  const qc = useQueryClient();

  const { data: itens = [], isLoading } = useQuery({
    queryKey: ["cozinha-itens"],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedido_itens")
        .select("id,pedido_id,nome_produto,quantidade,sabor,adicionais,observacoes,observacoes_cozinha,status_preparo,enviado_cozinha_em,rodada,pedido:pedidos!inner(numero,status_comanda,cliente_nome_rapido,cliente:clientes(nome,telefone))")
        .eq("envia_para_cozinha", true)
        .in("status_preparo", ["novo", "em_preparo", "pronto"])
        .order("enviado_cozinha_em", { ascending: true, nullsFirst: true });
      return (data ?? []) as unknown as ItemCozinha[];
    },
  });

  useEffect(() => {
    const ch = supabase.channel("cozinha-itens")
      .on("postgres_changes", { event: "*", schema: "public", table: "pedido_itens" }, () => {
        qc.invalidateQueries({ queryKey: ["cozinha-itens"] });
      })
      .on("postgres_changes", { event: "*", schema: "public", table: "pedidos" }, () => {
        qc.invalidateQueries({ queryKey: ["cozinha-itens"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [qc]);

  async function avancar(it: ItemCozinha, novo: string) {
    const { error } = await supabase.rpc("avancar_item_preparo", { _item_id: it.id, _novo_status: novo });
    if (error) toast.error(error.message);
    else { toast.success(`#${it.pedido.numero} • ${it.nome_produto} → ${PREPARO_LABEL[novo]}`); qc.invalidateQueries({ queryKey: ["cozinha-itens"] }); }
  }

  async function cancelar(it: ItemCozinha) {
    const motivo = prompt(`Cancelar "${it.nome_produto}". Motivo:\n\n${MOTIVOS_CANCELAMENTO.join(" · ")}`, "");
    if (!motivo) return;
    const { error } = await supabase.rpc("cancelar_item_comanda", { _item_id: it.id, _motivo: motivo });
    if (error) toast.error(error.message);
    else { toast.success("Item cancelado"); qc.invalidateQueries({ queryKey: ["cozinha-itens"] }); }
  }

  return (
    <>
      <div className="flex items-center gap-2 mb-4">
        <ChefHat className="size-6 text-primary" />
        <div>
          <h1 className="text-2xl font-heading font-bold">Cozinha / Produção</h1>
          <p className="text-sm text-muted-foreground">Item a item · novos pedidos chegam em "Novos" automaticamente</p>
        </div>
      </div>

      {isLoading && <p className="text-muted-foreground text-sm">Carregando...</p>}

      <div className="grid lg:grid-cols-3 gap-4">
        {COLUNAS.map(({ keys, titulo, icone: Icon, tone, proximo, proximoLabel }) => {
          const lista = itens.filter((i) => keys.includes(i.status_preparo));
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
                {lista.map((it) => {
                  const enviado = it.enviado_cozinha_em ? new Date(it.enviado_cozinha_em) : null;
                  const idadeMin = enviado ? (Date.now() - enviado.getTime()) / 60000 : 0;
                  const urgente = idadeMin > 10 && it.status_preparo !== "pronto";
                  const nome = it.pedido.cliente?.nome ?? it.pedido.cliente_nome_rapido ?? "Balcão";
                  return (
                    <Card key={it.id} className={"p-3 border-l-4 " + (urgente ? "border-l-destructive" : tone)}>
                      <div className="flex items-start justify-between mb-1.5">
                        <div className="text-base font-bold">#{it.pedido.numero} <span className="text-xs font-normal text-muted-foreground">· Rod. {it.rodada}</span></div>
                        <Badge variant="outline" className={PREPARO_COLOR[it.status_preparo]}>{PREPARO_LABEL[it.status_preparo]}</Badge>
                      </div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1 mb-1">
                        <Clock className="size-3" />
                        {enviado ? enviado.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }) : "—"}
                        {urgente && <span className="ml-1 text-destructive font-semibold">há {Math.round(idadeMin)}min</span>}
                      </div>
                      <div className="text-sm font-medium mb-1.5">{nome}</div>
                      <div className="border-y border-border py-1.5 mb-2 text-sm">
                        <div className="font-semibold">{it.quantidade}× {it.nome_produto}</div>
                        {it.sabor && <div className="text-xs text-muted-foreground">• {it.sabor}</div>}
                        {Array.isArray(it.adicionais) && it.adicionais.length > 0 && (
                          <div className="text-xs text-muted-foreground">+ {it.adicionais.map((a) => a.nome).join(", ")}</div>
                        )}
                        {it.observacoes && <div className="text-xs italic text-muted-foreground">"{it.observacoes}"</div>}
                      </div>
                      <div className="flex gap-1.5">
                        {proximo && (
                          <Button size="sm" className="flex-1" onClick={() => avancar(it, proximo)}>
                            {it.status_preparo === "pronto" ? <PackageCheck className="size-4 mr-1" /> : null}
                            {proximoLabel}
                          </Button>
                        )}
                        <Button size="sm" variant="outline" onClick={() => cancelar(it)} title="Cancelar item">
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
