export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      adicionais: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
          preco: number
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
          preco?: number
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
          preco?: number
        }
        Relationships: []
      }
      adicional_composicao: {
        Row: {
          adicional_id: string | null
          ativo: boolean
          created_at: string
          estoque_item_id: string
          id: string
          nome_adicional: string | null
          quantidade_utilizada: number
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          adicional_id?: string | null
          ativo?: boolean
          created_at?: string
          estoque_item_id: string
          id?: string
          nome_adicional?: string | null
          quantidade_utilizada?: number
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          adicional_id?: string | null
          ativo?: boolean
          created_at?: string
          estoque_item_id?: string
          id?: string
          nome_adicional?: string | null
          quantidade_utilizada?: number
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "adicional_composicao_adicional_id_fkey"
            columns: ["adicional_id"]
            isOneToOne: false
            referencedRelation: "adicionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_composicao_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "adicional_composicao_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "vw_estoque_alertas"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          acao: string
          created_at: string
          descricao: string | null
          entidade: string
          entidade_id: string | null
          id: string
          metadata: Json | null
          motivo: string | null
          usuario_id: string | null
          usuario_nome: string | null
        }
        Insert: {
          acao: string
          created_at?: string
          descricao?: string | null
          entidade: string
          entidade_id?: string | null
          id?: string
          metadata?: Json | null
          motivo?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Update: {
          acao?: string
          created_at?: string
          descricao?: string | null
          entidade?: string
          entidade_id?: string | null
          id?: string
          metadata?: Json | null
          motivo?: string | null
          usuario_id?: string | null
          usuario_nome?: string | null
        }
        Relationships: []
      }
      caixa_movimentacoes: {
        Row: {
          caixa_id: string
          created_at: string
          descricao: string | null
          financeiro_lancamento_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          pedido_id: string | null
          pedido_pagamento_id: string | null
          tipo: string
          usuario_id: string | null
          valor: number
        }
        Insert: {
          caixa_id: string
          created_at?: string
          descricao?: string | null
          financeiro_lancamento_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          pedido_id?: string | null
          pedido_pagamento_id?: string | null
          tipo: string
          usuario_id?: string | null
          valor?: number
        }
        Update: {
          caixa_id?: string
          created_at?: string
          descricao?: string | null
          financeiro_lancamento_id?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          pedido_id?: string | null
          pedido_pagamento_id?: string | null
          tipo?: string
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "caixa_movimentacoes_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_financeiro_lancamento_id_fkey"
            columns: ["financeiro_lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "caixa_movimentacoes_pedido_pagamento_id_fkey"
            columns: ["pedido_pagamento_id"]
            isOneToOne: false
            referencedRelation: "pedido_pagamentos"
            referencedColumns: ["id"]
          },
        ]
      }
      caixas: {
        Row: {
          aberto_em: string
          created_at: string
          diferenca: number | null
          fechado_em: string | null
          id: string
          observacoes_abertura: string | null
          observacoes_fechamento: string | null
          saldo_final: number | null
          status: string
          total_credito: number
          total_debito: number
          total_dinheiro: number
          total_entradas: number
          total_pix: number
          total_reforcos: number
          total_saidas: number
          total_sangrias: number
          updated_at: string
          usuario_abertura_id: string | null
          usuario_fechamento_id: string | null
          valor_dinheiro_esperado: number | null
          valor_dinheiro_informado: number | null
          valor_inicial: number
        }
        Insert: {
          aberto_em?: string
          created_at?: string
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          saldo_final?: number | null
          status?: string
          total_credito?: number
          total_debito?: number
          total_dinheiro?: number
          total_entradas?: number
          total_pix?: number
          total_reforcos?: number
          total_saidas?: number
          total_sangrias?: number
          updated_at?: string
          usuario_abertura_id?: string | null
          usuario_fechamento_id?: string | null
          valor_dinheiro_esperado?: number | null
          valor_dinheiro_informado?: number | null
          valor_inicial?: number
        }
        Update: {
          aberto_em?: string
          created_at?: string
          diferenca?: number | null
          fechado_em?: string | null
          id?: string
          observacoes_abertura?: string | null
          observacoes_fechamento?: string | null
          saldo_final?: number | null
          status?: string
          total_credito?: number
          total_debito?: number
          total_dinheiro?: number
          total_entradas?: number
          total_pix?: number
          total_reforcos?: number
          total_saidas?: number
          total_sangrias?: number
          updated_at?: string
          usuario_abertura_id?: string | null
          usuario_fechamento_id?: string | null
          valor_dinheiro_esperado?: number | null
          valor_dinheiro_informado?: number | null
          valor_inicial?: number
        }
        Relationships: []
      }
      categorias_produtos: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      clientes: {
        Row: {
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          observacoes: string | null
          por_quem_veio: string | null
          quem_indicou: string | null
          telefone: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          por_quem_veio?: string | null
          quem_indicou?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          data_nascimento?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          por_quem_veio?: string | null
          quem_indicou?: string | null
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      configuracoes_loja: {
        Row: {
          cnpj: string | null
          dias_alerta_vencimento: number
          endereco: string | null
          estoque_minimo_padrao: number
          formas_pagamento_ativas: Json
          id: string
          logo_url: string | null
          nome_loja: string
          permitir_estoque_negativo: boolean
          telefone: string | null
          updated_at: string
        }
        Insert: {
          cnpj?: string | null
          dias_alerta_vencimento?: number
          endereco?: string | null
          estoque_minimo_padrao?: number
          formas_pagamento_ativas?: Json
          id?: string
          logo_url?: string | null
          nome_loja?: string
          permitir_estoque_negativo?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Update: {
          cnpj?: string | null
          dias_alerta_vencimento?: number
          endereco?: string | null
          estoque_minimo_padrao?: number
          formas_pagamento_ativas?: Json
          id?: string
          logo_url?: string | null
          nome_loja?: string
          permitir_estoque_negativo?: boolean
          telefone?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      estoque_itens: {
        Row: {
          alerta_vencimento_dias: number
          ativo: boolean
          categoria: string | null
          created_at: string
          custo_unitario: number
          data_ultima_compra: string | null
          estoque_minimo: number
          fornecedor: string | null
          id: string
          nome: string
          observacoes: string | null
          quantidade_atual: number
          unidade_medida: string
          updated_at: string
          validade: string | null
        }
        Insert: {
          alerta_vencimento_dias?: number
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_unitario?: number
          data_ultima_compra?: string | null
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          nome: string
          observacoes?: string | null
          quantidade_atual?: number
          unidade_medida?: string
          updated_at?: string
          validade?: string | null
        }
        Update: {
          alerta_vencimento_dias?: number
          ativo?: boolean
          categoria?: string | null
          created_at?: string
          custo_unitario?: number
          data_ultima_compra?: string | null
          estoque_minimo?: number
          fornecedor?: string | null
          id?: string
          nome?: string
          observacoes?: string | null
          quantidade_atual?: number
          unidade_medida?: string
          updated_at?: string
          validade?: string | null
        }
        Relationships: []
      }
      estoque_movimentacoes: {
        Row: {
          created_at: string
          custo_unitario: number | null
          id: string
          item_id: string
          motivo: string | null
          pedido_id: string | null
          pedido_item_id: string | null
          produto_id: string | null
          quantidade: number
          quantidade_anterior: number | null
          quantidade_posterior: number | null
          tipo: Database["public"]["Enums"]["tipo_mov_estoque"]
          tipo_movimentacao: string | null
          usuario_id: string | null
        }
        Insert: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          item_id: string
          motivo?: string | null
          pedido_id?: string | null
          pedido_item_id?: string | null
          produto_id?: string | null
          quantidade: number
          quantidade_anterior?: number | null
          quantidade_posterior?: number | null
          tipo: Database["public"]["Enums"]["tipo_mov_estoque"]
          tipo_movimentacao?: string | null
          usuario_id?: string | null
        }
        Update: {
          created_at?: string
          custo_unitario?: number | null
          id?: string
          item_id?: string
          motivo?: string | null
          pedido_id?: string | null
          pedido_item_id?: string | null
          produto_id?: string | null
          quantidade?: number
          quantidade_anterior?: number | null
          quantidade_posterior?: number | null
          tipo?: Database["public"]["Enums"]["tipo_mov_estoque"]
          tipo_movimentacao?: string | null
          usuario_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "estoque_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "estoque_movimentacoes_item_id_fkey"
            columns: ["item_id"]
            isOneToOne: false
            referencedRelation: "vw_estoque_alertas"
            referencedColumns: ["id"]
          },
        ]
      }
      financeiro_lancamentos: {
        Row: {
          caixa_id: string | null
          categoria: string
          created_at: string
          data: string
          data_lancamento: string
          descricao: string
          estorno_de: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          meu_slim_venda_id: string | null
          observacoes: string | null
          pedido_id: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          status: string
          tipo: Database["public"]["Enums"]["tipo_financeiro"]
          usuario_id: string | null
          valor: number
        }
        Insert: {
          caixa_id?: string | null
          categoria: string
          created_at?: string
          data?: string
          data_lancamento?: string
          descricao: string
          estorno_de?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          meu_slim_venda_id?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo: Database["public"]["Enums"]["tipo_financeiro"]
          usuario_id?: string | null
          valor: number
        }
        Update: {
          caixa_id?: string | null
          categoria?: string
          created_at?: string
          data?: string
          data_lancamento?: string
          descricao?: string
          estorno_de?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          meu_slim_venda_id?: string | null
          observacoes?: string | null
          pedido_id?: string | null
          referencia_id?: string | null
          referencia_tipo?: string | null
          status?: string
          tipo?: Database["public"]["Enums"]["tipo_financeiro"]
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "financeiro_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_estorno_de_fkey"
            columns: ["estorno_de"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_meu_slim_venda_id_fkey"
            columns: ["meu_slim_venda_id"]
            isOneToOne: false
            referencedRelation: "meu_slim_vendas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "financeiro_lancamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      meu_slim_vendas: {
        Row: {
          cliente_id: string | null
          created_at: string
          custo: number
          data_prevista_entrega: string | null
          data_venda: string
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro: number | null
          nome_cliente: string
          observacoes: string | null
          status_entrega: Database["public"]["Enums"]["status_entrega_kit"]
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          telefone: string | null
          tipo_kit: string
          updated_at: string
          usuario_id: string | null
          valor: number
        }
        Insert: {
          cliente_id?: string | null
          created_at?: string
          custo?: number
          data_prevista_entrega?: string | null
          data_venda?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lucro?: number | null
          nome_cliente: string
          observacoes?: string | null
          status_entrega?: Database["public"]["Enums"]["status_entrega_kit"]
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          telefone?: string | null
          tipo_kit: string
          updated_at?: string
          usuario_id?: string | null
          valor?: number
        }
        Update: {
          cliente_id?: string | null
          created_at?: string
          custo?: number
          data_prevista_entrega?: string | null
          data_venda?: string
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lucro?: number | null
          nome_cliente?: string
          observacoes?: string | null
          status_entrega?: Database["public"]["Enums"]["status_entrega_kit"]
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          telefone?: string | null
          tipo_kit?: string
          updated_at?: string
          usuario_id?: string | null
          valor?: number
        }
        Relationships: [
          {
            foreignKeyName: "meu_slim_vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meu_slim_vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_clientes_inativos_30dias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "meu_slim_vendas_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_clientes_top"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_itens: {
        Row: {
          adicionais: Json
          cancelado_em: string | null
          created_at: string
          custo_unitario: number
          entregue_em: string | null
          envia_para_cozinha: boolean
          enviado_cozinha_em: string | null
          estoque_baixado: boolean
          id: string
          motivo_cancelamento: string | null
          nome_produto: string
          observacoes: string | null
          observacoes_cozinha: string | null
          pedido_id: string
          preco_unitario: number
          preparo_iniciado_em: string | null
          produto_id: string | null
          pronto_em: string | null
          quantidade: number
          rodada: number
          sabor: string | null
          status_preparo: string
          subtotal: number
        }
        Insert: {
          adicionais?: Json
          cancelado_em?: string | null
          created_at?: string
          custo_unitario?: number
          entregue_em?: string | null
          envia_para_cozinha?: boolean
          enviado_cozinha_em?: string | null
          estoque_baixado?: boolean
          id?: string
          motivo_cancelamento?: string | null
          nome_produto: string
          observacoes?: string | null
          observacoes_cozinha?: string | null
          pedido_id: string
          preco_unitario?: number
          preparo_iniciado_em?: string | null
          produto_id?: string | null
          pronto_em?: string | null
          quantidade?: number
          rodada?: number
          sabor?: string | null
          status_preparo?: string
          subtotal?: number
        }
        Update: {
          adicionais?: Json
          cancelado_em?: string | null
          created_at?: string
          custo_unitario?: number
          entregue_em?: string | null
          envia_para_cozinha?: boolean
          enviado_cozinha_em?: string | null
          estoque_baixado?: boolean
          id?: string
          motivo_cancelamento?: string | null
          nome_produto?: string
          observacoes?: string | null
          observacoes_cozinha?: string | null
          pedido_id?: string
          preco_unitario?: number
          preparo_iniciado_em?: string | null
          produto_id?: string | null
          pronto_em?: string | null
          quantidade?: number
          rodada?: number
          sabor?: string | null
          status_preparo?: string
          subtotal?: number
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedido_pagamentos: {
        Row: {
          caixa_id: string | null
          created_at: string
          financeiro_lancamento_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id: string
          observacoes: string | null
          pedido_id: string
          status: string
          troco: number
          updated_at: string
          usuario_id: string | null
          valor: number
          valor_recebido: number | null
        }
        Insert: {
          caixa_id?: string | null
          created_at?: string
          financeiro_lancamento_id?: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          pedido_id: string
          status?: string
          troco?: number
          updated_at?: string
          usuario_id?: string | null
          valor: number
          valor_recebido?: number | null
        }
        Update: {
          caixa_id?: string | null
          created_at?: string
          financeiro_lancamento_id?: string | null
          forma_pagamento?: Database["public"]["Enums"]["forma_pagamento"]
          id?: string
          observacoes?: string | null
          pedido_id?: string
          status?: string
          troco?: number
          updated_at?: string
          usuario_id?: string | null
          valor?: number
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_pagamentos_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_pagamentos_financeiro_lancamento_id_fkey"
            columns: ["financeiro_lancamento_id"]
            isOneToOne: false
            referencedRelation: "financeiro_lancamentos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedido_pagamentos_pedido_id_fkey"
            columns: ["pedido_id"]
            isOneToOne: false
            referencedRelation: "pedidos"
            referencedColumns: ["id"]
          },
        ]
      }
      pedidos: {
        Row: {
          aberta_em: string | null
          baixado_por: string | null
          caixa_id: string | null
          cancelado_em: string | null
          cliente_id: string | null
          cliente_nome_rapido: string | null
          cliente_telefone_rapido: string | null
          created_at: string
          custo_total: number
          data_hora: string
          desconto: number
          estoque_baixado: boolean
          estoque_baixado_em: string | null
          fechada_em: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro_estimado: number
          motivo_cancelamento: string | null
          motivo_reabertura: string | null
          numero: number
          observacoes: string | null
          pago_em: string | null
          reaberta_em: string | null
          reaberta_por: string | null
          status_comanda: string
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          status_pedido: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          tipo_registro: string
          total: number
          troco: number | null
          updated_at: string
          usuario_id: string | null
          valor_pago: number
          valor_pendente: number
          valor_recebido: number | null
        }
        Insert: {
          aberta_em?: string | null
          baixado_por?: string | null
          caixa_id?: string | null
          cancelado_em?: string | null
          cliente_id?: string | null
          cliente_nome_rapido?: string | null
          cliente_telefone_rapido?: string | null
          created_at?: string
          custo_total?: number
          data_hora?: string
          desconto?: number
          estoque_baixado?: boolean
          estoque_baixado_em?: string | null
          fechada_em?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lucro_estimado?: number
          motivo_cancelamento?: string | null
          motivo_reabertura?: string | null
          numero?: number
          observacoes?: string | null
          pago_em?: string | null
          reaberta_em?: string | null
          reaberta_por?: string | null
          status_comanda?: string
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          status_pedido?: Database["public"]["Enums"]["status_pedido"]
          subtotal?: number
          tipo_registro?: string
          total?: number
          troco?: number | null
          updated_at?: string
          usuario_id?: string | null
          valor_pago?: number
          valor_pendente?: number
          valor_recebido?: number | null
        }
        Update: {
          aberta_em?: string | null
          baixado_por?: string | null
          caixa_id?: string | null
          cancelado_em?: string | null
          cliente_id?: string | null
          cliente_nome_rapido?: string | null
          cliente_telefone_rapido?: string | null
          created_at?: string
          custo_total?: number
          data_hora?: string
          desconto?: number
          estoque_baixado?: boolean
          estoque_baixado_em?: string | null
          fechada_em?: string | null
          forma_pagamento?:
            | Database["public"]["Enums"]["forma_pagamento"]
            | null
          id?: string
          lucro_estimado?: number
          motivo_cancelamento?: string | null
          motivo_reabertura?: string | null
          numero?: number
          observacoes?: string | null
          pago_em?: string | null
          reaberta_em?: string | null
          reaberta_por?: string | null
          status_comanda?: string
          status_pagamento?: Database["public"]["Enums"]["status_pagamento"]
          status_pedido?: Database["public"]["Enums"]["status_pedido"]
          subtotal?: number
          tipo_registro?: string
          total?: number
          troco?: number | null
          updated_at?: string
          usuario_id?: string | null
          valor_pago?: number
          valor_pendente?: number
          valor_recebido?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedidos_caixa_id_fkey"
            columns: ["caixa_id"]
            isOneToOne: false
            referencedRelation: "caixas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "clientes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_clientes_inativos_30dias"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pedidos_cliente_id_fkey"
            columns: ["cliente_id"]
            isOneToOne: false
            referencedRelation: "vw_clientes_top"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_adicionais: {
        Row: {
          adicional_id: string
          produto_id: string
        }
        Insert: {
          adicional_id: string
          produto_id: string
        }
        Update: {
          adicional_id?: string
          produto_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_adicionais_adicional_id_fkey"
            columns: ["adicional_id"]
            isOneToOne: false
            referencedRelation: "adicionais"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_adicionais_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_composicao: {
        Row: {
          ativo: boolean
          estoque_item_id: string
          id: string
          obrigatorio: boolean
          produto_id: string
          quantidade_por_unidade: number
          unidade_medida: string | null
          updated_at: string
        }
        Insert: {
          ativo?: boolean
          estoque_item_id: string
          id?: string
          obrigatorio?: boolean
          produto_id: string
          quantidade_por_unidade?: number
          unidade_medida?: string | null
          updated_at?: string
        }
        Update: {
          ativo?: boolean
          estoque_item_id?: string
          id?: string
          obrigatorio?: boolean
          produto_id?: string
          quantidade_por_unidade?: number
          unidade_medida?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_composicao_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_composicao_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "vw_estoque_alertas"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_composicao_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
      produto_sabores: {
        Row: {
          produto_id: string
          sabor_id: string
        }
        Insert: {
          produto_id: string
          sabor_id: string
        }
        Update: {
          produto_id?: string
          sabor_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "produto_sabores_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produto_sabores_sabor_id_fkey"
            columns: ["sabor_id"]
            isOneToOne: false
            referencedRelation: "sabores"
            referencedColumns: ["id"]
          },
        ]
      }
      produtos: {
        Row: {
          aparece_no_pedido: boolean
          ativo: boolean
          categoria_id: string | null
          controla_estoque: boolean
          created_at: string
          custo: number
          descricao: string | null
          envia_para_cozinha: boolean
          estoque_item_id: string | null
          estoque_minimo: number
          estoque_quantidade_por_unidade: number
          id: string
          lucro: number | null
          nome: string
          permite_adicionais: boolean
          permite_sabor: boolean
          preco: number
          produto_fechado: boolean
          updated_at: string
        }
        Insert: {
          aparece_no_pedido?: boolean
          ativo?: boolean
          categoria_id?: string | null
          controla_estoque?: boolean
          created_at?: string
          custo?: number
          descricao?: string | null
          envia_para_cozinha?: boolean
          estoque_item_id?: string | null
          estoque_minimo?: number
          estoque_quantidade_por_unidade?: number
          id?: string
          lucro?: number | null
          nome: string
          permite_adicionais?: boolean
          permite_sabor?: boolean
          preco?: number
          produto_fechado?: boolean
          updated_at?: string
        }
        Update: {
          aparece_no_pedido?: boolean
          ativo?: boolean
          categoria_id?: string | null
          controla_estoque?: boolean
          created_at?: string
          custo?: number
          descricao?: string | null
          envia_para_cozinha?: boolean
          estoque_item_id?: string | null
          estoque_minimo?: number
          estoque_quantidade_por_unidade?: number
          id?: string
          lucro?: number | null
          nome?: string
          permite_adicionais?: boolean
          permite_sabor?: boolean
          preco?: number
          produto_fechado?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "produtos_categoria_id_fkey"
            columns: ["categoria_id"]
            isOneToOne: false
            referencedRelation: "categorias_produtos"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "estoque_itens"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "produtos_estoque_item_id_fkey"
            columns: ["estoque_item_id"]
            isOneToOne: false
            referencedRelation: "vw_estoque_alertas"
            referencedColumns: ["id"]
          },
        ]
      }
      sabores: {
        Row: {
          ativo: boolean
          created_at: string
          id: string
          nome: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          id?: string
          nome?: string
        }
        Relationships: []
      }
      users_profiles: {
        Row: {
          ativo: boolean
          created_at: string
          email: string | null
          id: string
          nome: string
          pode_ver_financeiro: boolean
          role: Database["public"]["Enums"]["app_role"]
          updated_at: string
          user_id: string
        }
        Insert: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          pode_ver_financeiro?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id: string
        }
        Update: {
          ativo?: boolean
          created_at?: string
          email?: string | null
          id?: string
          nome?: string
          pode_ver_financeiro?: boolean
          role?: Database["public"]["Enums"]["app_role"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      vw_clientes_inativos_30dias: {
        Row: {
          id: string | null
          nome: string | null
          telefone: string | null
          ultima_compra: string | null
        }
        Relationships: []
      }
      vw_clientes_top: {
        Row: {
          id: string | null
          nome: string | null
          qtd_pedidos: number | null
          telefone: string | null
          total_gasto: number | null
          ultima_compra: string | null
        }
        Relationships: []
      }
      vw_estoque_alertas: {
        Row: {
          alerta: string | null
          ativo: boolean | null
          categoria: string | null
          created_at: string | null
          custo_unitario: number | null
          estoque_minimo: number | null
          fornecedor: string | null
          id: string | null
          nome: string | null
          quantidade_atual: number | null
          unidade_medida: string | null
          updated_at: string | null
          validade: string | null
        }
        Insert: {
          alerta?: never
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          custo_unitario?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string | null
          nome?: string | null
          quantidade_atual?: number | null
          unidade_medida?: string | null
          updated_at?: string | null
          validade?: string | null
        }
        Update: {
          alerta?: never
          ativo?: boolean | null
          categoria?: string | null
          created_at?: string | null
          custo_unitario?: number | null
          estoque_minimo?: number | null
          fornecedor?: string | null
          id?: string | null
          nome?: string | null
          quantidade_atual?: number | null
          unidade_medida?: string | null
          updated_at?: string | null
          validade?: string | null
        }
        Relationships: []
      }
      vw_produtos_mais_vendidos: {
        Row: {
          nome_produto: string | null
          produto_id: string | null
          qtd_vendida: number | null
          total_vendido: number | null
        }
        Relationships: [
          {
            foreignKeyName: "pedido_itens_produto_id_fkey"
            columns: ["produto_id"]
            isOneToOne: false
            referencedRelation: "produtos"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      _caixa_acumula: {
        Args: {
          _caixa_id: string
          _forma: Database["public"]["Enums"]["forma_pagamento"]
          _valor: number
        }
        Returns: undefined
      }
      abrir_caixa: {
        Args: { _observacoes?: string; _valor_inicial?: number }
        Returns: {
          aberto_em: string
          created_at: string
          diferenca: number | null
          fechado_em: string | null
          id: string
          observacoes_abertura: string | null
          observacoes_fechamento: string | null
          saldo_final: number | null
          status: string
          total_credito: number
          total_debito: number
          total_dinheiro: number
          total_entradas: number
          total_pix: number
          total_reforcos: number
          total_saidas: number
          total_sangrias: number
          updated_at: string
          usuario_abertura_id: string | null
          usuario_fechamento_id: string | null
          valor_dinheiro_esperado: number | null
          valor_dinheiro_informado: number | null
          valor_inicial: number
        }
        SetofOptions: {
          from: "*"
          to: "caixas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      abrir_comanda: {
        Args: {
          _cliente_id?: string
          _cliente_nome?: string
          _cliente_telefone?: string
          _observacoes?: string
        }
        Returns: {
          aberta_em: string | null
          baixado_por: string | null
          caixa_id: string | null
          cancelado_em: string | null
          cliente_id: string | null
          cliente_nome_rapido: string | null
          cliente_telefone_rapido: string | null
          created_at: string
          custo_total: number
          data_hora: string
          desconto: number
          estoque_baixado: boolean
          estoque_baixado_em: string | null
          fechada_em: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro_estimado: number
          motivo_cancelamento: string | null
          motivo_reabertura: string | null
          numero: number
          observacoes: string | null
          pago_em: string | null
          reaberta_em: string | null
          reaberta_por: string | null
          status_comanda: string
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          status_pedido: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          tipo_registro: string
          total: number
          troco: number | null
          updated_at: string
          usuario_id: string | null
          valor_pago: number
          valor_pendente: number
          valor_recebido: number | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      adicionar_item_comanda:
        | {
            Args: {
              _adicionais?: Json
              _observacoes?: string
              _pedido_id: string
              _produto_id: string
              _quantidade?: number
              _sabor?: string
            }
            Returns: {
              adicionais: Json
              cancelado_em: string | null
              created_at: string
              custo_unitario: number
              entregue_em: string | null
              envia_para_cozinha: boolean
              enviado_cozinha_em: string | null
              estoque_baixado: boolean
              id: string
              motivo_cancelamento: string | null
              nome_produto: string
              observacoes: string | null
              observacoes_cozinha: string | null
              pedido_id: string
              preco_unitario: number
              preparo_iniciado_em: string | null
              produto_id: string | null
              pronto_em: string | null
              quantidade: number
              rodada: number
              sabor: string | null
              status_preparo: string
              subtotal: number
            }
            SetofOptions: {
              from: "*"
              to: "pedido_itens"
              isOneToOne: true
              isSetofReturn: false
            }
          }
        | {
            Args: {
              _adicionais?: Json
              _envia_para_cozinha?: boolean
              _observacoes?: string
              _pedido_id: string
              _produto_id: string
              _quantidade?: number
              _sabor?: string
            }
            Returns: {
              adicionais: Json
              cancelado_em: string | null
              created_at: string
              custo_unitario: number
              entregue_em: string | null
              envia_para_cozinha: boolean
              enviado_cozinha_em: string | null
              estoque_baixado: boolean
              id: string
              motivo_cancelamento: string | null
              nome_produto: string
              observacoes: string | null
              observacoes_cozinha: string | null
              pedido_id: string
              preco_unitario: number
              preparo_iniciado_em: string | null
              produto_id: string | null
              pronto_em: string | null
              quantidade: number
              rodada: number
              sabor: string | null
              status_preparo: string
              subtotal: number
            }
            SetofOptions: {
              from: "*"
              to: "pedido_itens"
              isOneToOne: true
              isSetofReturn: false
            }
          }
      avancar_item_preparo: {
        Args: { _item_id: string; _novo_status: string }
        Returns: {
          adicionais: Json
          cancelado_em: string | null
          created_at: string
          custo_unitario: number
          entregue_em: string | null
          envia_para_cozinha: boolean
          enviado_cozinha_em: string | null
          estoque_baixado: boolean
          id: string
          motivo_cancelamento: string | null
          nome_produto: string
          observacoes: string | null
          observacoes_cozinha: string | null
          pedido_id: string
          preco_unitario: number
          preparo_iniciado_em: string | null
          produto_id: string | null
          pronto_em: string | null
          quantidade: number
          rodada: number
          sabor: string | null
          status_preparo: string
          subtotal: number
        }
        SetofOptions: {
          from: "*"
          to: "pedido_itens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      baixar_estoque_comanda: {
        Args: { _forcar?: boolean; _pedido_id: string }
        Returns: Json
      }
      cancelar_item_comanda: {
        Args: { _item_id: string; _motivo?: string }
        Returns: {
          adicionais: Json
          cancelado_em: string | null
          created_at: string
          custo_unitario: number
          entregue_em: string | null
          envia_para_cozinha: boolean
          enviado_cozinha_em: string | null
          estoque_baixado: boolean
          id: string
          motivo_cancelamento: string | null
          nome_produto: string
          observacoes: string | null
          observacoes_cozinha: string | null
          pedido_id: string
          preco_unitario: number
          preparo_iniciado_em: string | null
          produto_id: string | null
          pronto_em: string | null
          quantidade: number
          rodada: number
          sabor: string | null
          status_preparo: string
          subtotal: number
        }
        SetofOptions: {
          from: "*"
          to: "pedido_itens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_lancamento_financeiro: {
        Args: { _id: string; _motivo: string }
        Returns: {
          caixa_id: string | null
          categoria: string
          created_at: string
          data: string
          data_lancamento: string
          descricao: string
          estorno_de: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          meu_slim_venda_id: string | null
          observacoes: string | null
          pedido_id: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          status: string
          tipo: Database["public"]["Enums"]["tipo_financeiro"]
          usuario_id: string | null
          valor: number
        }
        SetofOptions: {
          from: "*"
          to: "financeiro_lancamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      cancelar_pedido: {
        Args: { _motivo?: string; _pedido_id: string }
        Returns: {
          aberta_em: string | null
          baixado_por: string | null
          caixa_id: string | null
          cancelado_em: string | null
          cliente_id: string | null
          cliente_nome_rapido: string | null
          cliente_telefone_rapido: string | null
          created_at: string
          custo_total: number
          data_hora: string
          desconto: number
          estoque_baixado: boolean
          estoque_baixado_em: string | null
          fechada_em: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro_estimado: number
          motivo_cancelamento: string | null
          motivo_reabertura: string | null
          numero: number
          observacoes: string | null
          pago_em: string | null
          reaberta_em: string | null
          reaberta_por: string | null
          status_comanda: string
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          status_pedido: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          tipo_registro: string
          total: number
          troco: number | null
          updated_at: string
          usuario_id: string | null
          valor_pago: number
          valor_pendente: number
          valor_recebido: number | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      devolver_estoque_comanda: {
        Args: { _motivo?: string; _pedido_id: string }
        Returns: Json
      }
      estornar_lancamento: {
        Args: { _lancamento_id: string; _motivo: string }
        Returns: {
          caixa_id: string | null
          categoria: string
          created_at: string
          data: string
          data_lancamento: string
          descricao: string
          estorno_de: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          meu_slim_venda_id: string | null
          observacoes: string | null
          pedido_id: string | null
          referencia_id: string | null
          referencia_tipo: string | null
          status: string
          tipo: Database["public"]["Enums"]["tipo_financeiro"]
          usuario_id: string | null
          valor: number
        }
        SetofOptions: {
          from: "*"
          to: "financeiro_lancamentos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fechar_caixa: {
        Args: { _observacoes?: string; _valor_dinheiro: number }
        Returns: {
          aberto_em: string
          created_at: string
          diferenca: number | null
          fechado_em: string | null
          id: string
          observacoes_abertura: string | null
          observacoes_fechamento: string | null
          saldo_final: number | null
          status: string
          total_credito: number
          total_debito: number
          total_dinheiro: number
          total_entradas: number
          total_pix: number
          total_reforcos: number
          total_saidas: number
          total_sangrias: number
          updated_at: string
          usuario_abertura_id: string | null
          usuario_fechamento_id: string | null
          valor_dinheiro_esperado: number | null
          valor_dinheiro_informado: number | null
          valor_inicial: number
        }
        SetofOptions: {
          from: "*"
          to: "caixas"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      fechar_comanda: {
        Args: {
          _desconto?: number
          _forma_pagamento: Database["public"]["Enums"]["forma_pagamento"]
          _observacoes?: string
          _pedido_id: string
          _valor_recebido?: number
        }
        Returns: {
          aberta_em: string | null
          baixado_por: string | null
          caixa_id: string | null
          cancelado_em: string | null
          cliente_id: string | null
          cliente_nome_rapido: string | null
          cliente_telefone_rapido: string | null
          created_at: string
          custo_total: number
          data_hora: string
          desconto: number
          estoque_baixado: boolean
          estoque_baixado_em: string | null
          fechada_em: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro_estimado: number
          motivo_cancelamento: string | null
          motivo_reabertura: string | null
          numero: number
          observacoes: string | null
          pago_em: string | null
          reaberta_em: string | null
          reaberta_por: string | null
          status_comanda: string
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          status_pedido: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          tipo_registro: string
          total: number
          troco: number | null
          updated_at: string
          usuario_id: string | null
          valor_pago: number
          valor_pendente: number
          valor_recebido: number | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_admin: { Args: never; Returns: boolean }
      log_audit: {
        Args: {
          _acao: string
          _descricao?: string
          _entidade: string
          _entidade_id: string
          _metadata?: Json
          _motivo?: string
        }
        Returns: undefined
      }
      pode_financeiro: { Args: never; Returns: boolean }
      reabrir_comanda: {
        Args: { _motivo: string; _pedido_id: string }
        Returns: {
          aberta_em: string | null
          baixado_por: string | null
          caixa_id: string | null
          cancelado_em: string | null
          cliente_id: string | null
          cliente_nome_rapido: string | null
          cliente_telefone_rapido: string | null
          created_at: string
          custo_total: number
          data_hora: string
          desconto: number
          estoque_baixado: boolean
          estoque_baixado_em: string | null
          fechada_em: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro_estimado: number
          motivo_cancelamento: string | null
          motivo_reabertura: string | null
          numero: number
          observacoes: string | null
          pago_em: string | null
          reaberta_em: string | null
          reaberta_por: string | null
          status_comanda: string
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          status_pedido: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          tipo_registro: string
          total: number
          troco: number | null
          updated_at: string
          usuario_id: string | null
          valor_pago: number
          valor_pendente: number
          valor_recebido: number | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      recalc_pedido_totais: { Args: { _pedido_id: string }; Returns: undefined }
      registrar_entrada_estoque: {
        Args: {
          _custo_unitario?: number
          _fornecedor?: string
          _item_id: string
          _observacoes?: string
          _quantidade: number
          _validade?: string
        }
        Returns: {
          alerta_vencimento_dias: number
          ativo: boolean
          categoria: string | null
          created_at: string
          custo_unitario: number
          data_ultima_compra: string | null
          estoque_minimo: number
          fornecedor: string | null
          id: string
          nome: string
          observacoes: string | null
          quantidade_atual: number
          unidade_medida: string
          updated_at: string
          validade: string | null
        }
        SetofOptions: {
          from: "*"
          to: "estoque_itens"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_pagamento_comanda: {
        Args: { _pagamentos: Json; _pedido_id: string }
        Returns: {
          aberta_em: string | null
          baixado_por: string | null
          caixa_id: string | null
          cancelado_em: string | null
          cliente_id: string | null
          cliente_nome_rapido: string | null
          cliente_telefone_rapido: string | null
          created_at: string
          custo_total: number
          data_hora: string
          desconto: number
          estoque_baixado: boolean
          estoque_baixado_em: string | null
          fechada_em: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          lucro_estimado: number
          motivo_cancelamento: string | null
          motivo_reabertura: string | null
          numero: number
          observacoes: string | null
          pago_em: string | null
          reaberta_em: string | null
          reaberta_por: string | null
          status_comanda: string
          status_pagamento: Database["public"]["Enums"]["status_pagamento"]
          status_pedido: Database["public"]["Enums"]["status_pedido"]
          subtotal: number
          tipo_registro: string
          total: number
          troco: number | null
          updated_at: string
          usuario_id: string | null
          valor_pago: number
          valor_pendente: number
          valor_recebido: number | null
        }
        SetofOptions: {
          from: "*"
          to: "pedidos"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_reforco: {
        Args: { _motivo: string; _valor: number }
        Returns: {
          caixa_id: string
          created_at: string
          descricao: string | null
          financeiro_lancamento_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          pedido_id: string | null
          pedido_pagamento_id: string | null
          tipo: string
          usuario_id: string | null
          valor: number
        }
        SetofOptions: {
          from: "*"
          to: "caixa_movimentacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_saida_manual_estoque: {
        Args: {
          _item_id: string
          _motivo: string
          _quantidade: number
          _tipo_movimentacao: string
        }
        Returns: {
          created_at: string
          custo_unitario: number | null
          id: string
          item_id: string
          motivo: string | null
          pedido_id: string | null
          pedido_item_id: string | null
          produto_id: string | null
          quantidade: number
          quantidade_anterior: number | null
          quantidade_posterior: number | null
          tipo: Database["public"]["Enums"]["tipo_mov_estoque"]
          tipo_movimentacao: string | null
          usuario_id: string | null
        }
        SetofOptions: {
          from: "*"
          to: "estoque_movimentacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      registrar_sangria: {
        Args: { _motivo: string; _valor: number }
        Returns: {
          caixa_id: string
          created_at: string
          descricao: string | null
          financeiro_lancamento_id: string | null
          forma_pagamento: Database["public"]["Enums"]["forma_pagamento"] | null
          id: string
          pedido_id: string | null
          pedido_pagamento_id: string | null
          tipo: string
          usuario_id: string | null
          valor: number
        }
        SetofOptions: {
          from: "*"
          to: "caixa_movimentacoes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      upsert_cliente: {
        Args: {
          _data_nascimento?: string
          _nome: string
          _observacoes?: string
          _por_quem_veio?: string
          _quem_indicou?: string
          _telefone: string
        }
        Returns: {
          created_at: string
          data_nascimento: string | null
          id: string
          nome: string
          observacoes: string | null
          por_quem_veio: string | null
          quem_indicou: string | null
          telefone: string | null
          updated_at: string
        }
        SetofOptions: {
          from: "*"
          to: "clientes"
          isOneToOne: true
          isSetofReturn: false
        }
      }
    }
    Enums: {
      app_role: "admin" | "funcionario"
      forma_pagamento: "pix" | "dinheiro" | "debito" | "credito"
      status_entrega_kit: "pendente" | "em_producao" | "entregue" | "cancelado"
      status_pagamento: "pago" | "pendente" | "cancelado" | "parcial"
      status_pedido:
        | "recebido"
        | "em_preparo"
        | "na_cozinha"
        | "em_producao"
        | "pronto"
        | "em_entrega"
        | "entregue"
        | "cancelado"
      tipo_financeiro: "entrada" | "saida"
      tipo_mov_estoque:
        | "entrada"
        | "saida"
        | "ajuste"
        | "perda"
        | "vencimento"
        | "uso_interno"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "funcionario"],
      forma_pagamento: ["pix", "dinheiro", "debito", "credito"],
      status_entrega_kit: ["pendente", "em_producao", "entregue", "cancelado"],
      status_pagamento: ["pago", "pendente", "cancelado", "parcial"],
      status_pedido: [
        "recebido",
        "em_preparo",
        "na_cozinha",
        "em_producao",
        "pronto",
        "em_entrega",
        "entregue",
        "cancelado",
      ],
      tipo_financeiro: ["entrada", "saida"],
      tipo_mov_estoque: [
        "entrada",
        "saida",
        "ajuste",
        "perda",
        "vencimento",
        "uso_interno",
      ],
    },
  },
} as const
