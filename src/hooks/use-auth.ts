import { useEffect, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";

export interface PerfilUsuario {
  id: string;
  user_id: string;
  nome: string;
  email: string | null;
  role: "admin" | "funcionario";
  pode_ver_financeiro: boolean;
  ativo: boolean;
}

export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [perfil, setPerfil] = useState<PerfilUsuario | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      setSession(sess);
      setUser(sess?.user ?? null);
      if (sess?.user) {
        // defer to avoid deadlock
        setTimeout(() => loadPerfil(sess.user!.id), 0);
      } else {
        setPerfil(null);
      }
    });

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        loadPerfil(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    return () => sub.subscription.unsubscribe();
  }, []);

  async function loadPerfil(userId: string) {
    const { data } = await supabase
      .from("users_profiles")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();
    setPerfil((data as PerfilUsuario) ?? null);
  }

  const isAdmin = perfil?.role === "admin";
  const podeFinanceiro = isAdmin || perfil?.pode_ver_financeiro === true;

  return { session, user, perfil, loading, isAdmin, podeFinanceiro };
}
