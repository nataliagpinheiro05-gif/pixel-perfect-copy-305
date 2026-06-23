import { createFileRoute, redirect } from "@tanstack/react-router";
import { ComingSoon } from "@/components/coming-soon";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/_authenticated/configuracoes")({
  beforeLoad: async () => {
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) throw redirect({ to: "/auth" });
    const { data: perfil } = await supabase.from("users_profiles").select("role").eq("user_id", u.user.id).maybeSingle();
    if (!perfil || perfil.role !== "admin") throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Configurações — FitLounge" }] }),
  component: () => <ComingSoon titulo="Configurações" descricao="Dados da loja, usuários e parâmetros gerais." />,
});
