import { createFileRoute } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
export const Route = createFileRoute("/_authenticated/produtos")({
  head: () => ({ meta: [{ title: "Produtos — FitLounge" }] }),
  component: () => <ComingSoon titulo="Produtos / Cardápio" descricao="Categorias, sabores, adicionais e ficha técnica." />,
});
