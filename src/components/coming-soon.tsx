import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Construction } from "lucide-react";

export function ComingSoon({ titulo, descricao }: { titulo: string; descricao: string }) {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-heading font-bold">{titulo}</h1>
        <p className="text-sm text-muted-foreground mt-1">{descricao}</p>
      </div>
      <Card className="border-dashed">
        <CardHeader>
          <div className="size-12 rounded-xl bg-gold/15 text-gold flex items-center justify-center mb-2">
            <Construction className="size-6" />
          </div>
          <CardTitle className="font-heading">Módulo em construção</CardTitle>
          <CardDescription>
            O banco de dados, regras e estrutura visual já estão prontos. Esta tela será implementada
            nas próximas fases do projeto (basta pedir a próxima fase no chat).
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ul className="text-sm text-muted-foreground space-y-1 list-disc pl-5">
            <li>Acesso já controlado por papel (admin / funcionário).</li>
            <li>Tabelas e views relacionadas já criadas no banco.</li>
            <li>Componentes de UI (Card, Tabs, Form, etc.) já disponíveis.</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
