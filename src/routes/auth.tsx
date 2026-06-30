import { createFileRoute, redirect, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { toast } from "sonner";
import { Leaf } from "lucide-react";
import { loginSchema, signupSchema, formatZodError } from "@/lib/validations";
import { handleError } from "@/lib/errors";

export const Route = createFileRoute("/auth")({
  ssr: false,
  beforeLoad: async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) throw redirect({ to: "/" });
  },
  head: () => ({ meta: [{ title: "Entrar — Gestão FitLounge" }] }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [nome, setNome] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const parsed = mode === "login"
      ? loginSchema.safeParse({ email, password })
      : signupSchema.safeParse({ email, password, nome });
    if (!parsed.success) { toast.error(formatZodError(parsed.error)); return; }
    setLoading(true);
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        toast.success("Bem-vindo de volta!");
        navigate({ to: "/" });
      } else {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/`,
            data: { nome },
          },
        });
        if (error) throw error;
        toast.success("Conta criada. Verifique seu e-mail se necessário.");
        navigate({ to: "/" });
      }
    } catch (err) {
      handleError(err, "Erro ao autenticar");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-app-radial bg-background p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center gap-2 mb-6">
          <div className="size-10 rounded-xl bg-primary text-primary-foreground flex items-center justify-center">
            <Leaf className="size-5" />
          </div>
          <div>
            <div className="font-heading text-xl font-bold leading-tight">FitLounge</div>
            <div className="text-xs text-muted-foreground -mt-0.5">Gestão da loja</div>
          </div>
        </div>

        <Card className="border-border/60 shadow-xl">
          <CardHeader>
            <CardTitle className="font-heading text-2xl">
              {mode === "login" ? "Entrar" : "Criar conta"}
            </CardTitle>
            <CardDescription>
              {mode === "login"
                ? "Acesse o painel para registrar pedidos, gerenciar estoque e mais."
                : "A primeira conta criada se torna administradora."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="nome">Nome</Label>
                  <Input id="nome" value={nome} onChange={(e) => setNome(e.target.value)} required />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Senha</Label>
                <Input id="password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === "login" ? "current-password" : "new-password"} />
              </div>
              <Button type="submit" className="w-full h-11 text-base" disabled={loading}>
                {loading ? "Carregando..." : mode === "login" ? "Entrar" : "Criar conta"}
              </Button>
            </form>
            <div className="mt-4 text-center text-sm text-muted-foreground">
              {mode === "login" ? (
                <>Sem conta? <button className="text-primary hover:underline font-medium" onClick={() => setMode("signup")}>Criar agora</button></>
              ) : (
                <>Já tem conta? <button className="text-primary hover:underline font-medium" onClick={() => setMode("login")}>Entrar</button></>
              )}
            </div>
          </CardContent>
        </Card>
        <p className="text-center text-xs text-muted-foreground mt-4">
          <Link to="/" className="hover:underline">Voltar</Link>
        </p>
      </div>
    </div>
  );
}
