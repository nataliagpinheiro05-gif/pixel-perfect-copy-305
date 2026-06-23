import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/relatorios")({
  head: () => ({ meta: [{ title: "Relatórios — FitLounge" }] }),
  component: () => <ComingSoon titulo="Relatórios" descricao="Vendas, lucros, clientes, estoque e exportação PDF/Excel." />,
});
