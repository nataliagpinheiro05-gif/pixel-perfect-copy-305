import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/meu-slim")({
  head: () => ({ meta: [{ title: "Meu Slim — FitLounge" }] }),
  component: () => <ComingSoon titulo="Meu Slim / Kits Detox" descricao="Vendas de kits, status de entrega e indicadores." />,
});
