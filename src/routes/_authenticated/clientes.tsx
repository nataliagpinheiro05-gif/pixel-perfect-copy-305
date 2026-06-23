import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — FitLounge" }] }),
  component: () => <ComingSoon titulo="Clientes" descricao="Lista, histórico de compras, indicações e WhatsApp." />,
});
