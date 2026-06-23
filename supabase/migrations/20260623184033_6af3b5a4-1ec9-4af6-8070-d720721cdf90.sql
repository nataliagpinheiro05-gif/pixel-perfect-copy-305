
-- =========================================================
-- ENUMS
-- =========================================================
CREATE TYPE public.app_role AS ENUM ('admin','funcionario');
CREATE TYPE public.forma_pagamento AS ENUM ('pix','dinheiro','debito','credito');
CREATE TYPE public.status_pagamento AS ENUM ('pago','pendente','cancelado');
CREATE TYPE public.status_pedido AS ENUM ('em_preparo','pronto','entregue','cancelado');
CREATE TYPE public.tipo_mov_estoque AS ENUM ('entrada','saida','ajuste','perda','vencimento','uso_interno');
CREATE TYPE public.status_entrega_kit AS ENUM ('pendente','em_producao','entregue','cancelado');
CREATE TYPE public.tipo_financeiro AS ENUM ('entrada','saida');

-- =========================================================
-- UTILS: updated_at trigger
-- =========================================================
CREATE OR REPLACE FUNCTION public.tg_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- =========================================================
-- USERS PROFILES
-- =========================================================
CREATE TABLE public.users_profiles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT '',
  email TEXT,
  role public.app_role NOT NULL DEFAULT 'funcionario',
  pode_ver_financeiro BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.users_profiles TO authenticated;
GRANT ALL ON public.users_profiles TO service_role;
ALTER TABLE public.users_profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER trg_users_profiles_updated_at BEFORE UPDATE ON public.users_profiles
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

-- Security definer helpers (avoid RLS recursion)
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role public.app_role)
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.users_profiles WHERE user_id = _user_id AND role = _role AND ativo = true);
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(auth.uid(), 'admin');
$$;

CREATE OR REPLACE FUNCTION public.pode_financeiro()
RETURNS BOOLEAN LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users_profiles
    WHERE user_id = auth.uid() AND ativo = true
      AND (role = 'admin' OR pode_ver_financeiro = true)
  );
$$;

-- RLS users_profiles
CREATE POLICY "Auth: ler perfis" ON public.users_profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Self: atualizar próprio perfil" ON public.users_profiles FOR UPDATE TO authenticated
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid() AND role = (SELECT role FROM public.users_profiles WHERE user_id = auth.uid()));
CREATE POLICY "Admin: tudo em perfis" ON public.users_profiles FOR ALL TO authenticated
  USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Auto-criar perfil ao registrar usuário
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.users_profiles (user_id, nome, email, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'nome', NEW.email),
    NEW.email,
    CASE WHEN (SELECT COUNT(*) FROM public.users_profiles) = 0 THEN 'admin'::public.app_role ELSE 'funcionario'::public.app_role END
  );
  RETURN NEW;
END;
$$;
CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- =========================================================
-- CLIENTES
-- =========================================================
CREATE TABLE public.clientes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  telefone TEXT UNIQUE,
  data_nascimento DATE,
  por_quem_veio TEXT,
  quem_indicou TEXT,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clientes TO authenticated;
GRANT ALL ON public.clientes TO service_role;
ALTER TABLE public.clientes ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_clientes_updated_at BEFORE UPDATE ON public.clientes
FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();

CREATE POLICY "Auth: ler clientes" ON public.clientes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth: inserir clientes" ON public.clientes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth: atualizar clientes" ON public.clientes FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin: excluir clientes" ON public.clientes FOR DELETE TO authenticated USING (public.is_admin());

