import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/estoque")({
  head: () => ({ meta: [{ title: "Estoque — FitLounge" }] }),
  component: () => <ComingSoon titulo="Estoque" descricao="Itens, movimentações, alertas de vencimento e baixa automática por venda." />,
});
