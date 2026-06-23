import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/pedidos/novo")({
  head: () => ({ meta: [{ title: "Novo pedido — FitLounge" }] }),
  component: () => <ComingSoon titulo="Novo Pedido" descricao="Fluxo otimizado para celular: cliente, produtos, sabores, adicionais e pagamento em poucos toques." />,
});