-- RPC upsert por telefone
CREATE OR REPLACE FUNCTION public.upsert_cliente(
  _nome TEXT,
  _telefone TEXT,
  _data_nascimento DATE DEFAULT NULL,
  _por_quem_veio TEXT DEFAULT NULL,
  _quem_indicou TEXT DEFAULT NULL,
  _observacoes TEXT DEFAULT NULL
) RETURNS public.clientes LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c public.clientes;
BEGIN
  IF _telefone IS NULL OR _telefone = '' THEN
    INSERT INTO public.clientes(nome, telefone, data_nascimento, por_quem_veio, quem_indicou, observacoes)
    VALUES (_nome, NULL, _data_nascimento, _por_quem_veio, _quem_indicou, _observacoes)
    RETURNING * INTO c;
  ELSE
    INSERT INTO public.clientes(nome, telefone, data_nascimento, por_quem_veio, quem_indicou, observacoes)
    VALUES (_nome, _telefone, _data_nascimento, _por_quem_veio, _quem_indicou, _observacoes)
    ON CONFLICT (telefone) DO UPDATE SET
      nome = EXCLUDED.nome,
      data_nascimento = COALESCE(EXCLUDED.data_nascimento, public.clientes.data_nascimento),
      por_quem_veio = COALESCE(EXCLUDED.por_quem_veio, public.clientes.por_quem_veio),
      quem_indicou = COALESCE(EXCLUDED.quem_indicou, public.clientes.quem_indicou),
      observacoes = COALESCE(EXCLUDED.observacoes, public.clientes.observacoes),
      updated_at = now()
    RETURNING * INTO c;
  END IF;
  RETURN c;
END;
$$;
GRANT EXECUTE ON FUNCTION public.upsert_cliente(TEXT,TEXT,DATE,TEXT,TEXT,TEXT) TO authenticated;

