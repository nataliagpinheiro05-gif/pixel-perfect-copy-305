
ALTER TABLE public.pedidos REPLICA IDENTITY FULL;
ALTER TABLE public.pedido_itens REPLICA IDENTITY FULL;
DO $$ BEGIN
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos; EXCEPTION WHEN duplicate_object THEN NULL; END;
  BEGIN ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido_itens; EXCEPTION WHEN duplicate_object THEN NULL; END;
END $$;
