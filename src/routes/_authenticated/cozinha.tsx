import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/cozinha")({
  head: () => ({ meta: [{ title: "Cozinha — FitLounge" }] }),
  component: () => <ComingSoon titulo="Cozinha / Preparo" descricao="Painel em tempo real dos pedidos: em preparo → pronto → entregue." />,
});