-- =========================================================
-- CATEGORIAS, SABORES, ADICIONAIS
-- =========================================================
CREATE TABLE public.categorias_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.categorias_produtos TO authenticated;
GRANT ALL ON public.categorias_produtos TO service_role;
ALTER TABLE public.categorias_produtos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth: ler categorias" ON public.categorias_produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: gerenciar categorias" ON public.categorias_produtos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.sabores (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.sabores TO authenticated;
GRANT ALL ON public.sabores TO service_role;
ALTER TABLE public.sabores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth: ler sabores" ON public.sabores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: gerenciar sabores" ON public.sabores FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.adicionais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL UNIQUE,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.adicionais TO authenticated;
GRANT ALL ON public.adicionais TO service_role;
ALTER TABLE public.adicionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth: ler adicionais" ON public.adicionais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: gerenciar adicionais" ON public.adicionais FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================
-- PRODUTOS
-- =========================================================
CREATE TABLE public.produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria_id UUID REFERENCES public.categorias_produtos(id) ON DELETE SET NULL,
  descricao TEXT,
  preco NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo NUMERIC(10,2) NOT NULL DEFAULT 0,
  lucro NUMERIC(10,2) GENERATED ALWAYS AS (preco - custo) STORED,
  controla_estoque BOOLEAN NOT NULL DEFAULT false,
  estoque_minimo NUMERIC(10,2) NOT NULL DEFAULT 0,
  aparece_no_pedido BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produtos TO authenticated;
GRANT ALL ON public.produtos TO service_role;
ALTER TABLE public.produtos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_produtos_updated_at BEFORE UPDATE ON public.produtos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "Auth: ler produtos" ON public.produtos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: gerenciar produtos" ON public.produtos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.produto_sabores (
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  sabor_id UUID NOT NULL REFERENCES public.sabores(id) ON DELETE CASCADE,
  PRIMARY KEY (produto_id, sabor_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_sabores TO authenticated;
GRANT ALL ON public.produto_sabores TO service_role;
ALTER TABLE public.produto_sabores ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth: ler produto_sabores" ON public.produto_sabores FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: gerenciar produto_sabores" ON public.produto_sabores FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.produto_adicionais (
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  adicional_id UUID NOT NULL REFERENCES public.adicionais(id) ON DELETE CASCADE,
  PRIMARY KEY (produto_id, adicional_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_adicionais TO authenticated;
GRANT ALL ON public.produto_adicionais TO service_role;
ALTER TABLE public.produto_adicionais ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth: ler produto_adicionais" ON public.produto_adicionais FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: gerenciar produto_adicionais" ON public.produto_adicionais FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================
-- ESTOQUE
-- =========================================================
CREATE TABLE public.estoque_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome TEXT NOT NULL,
  categoria TEXT,
  quantidade_atual NUMERIC(12,3) NOT NULL DEFAULT 0,
  unidade_medida TEXT NOT NULL DEFAULT 'un',
  estoque_minimo NUMERIC(12,3) NOT NULL DEFAULT 0,
  custo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  fornecedor TEXT,
  validade DATE,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_itens TO authenticated;
GRANT ALL ON public.estoque_itens TO service_role;
ALTER TABLE public.estoque_itens ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_estoque_itens_updated_at BEFORE UPDATE ON public.estoque_itens FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "Auth: ler estoque" ON public.estoque_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth: atualizar estoque" ON public.estoque_itens FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin: inserir estoque" ON public.estoque_itens FOR INSERT TO authenticated WITH CHECK (public.is_admin());
CREATE POLICY "Admin: excluir estoque" ON public.estoque_itens FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.estoque_movimentacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  tipo public.tipo_mov_estoque NOT NULL,
  quantidade NUMERIC(12,3) NOT NULL,
  custo_unitario NUMERIC(10,2),
  motivo TEXT,
  pedido_id UUID,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.estoque_movimentacoes TO authenticated;
GRANT ALL ON public.estoque_movimentacoes TO service_role;
ALTER TABLE public.estoque_movimentacoes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth: ler movs estoque" ON public.estoque_movimentacoes FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth: inserir movs estoque" ON public.estoque_movimentacoes FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Admin: gerenciar movs estoque" ON public.estoque_movimentacoes FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

CREATE TABLE public.produto_composicao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID NOT NULL REFERENCES public.produtos(id) ON DELETE CASCADE,
  estoque_item_id UUID NOT NULL REFERENCES public.estoque_itens(id) ON DELETE CASCADE,
  quantidade_por_unidade NUMERIC(12,3) NOT NULL DEFAULT 0,
  UNIQUE (produto_id, estoque_item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.produto_composicao TO authenticated;
GRANT ALL ON public.produto_composicao TO service_role;
ALTER TABLE public.produto_composicao ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth: ler composicao" ON public.produto_composicao FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: gerenciar composicao" ON public.produto_composicao FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- =========================================================
-- PEDIDOS
-- =========================================================
CREATE SEQUENCE IF NOT EXISTS public.pedidos_numero_seq START 1000;

CREATE TABLE public.pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero INT NOT NULL DEFAULT nextval('public.pedidos_numero_seq') UNIQUE,
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  total NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo_total NUMERIC(10,2) NOT NULL DEFAULT 0,
  lucro_estimado NUMERIC(10,2) NOT NULL DEFAULT 0,
  forma_pagamento public.forma_pagamento,
  status_pagamento public.status_pagamento NOT NULL DEFAULT 'pendente',
  status_pedido public.status_pedido NOT NULL DEFAULT 'em_preparo',
  observacoes TEXT,
  data_hora TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedidos TO authenticated;
GRANT ALL ON public.pedidos TO service_role;
ALTER TABLE public.pedidos ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_pedidos_updated_at BEFORE UPDATE ON public.pedidos FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "Auth: ler pedidos" ON public.pedidos FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth: inserir pedidos" ON public.pedidos FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth: atualizar pedidos" ON public.pedidos FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin: excluir pedidos" ON public.pedidos FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.pedido_itens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  pedido_id UUID NOT NULL REFERENCES public.pedidos(id) ON DELETE CASCADE,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  nome_produto TEXT NOT NULL,
  quantidade NUMERIC(10,2) NOT NULL DEFAULT 1,
  preco_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo_unitario NUMERIC(10,2) NOT NULL DEFAULT 0,
  sabor TEXT,
  adicionais JSONB NOT NULL DEFAULT '[]'::jsonb,
  observacoes TEXT,
  subtotal NUMERIC(10,2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.pedido_itens TO authenticated;
GRANT ALL ON public.pedido_itens TO service_role;
ALTER TABLE public.pedido_itens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Auth: ler pedido_itens" ON public.pedido_itens FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth: gerenciar pedido_itens" ON public.pedido_itens FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- Recalcular totais do pedido a partir dos itens
CREATE OR REPLACE FUNCTION public.tg_pedido_item_calc_subtotal()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE add_total NUMERIC(10,2) := 0;
BEGIN
  IF NEW.adicionais IS NOT NULL THEN
    SELECT COALESCE(SUM((a->>'preco')::numeric), 0) INTO add_total
    FROM jsonb_array_elements(NEW.adicionais) a;
  END IF;
  NEW.subtotal := (NEW.preco_unitario + add_total) * NEW.quantidade;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pi_subtotal BEFORE INSERT OR UPDATE ON public.pedido_itens
FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_item_calc_subtotal();

CREATE OR REPLACE FUNCTION public.recalc_pedido_totais(_pedido_id UUID)
RETURNS VOID LANGUAGE plpgsql SET search_path = public AS $$
DECLARE _sub NUMERIC(10,2); _custo NUMERIC(10,2);
BEGIN
  SELECT COALESCE(SUM(subtotal),0), COALESCE(SUM(custo_unitario * quantidade),0)
    INTO _sub, _custo FROM public.pedido_itens WHERE pedido_id = _pedido_id;
  UPDATE public.pedidos
     SET subtotal = _sub, total = _sub, custo_total = _custo,
         lucro_estimado = _sub - _custo, updated_at = now()
   WHERE id = _pedido_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.tg_pedido_itens_recalc()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    PERFORM public.recalc_pedido_totais(OLD.pedido_id);
    RETURN OLD;
  ELSE
    PERFORM public.recalc_pedido_totais(NEW.pedido_id);
    RETURN NEW;
  END IF;
END;
$$;
CREATE TRIGGER trg_pi_recalc_ai AFTER INSERT OR UPDATE OR DELETE ON public.pedido_itens
FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_itens_recalc();

-- Baixa automática de estoque quando item de pedido inserido (via composicao)
CREATE OR REPLACE FUNCTION public.tg_pedido_item_baixa_estoque()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.produto_id IS NULL THEN RETURN NEW; END IF;
  FOR r IN SELECT pc.estoque_item_id, pc.quantidade_por_unidade
           FROM public.produto_composicao pc WHERE pc.produto_id = NEW.produto_id
  LOOP
    UPDATE public.estoque_itens
       SET quantidade_atual = quantidade_atual - (r.quantidade_por_unidade * NEW.quantidade)
     WHERE id = r.estoque_item_id;
    INSERT INTO public.estoque_movimentacoes(item_id, tipo, quantidade, motivo, pedido_id)
    VALUES (r.estoque_item_id, 'saida', r.quantidade_por_unidade * NEW.quantidade, 'Pedido #' || NEW.pedido_id, NEW.pedido_id);
  END LOOP;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pi_baixa_estoque AFTER INSERT ON public.pedido_itens
FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_item_baixa_estoque();

-- =========================================================
-- FINANCEIRO
-- =========================================================
CREATE TABLE public.meu_slim_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id UUID REFERENCES public.clientes(id) ON DELETE SET NULL,
  nome_cliente TEXT NOT NULL,
  telefone TEXT,
  tipo_kit TEXT NOT NULL,
  data_venda DATE NOT NULL DEFAULT CURRENT_DATE,
  data_prevista_entrega DATE,
  valor NUMERIC(10,2) NOT NULL DEFAULT 0,
  custo NUMERIC(10,2) NOT NULL DEFAULT 0,
  lucro NUMERIC(10,2) GENERATED ALWAYS AS (valor - custo) STORED,
  forma_pagamento public.forma_pagamento,
  status_pagamento public.status_pagamento NOT NULL DEFAULT 'pendente',
  status_entrega public.status_entrega_kit NOT NULL DEFAULT 'pendente',
  observacoes TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.meu_slim_vendas TO authenticated;
GRANT ALL ON public.meu_slim_vendas TO service_role;
ALTER TABLE public.meu_slim_vendas ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_meu_slim_updated_at BEFORE UPDATE ON public.meu_slim_vendas FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "Auth: ler meu_slim" ON public.meu_slim_vendas FOR SELECT TO authenticated USING (true);
CREATE POLICY "Auth: inserir meu_slim" ON public.meu_slim_vendas FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Auth: atualizar meu_slim" ON public.meu_slim_vendas FOR UPDATE TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "Admin: excluir meu_slim" ON public.meu_slim_vendas FOR DELETE TO authenticated USING (public.is_admin());

CREATE TABLE public.financeiro_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo public.tipo_financeiro NOT NULL,
  categoria TEXT NOT NULL,
  descricao TEXT NOT NULL,
  valor NUMERIC(10,2) NOT NULL,
  forma_pagamento public.forma_pagamento,
  data DATE NOT NULL DEFAULT CURRENT_DATE,
  pedido_id UUID REFERENCES public.pedidos(id) ON DELETE CASCADE,
  meu_slim_venda_id UUID REFERENCES public.meu_slim_vendas(id) ON DELETE CASCADE,
  observacoes TEXT,
  usuario_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.financeiro_lancamentos TO authenticated;
GRANT ALL ON public.financeiro_lancamentos TO service_role;
ALTER TABLE public.financeiro_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Financeiro: ler" ON public.financeiro_lancamentos FOR SELECT TO authenticated USING (public.pode_financeiro());
CREATE POLICY "Financeiro: inserir" ON public.financeiro_lancamentos FOR INSERT TO authenticated WITH CHECK (public.pode_financeiro());
CREATE POLICY "Admin: gerenciar financeiro" ON public.financeiro_lancamentos FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- Gera/atualiza lançamento financeiro de pedido pago
CREATE OR REPLACE FUNCTION public.tg_pedido_financeiro()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status_pagamento = 'pago' AND NEW.status_pedido <> 'cancelado' THEN
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
$$;
CREATE TRIGGER trg_pedido_financeiro AFTER INSERT OR UPDATE ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_financeiro();

-- Reverter estoque ao cancelar pedido
CREATE OR REPLACE FUNCTION public.tg_pedido_cancelado_reverte_estoque()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE r RECORD;
BEGIN
  IF NEW.status_pedido = 'cancelado' AND OLD.status_pedido <> 'cancelado' THEN
    FOR r IN SELECT pi.produto_id, pi.quantidade
             FROM public.pedido_itens pi WHERE pi.pedido_id = NEW.id
    LOOP
      IF r.produto_id IS NOT NULL THEN
        UPDATE public.estoque_itens ei
           SET quantidade_atual = ei.quantidade_atual + (pc.quantidade_por_unidade * r.quantidade)
          FROM public.produto_composicao pc
         WHERE pc.produto_id = r.produto_id AND pc.estoque_item_id = ei.id;
        INSERT INTO public.estoque_movimentacoes(item_id, tipo, quantidade, motivo, pedido_id)
        SELECT pc.estoque_item_id, 'entrada', pc.quantidade_por_unidade * r.quantidade,
               'Reversão pedido cancelado #' || NEW.numero, NEW.id
          FROM public.produto_composicao pc WHERE pc.produto_id = r.produto_id;
      END IF;
    END LOOP;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_pedido_cancel_reverte AFTER UPDATE OF status_pedido ON public.pedidos
FOR EACH ROW EXECUTE FUNCTION public.tg_pedido_cancelado_reverte_estoque();

-- Financeiro automático Meu Slim
CREATE OR REPLACE FUNCTION public.tg_meu_slim_financeiro()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NEW.status_pagamento = 'pago' THEN
    IF NOT EXISTS (SELECT 1 FROM public.financeiro_lancamentos WHERE meu_slim_venda_id = NEW.id) THEN
      INSERT INTO public.financeiro_lancamentos(tipo, categoria, descricao, valor, forma_pagamento, data, meu_slim_venda_id, usuario_id)
      VALUES ('entrada','Venda - Meu Slim', NEW.tipo_kit || ' - ' || NEW.nome_cliente, NEW.valor, NEW.forma_pagamento, NEW.data_venda, NEW.id, NEW.usuario_id);
    ELSE
      UPDATE public.financeiro_lancamentos SET valor = NEW.valor, forma_pagamento = NEW.forma_pagamento WHERE meu_slim_venda_id = NEW.id;
    END IF;
  ELSIF NEW.status_pagamento = 'cancelado' THEN
    DELETE FROM public.financeiro_lancamentos WHERE meu_slim_venda_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER trg_meu_slim_financeiro AFTER INSERT OR UPDATE ON public.meu_slim_vendas
FOR EACH ROW EXECUTE FUNCTION public.tg_meu_slim_financeiro();

-- =========================================================
-- CONFIGURACOES LOJA
-- =========================================================
CREATE TABLE public.configuracoes_loja (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nome_loja TEXT NOT NULL DEFAULT 'FitLounge',
  logo_url TEXT,
  cnpj TEXT,
  endereco TEXT,
  telefone TEXT,
  estoque_minimo_padrao NUMERIC(10,2) NOT NULL DEFAULT 5,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.configuracoes_loja TO authenticated;
GRANT ALL ON public.configuracoes_loja TO service_role;
ALTER TABLE public.configuracoes_loja ENABLE ROW LEVEL SECURITY;
CREATE TRIGGER trg_config_updated_at BEFORE UPDATE ON public.configuracoes_loja FOR EACH ROW EXECUTE FUNCTION public.tg_set_updated_at();
CREATE POLICY "Auth: ler config" ON public.configuracoes_loja FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin: gerenciar config" ON public.configuracoes_loja FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

INSERT INTO public.configuracoes_loja (nome_loja) VALUES ('FitLounge');

-- =========================================================
-- VIEWS
-- =========================================================
CREATE OR REPLACE VIEW public.vw_produtos_mais_vendidos AS
SELECT pi.produto_id, pi.nome_produto,
       SUM(pi.quantidade)::numeric AS qtd_vendida,
       SUM(pi.subtotal)::numeric AS total_vendido
FROM public.pedido_itens pi
JOIN public.pedidos p ON p.id = pi.pedido_id
WHERE p.status_pedido <> 'cancelado'
GROUP BY pi.produto_id, pi.nome_produto
ORDER BY qtd_vendida DESC;

CREATE OR REPLACE VIEW public.vw_clientes_top AS
SELECT c.id, c.nome, c.telefone,
       COUNT(p.id) AS qtd_pedidos,
       COALESCE(SUM(p.total),0) AS total_gasto,
       MAX(p.data_hora) AS ultima_compra
FROM public.clientes c
LEFT JOIN public.pedidos p ON p.cliente_id = c.id AND p.status_pedido <> 'cancelado'
GROUP BY c.id
ORDER BY total_gasto DESC;

CREATE OR REPLACE VIEW public.vw_estoque_alertas AS
SELECT ei.*,
  CASE
    WHEN ei.validade IS NOT NULL AND ei.validade < CURRENT_DATE THEN 'vencido'
    WHEN ei.quantidade_atual <= 0 THEN 'em_falta'
    WHEN ei.validade IS NOT NULL AND ei.validade <= CURRENT_DATE + INTERVAL '7 days' THEN 'proximo_vencimento'
    WHEN ei.quantidade_atual <= ei.estoque_minimo THEN 'abaixo_minimo'
    ELSE 'ok'
  END AS alerta
FROM public.estoque_itens ei
WHERE ei.ativo = true;

CREATE OR REPLACE VIEW public.vw_clientes_inativos_30dias AS
SELECT c.id, c.nome, c.telefone, MAX(p.data_hora) AS ultima_compra
FROM public.clientes c
LEFT JOIN public.pedidos p ON p.cliente_id = c.id AND p.status_pedido <> 'cancelado'
GROUP BY c.id
HAVING MAX(p.data_hora) IS NULL OR MAX(p.data_hora) < now() - INTERVAL '30 days';

GRANT SELECT ON public.vw_produtos_mais_vendidos TO authenticated;
GRANT SELECT ON public.vw_clientes_top TO authenticated;
GRANT SELECT ON public.vw_estoque_alertas TO authenticated;
GRANT SELECT ON public.vw_clientes_inativos_30dias TO authenticated;

-- Realtime para cozinha
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedidos;
ALTER PUBLICATION supabase_realtime ADD TABLE public.pedido_itens;
