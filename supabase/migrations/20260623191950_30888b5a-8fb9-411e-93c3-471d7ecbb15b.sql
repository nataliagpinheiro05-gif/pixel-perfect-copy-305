
-- Default: pedido entra no sistema como 'recebido'
ALTER TABLE public.pedidos ALTER COLUMN status_pedido SET DEFAULT 'recebido'::public.status_pedido;

-- Atualiza gatilho financeiro: só lança quando pedido foi entregue e está pago
CREATE OR REPLACE FUNCTION public.tg_pedido_financeiro()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  IF NEW.status_pagamento = 'pago' AND NEW.status_pedido = 'entregue' THEN
    IF NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos WHERE pedido_id = NEW.id) THEN
      INSERT INTO public.financeiro_lancamentos(tipo, categoria, descricao, valor, forma_pagamento, data, pedido_id, usuario_id)
      VALUES ('entrada','Venda - Pedido','Pedido #' || NEW.numero, NEW.total, NEW.forma_pagamento, NEW.data_hora::date, NEW.id, NEW.usuario_id);
    ELSE
      UPDATE public.financeiro_lancamentos
         SET valor = NEW.total, forma_pagamento = NEW.forma_pagamento
       WHERE pedido_id = NEW.id;
    END IF;
  ELSIF NEW.status_pedido = 'cancelado' OR NEW.status_pagamento = 'cancelado' THEN
    DELETE FROM public.financeiro_lancamentos WHERE pedido_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$function$;
