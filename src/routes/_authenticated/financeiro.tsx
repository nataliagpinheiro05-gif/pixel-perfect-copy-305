import { createFileRoute, redirect } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/financeiro")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase.from("users_profiles").select("role,pode_ver_financeiro").eq("user_id", u.user.id).maybeSingle();
    if (!perfil || (perfil.role !== "admin" && !perfil.pode_ver_financeiro)) {
      throw redirect({ to: "/" });
    }
  },
  head: () => ({ meta: [{ title: "Financeiro — FitLounge" }] }),
  component: () => <ComingSoon titulo="Financeiro" descricao="Entradas, saídas, lucros e fluxo de caixa." />,
});
