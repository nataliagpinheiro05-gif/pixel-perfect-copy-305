
ALTER TYPE public.status_pedido ADD VALUE IF NOT EXISTS 'recebido' BEFORE 'em_preparo';
ALTER TYPE public.status_pedido ADD VALUE IF NOT EXISTS 'na_cozinha' BEFORE 'pronto';
ALTER TYPE public.status_pedido ADD VALUE IF NOT EXISTS 'em_producao' BEFORE 'pronto';
ALTER TYPE public.status_pedido ADD VALUE IF NOT EXISTS 'em_entrega' BEFORE 'entregue';
