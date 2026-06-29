import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { brl } from "@/lib/format";
import { useAuth } from "@/hooks/use-auth";
import { toast } from "sonner";
import { ArrowLeft, Copy, Trash2, X, CheckCircle2, Check, DollarSign } from "lucide-react";
import { STAGES, STATUS_COLOR, STATUS_LABEL, nextStatus, NEXT_LABEL } from "@/lib/pedido-fluxo";
import { ConfirmarPagamentoDialog } from "@/components/confirmar-pagamento-dialog";

export const Route = createFileRoute("/_authenticated/pedidos/$id")({
  head: () => ({ meta: [{ title: "Pedido — FitLounge" }] }),
  component: PedidoDetailPage,
});

function PedidoDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { isAdmin, perfil } = useAuth();
  const [pagOpen, setPagOpen] = useState(false);

  const { data: pedido } = useQuery({
    queryKey: ["pedido", id],
    queryFn: async () => {
      const { data } = await supabase
        .from("pedidos")
        .select("*, cliente:clientes(id,nome,telefone), pedido_itens(*)")
        .eq("id", id).maybeSingle();
      return data as any;
    },
  });

  if (!pedido) return <p className="text-muted-foreground">Carregando...</p>;

  async function update(patch: any) {
    const { error } = await supabase.from("pedidos").update(patch).eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Atualizado"); qc.invalidateQueries({ queryKey: ["pedido", id] }); }
  }

  async function avancar() {
    const proximo = nextStatus(pedido.status_pedido);
    if (proximo) await update({ status_pedido: proximo });
  }

  async function cancelar() {
    const motivo = prompt("Motivo do cancelamento (opcional):", "");
    if (motivo === null) return;
    const { error } = await supabase.rpc("cancelar_pedido", { _pedido_id: id, _motivo: motivo || undefined });
    if (error) toast.error(error.message);
    else { toast.success("Pedido cancelado"); qc.invalidateQueries({ queryKey: ["pedido", id] }); }
  }

  async function excluir() {
    if (!isAdmin) return;
    if (!confirm("Excluir permanentemente?")) return;
    const { error } = await supabase.from("pedidos").delete().eq("id", id);
    if (error) toast.error(error.message);
    else { toast.success("Excluído"); navigate({ to: "/pedidos" as any }); }
  }

  async function duplicar() {
    const { data: novo, error } = await supabase.from("pedidos").insert({
      cliente_id: pedido.cliente_id, observacoes: pedido.observacoes, usuario_id: perfil?.id ?? null,
    }).select("id, numero").single();
    if (error || !novo) { toast.error(error?.message ?? "Erro"); return; }
    const itens = pedido.pedido_itens.map((it: any) => ({
      pedido_id: novo.id, produto_id: it.produto_id, nome_produto: it.nome_produto,
      quantidade: it.quantidade, preco_unitario: it.preco_unitario, custo_unitario: it.custo_unitario,
      sabor: it.sabor, adicionais: it.adicionais, observacoes: it.observacoes,
    }));
    const { error: e2 } = await supabase.from("pedido_itens").insert(itens);
    if (e2) { toast.error(e2.message); return; }
    toast.success(`Pedido #${novo.numero} duplicado`);
    navigate({ to: "/pedidos/$id" as any, params: { id: novo.id } as any });
  }

  const proximo = nextStatus(pedido.status_pedido);
  const cancelado = pedido.status_pedido === "cancelado";
  const pago = pedido.status_pagamento === "pago";
  const stageIndex = STAGES.findIndex((s) => s.value === pedido.status_pedido || (s.value === "em_producao" && pedido.status_pedido === "em_preparo"));

  return (
    <>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Button variant="ghost" size="icon" onClick={() => navigate({ to: "/pedidos" as any })}><ArrowLeft className="size-4" /></Button>
        <div className="flex-1 min-w-[180px]">
          <h1 className="text-2xl font-heading font-bold">Pedido #{pedido.numero}</h1>
          <p className="text-sm text-muted-foreground">{new Date(pedido.data_hora).toLocaleString("pt-BR")}</p>
        </div>
        <Button variant="outline" size="sm" onClick={duplicar}><Copy className="size-4 mr-1" /> Duplicar</Button>
        {!cancelado && <Button variant="outline" size="sm" onClick={cancelar}><X className="size-4 mr-1" /> Cancelar</Button>}
        {isAdmin && <Button variant="destructive" size="sm" onClick={excluir}><Trash2 className="size-4" /></Button>}
      </div>

      {/* Botão grande de baixa */}
      {!cancelado && !pago && (
        <Card className="p-4 mb-4 bg-gradient-to-r from-gold/10 to-gold/5 border-gold/40">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="text-sm text-muted-foreground">Venda em aberto</div>
              <div className="text-2xl font-bold text-primary">{brl(pedido.total)}</div>
              <div className="text-xs text-muted-foreground">Confirme o pagamento para baixar estoque e lançar no financeiro.</div>
            </div>
            <Button size="lg" className="bg-gold text-gold-foreground hover:bg-gold/90 h-12" onClick={() => setPagOpen(true)}>
              <DollarSign className="size-5 mr-2" /> Confirmar pagamento / Dar baixa
            </Button>
          </div>
        </Card>
      )}

      {pago && (
        <Card className="p-3 mb-4 bg-green-500/10 border-green-500/40">
          <div className="flex items-center gap-2 text-green-700 dark:text-green-400 font-semibold">
            <CheckCircle2 className="size-5" /> Venda paga em {pedido.forma_pagamento ?? "—"} — {brl(pedido.valor_recebido ?? pedido.total)} recebido{pedido.estoque_baixado && " • estoque baixado ✓"}
          </div>
        </Card>
      )}

      {/* Pipeline visual */}
      {!cancelado && (
        <Card className="p-4 mb-4">
          <div className="flex items-center gap-1 overflow-x-auto pb-2">
            {STAGES.map((s, i) => {
              const ativo = i <= stageIndex; const atual = i === stageIndex;
              return (
                <div key={s.value} className="flex items-center gap-1 shrink-0">
                  <div className={"flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border " + (atual ? "bg-primary text-primary-foreground border-primary" : ativo ? "bg-primary/10 text-primary border-primary/30" : "bg-muted text-muted-foreground border-border")}>
                    {ativo && !atual && <Check className="size-3" />}
                    {s.short}
                  </div>
                  {i < STAGES.length - 1 && <div className={"h-px w-4 " + (i < stageIndex ? "bg-primary" : "bg-border")} />}
                </div>
              );
            })}
          </div>
          {proximo && (
            <Button onClick={avancar} className="mt-2 bg-primary">
              <CheckCircle2 className="size-4 mr-1" /> {NEXT_LABEL[pedido.status_pedido]}
            </Button>
          )}
        </Card>
      )}

      <div className="grid md:grid-cols-[1fr_320px] gap-4">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">Cliente</div>
          <div className="font-medium mb-4">{pedido.cliente?.nome ?? "Sem cliente"} {pedido.cliente?.telefone && <span className="text-muted-foreground text-sm">— {pedido.cliente.telefone}</span>}</div>

          <div className="text-sm font-semibold mb-2">Itens</div>
          <ul className="divide-y divide-border">
            {pedido.pedido_itens.map((it: any) => (
              <li key={it.id} className="py-2">
                <div className="flex justify-between">
                  <div>
                    <div className="font-medium">{it.quantidade}× {it.nome_produto}</div>
                    {it.sabor && <div className="text-xs text-muted-foreground">Sabor: {it.sabor}</div>}
                    {Array.isArray(it.adicionais) && it.adicionais.length > 0 && (
                      <div className="text-xs text-muted-foreground">+ {it.adicionais.map((a: any) => a.nome).join(", ")}</div>
                    )}
                    {it.observacoes && <div className="text-xs italic text-muted-foreground">"{it.observacoes}"</div>}
                  </div>
                  <div className="font-semibold">{brl(it.subtotal)}</div>
                </div>
              </li>
            ))}
          </ul>
          {pedido.observacoes && <div className="mt-3 text-sm"><span className="font-semibold">Obs:</span> {pedido.observacoes}</div>}
        </Card>

        <Card className="p-4 space-y-3 h-fit">
          <div>
            <div className="text-xs text-muted-foreground mb-1">Status do pedido</div>
            <Select value={pedido.status_pedido} onValueChange={(v) => update({ status_pedido: v })} disabled={cancelado}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {STAGES.map((s) => <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>)}
                <SelectItem value="cancelado">Cancelado</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div>
            <div className="text-xs text-muted-foreground mb-1">Pagamento</div>
            <Badge variant="outline" className={pago ? "bg-green-500/10 text-green-700 dark:text-green-400" : "bg-amber-500/10 text-amber-700 dark:text-amber-400"}>
              {pago ? `Pago — ${pedido.forma_pagamento ?? "—"}` : cancelado ? "Cancelado" : "Pendente"}
            </Badge>
          </div>
          <div className="pt-2 border-t border-border space-y-1 text-sm">
            <div className="flex justify-between"><span className="text-muted-foreground">Subtotal</span><span>{brl(pedido.subtotal)}</span></div>
            {isAdmin && (
              <>
                <div className="flex justify-between"><span className="text-muted-foreground">Custo</span><span>{brl(pedido.custo_total)}</span></div>
                <div className="flex justify-between"><span className="text-muted-foreground">Lucro</span><span className="text-green-600">{brl(pedido.lucro_estimado)}</span></div>
              </>
            )}
            <div className="flex justify-between text-lg font-bold pt-1"><span>Total</span><span className="text-primary">{brl(pedido.total)}</span></div>
          </div>
          <Badge variant="outline" className={STATUS_COLOR[pedido.status_pedido]}>{STATUS_LABEL[pedido.status_pedido]}</Badge>
        </Card>
      </div>

      {pagOpen && (
        <ConfirmarPagamentoDialog
          pedidoId={id} numero={pedido.numero} total={Number(pedido.total)}
          open={pagOpen} onClose={() => setPagOpen(false)}
          onConfirmed={() => qc.invalidateQueries({ queryKey: ["pedido", id] })}
        />
      )}
    </>
  );
}
