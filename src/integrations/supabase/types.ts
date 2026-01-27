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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
      affiliate_clicks: {
        Row: {
          affiliate_id: string
          created_at: string
          id: string
          ip_address: string | null
          landing_url: string | null
          referrer_url: string | null
          user_agent: string | null
        }
        Insert: {
          affiliate_id: string
          created_at?: string
          id?: string
          ip_address?: string | null
          landing_url?: string | null
          referrer_url?: string | null
          user_agent?: string | null
        }
        Update: {
          affiliate_id?: string
          created_at?: string
          id?: string
          ip_address?: string | null
          landing_url?: string | null
          referrer_url?: string | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_clicks_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commission_rates: {
        Row: {
          commission_type: Database["public"]["Enums"]["commission_type"]
          commission_value: number
          created_at: string
          id: string
          plan_id: string
          updated_at: string
        }
        Insert: {
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          created_at?: string
          id?: string
          plan_id: string
          updated_at?: string
        }
        Update: {
          commission_type?: Database["public"]["Enums"]["commission_type"]
          commission_value?: number
          created_at?: string
          id?: string
          plan_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commission_rates_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: true
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          approved_at: string | null
          approved_by: string | null
          cancel_reason: string | null
          cancelled_at: string | null
          commission_amount: number
          commission_rate: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at: string
          hold_until: string | null
          id: string
          order_amount: number
          paid_at: string | null
          payment_request_id: string | null
          plan_id: string | null
          referral_id: string
          status: Database["public"]["Enums"]["commission_status"]
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          commission_amount: number
          commission_rate: number
          commission_type: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          hold_until?: string | null
          id?: string
          order_amount: number
          paid_at?: string | null
          payment_request_id?: string | null
          plan_id?: string | null
          referral_id: string
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          approved_at?: string | null
          approved_by?: string | null
          cancel_reason?: string | null
          cancelled_at?: string | null
          commission_amount?: number
          commission_rate?: number
          commission_type?: Database["public"]["Enums"]["commission_type"]
          created_at?: string
          hold_until?: string | null
          id?: string
          order_amount?: number
          paid_at?: string | null
          payment_request_id?: string | null
          plan_id?: string | null
          referral_id?: string
          status?: Database["public"]["Enums"]["commission_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_referral_id_fkey"
            columns: ["referral_id"]
            isOneToOne: false
            referencedRelation: "affiliate_referrals"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_referrals: {
        Row: {
          affiliate_id: string
          converted_at: string | null
          id: string
          ip_address: string | null
          referred_email: string | null
          referred_phone: string | null
          referred_tenant_id: string
          referred_user_id: string
          registered_at: string
          status: string
        }
        Insert: {
          affiliate_id: string
          converted_at?: string | null
          id?: string
          ip_address?: string | null
          referred_email?: string | null
          referred_phone?: string | null
          referred_tenant_id: string
          referred_user_id: string
          registered_at?: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          converted_at?: string | null
          id?: string
          ip_address?: string | null
          referred_email?: string | null
          referred_phone?: string | null
          referred_tenant_id?: string
          referred_user_id?: string
          registered_at?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_referrals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_referrals_referred_tenant_id_fkey"
            columns: ["referred_tenant_id"]
            isOneToOne: true
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliate_settings: {
        Row: {
          check_same_email: boolean
          check_same_ip: boolean
          check_same_phone: boolean
          commission_description: string | null
          created_at: string
          hold_days: number
          id: string
          is_enabled: boolean
          min_subscription_months: number
          min_withdrawal_amount: number
          require_approval: boolean
          updated_at: string
        }
        Insert: {
          check_same_email?: boolean
          check_same_ip?: boolean
          check_same_phone?: boolean
          commission_description?: string | null
          created_at?: string
          hold_days?: number
          id?: string
          is_enabled?: boolean
          min_subscription_months?: number
          min_withdrawal_amount?: number
          require_approval?: boolean
          updated_at?: string
        }
        Update: {
          check_same_email?: boolean
          check_same_ip?: boolean
          check_same_phone?: boolean
          commission_description?: string | null
          created_at?: string
          hold_days?: number
          id?: string
          is_enabled?: boolean
          min_subscription_months?: number
          min_withdrawal_amount?: number
          require_approval?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      affiliate_withdrawals: {
        Row: {
          affiliate_id: string
          amount: number
          bank_account_holder: string
          bank_account_number: string
          bank_name: string
          created_at: string
          id: string
          note: string | null
          processed_at: string | null
          processed_by: string | null
          rejected_reason: string | null
          status: Database["public"]["Enums"]["withdrawal_status"]
          updated_at: string
        }
        Insert: {
          affiliate_id: string
          amount: number
          bank_account_holder: string
          bank_account_number: string
          bank_name: string
          created_at?: string
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Update: {
          affiliate_id?: string
          amount?: number
          bank_account_holder?: string
          bank_account_number?: string
          bank_name?: string
          created_at?: string
          id?: string
          note?: string | null
          processed_at?: string | null
          processed_by?: string | null
          rejected_reason?: string | null
          status?: Database["public"]["Enums"]["withdrawal_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_withdrawals_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          affiliate_code: string
          available_balance: number
          bank_account_holder: string | null
          bank_account_number: string | null
          bank_name: string | null
          blocked_at: string | null
          blocked_reason: string | null
          created_at: string
          id: string
          ip_address: string | null
          pending_balance: number
          status: Database["public"]["Enums"]["affiliate_status"]
          tenant_id: string
          total_clicks: number
          total_commission_earned: number
          total_commission_paid: number
          total_conversions: number
          total_referrals: number
          updated_at: string
          user_id: string
        }
        Insert: {
          affiliate_code: string
          available_balance?: number
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          pending_balance?: number
          status?: Database["public"]["Enums"]["affiliate_status"]
          tenant_id: string
          total_clicks?: number
          total_commission_earned?: number
          total_commission_paid?: number
          total_conversions?: number
          total_referrals?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          affiliate_code?: string
          available_balance?: number
          bank_account_holder?: string | null
          bank_account_number?: string | null
          bank_name?: string | null
          blocked_at?: string | null
          blocked_reason?: string | null
          created_at?: string
          id?: string
          ip_address?: string | null
          pending_balance?: number
          status?: Database["public"]["Enums"]["affiliate_status"]
          tenant_id?: string
          total_clicks?: number
          total_commission_earned?: number
          total_commission_paid?: number
          total_conversions?: number
          total_referrals?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: string
          branch_id: string | null
          created_at: string
          description: string | null
          id: string
          ip_address: string | null
          new_data: Json | null
          old_data: Json | null
          record_id: string | null
          table_name: string | null
          tenant_id: string | null
          user_id: string | null
        }
        Insert: {
          action_type: string
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: string
          branch_id?: string | null
          created_at?: string
          description?: string | null
          id?: string
          ip_address?: string | null
          new_data?: Json | null
          old_data?: Json | null
          record_id?: string | null
          table_name?: string | null
          tenant_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      bank_accounts: {
        Row: {
          account_holder: string
          account_number: string
          bank_name: string
          created_at: string
          display_order: number | null
          id: string
          is_active: boolean
          updated_at: string
        }
        Insert: {
          account_holder: string
          account_number: string
          bank_name: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Update: {
          account_holder?: string
          account_number?: string
          bank_name?: string
          created_at?: string
          display_order?: number | null
          id?: string
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      branches: {
        Row: {
          address: string | null
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          note: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          note?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          note?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "branches_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_book: {
        Row: {
          amount: number
          branch_id: string | null
          category: string
          created_at: string
          created_by: string | null
          description: string
          id: string
          is_business_accounting: boolean | null
          note: string | null
          payment_source: string
          reference_id: string | null
          reference_type: string | null
          tenant_id: string | null
          transaction_date: string
          type: Database["public"]["Enums"]["cash_book_type"]
          updated_at: string
        }
        Insert: {
          amount: number
          branch_id?: string | null
          category: string
          created_at?: string
          created_by?: string | null
          description: string
          id?: string
          is_business_accounting?: boolean | null
          note?: string | null
          payment_source: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          transaction_date?: string
          type: Database["public"]["Enums"]["cash_book_type"]
          updated_at?: string
        }
        Update: {
          amount?: number
          branch_id?: string | null
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string
          id?: string
          is_business_accounting?: boolean | null
          note?: string | null
          payment_source?: string
          reference_id?: string | null
          reference_type?: string | null
          tenant_id?: string | null
          transaction_date?: string
          type?: Database["public"]["Enums"]["cash_book_type"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_book_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_book_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_book_backup: {
        Row: {
          backup_date: string | null
          data: Json
          id: string
          tenant_id: string | null
        }
        Insert: {
          backup_date?: string | null
          data: Json
          id?: string
          tenant_id?: string | null
        }
        Update: {
          backup_date?: string | null
          data?: Json
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "cash_book_backup_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_book_categories: {
        Row: {
          created_at: string
          id: string
          is_default: boolean | null
          name: string
          type: Database["public"]["Enums"]["cash_book_type"]
        }
        Insert: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name: string
          type: Database["public"]["Enums"]["cash_book_type"]
        }
        Update: {
          created_at?: string
          id?: string
          is_default?: boolean | null
          name?: string
          type?: Database["public"]["Enums"]["cash_book_type"]
        }
        Relationships: []
      }
      categories: {
        Row: {
          created_at: string
          id: string
          name: string
          parent_id: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          parent_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          parent_id?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "categories_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "categories_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_domains: {
        Row: {
          created_at: string
          domain: string
          id: string
          is_verified: boolean
          ssl_status: string | null
          tenant_id: string
          updated_at: string
          verification_token: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          domain: string
          id?: string
          is_verified?: boolean
          ssl_status?: string | null
          tenant_id: string
          updated_at?: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          domain?: string
          id?: string
          is_verified?: boolean
          ssl_status?: string | null
          tenant_id?: string
          updated_at?: string
          verification_token?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "custom_domains_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      customers: {
        Row: {
          address: string | null
          birthday: string | null
          created_at: string
          current_points: number
          email: string | null
          id: string
          last_purchase_date: string | null
          membership_tier: Database["public"]["Enums"]["membership_tier"]
          name: string
          note: string | null
          pending_points: number
          phone: string
          preferred_branch_id: string | null
          status: Database["public"]["Enums"]["customer_status"]
          tenant_id: string | null
          total_points_earned: number
          total_points_used: number
          total_spent: number
          updated_at: string
        }
        Insert: {
          address?: string | null
          birthday?: string | null
          created_at?: string
          current_points?: number
          email?: string | null
          id?: string
          last_purchase_date?: string | null
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          name: string
          note?: string | null
          pending_points?: number
          phone: string
          preferred_branch_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          tenant_id?: string | null
          total_points_earned?: number
          total_points_used?: number
          total_spent?: number
          updated_at?: string
        }
        Update: {
          address?: string | null
          birthday?: string | null
          created_at?: string
          current_points?: number
          email?: string | null
          id?: string
          last_purchase_date?: string | null
          membership_tier?: Database["public"]["Enums"]["membership_tier"]
          name?: string
          note?: string | null
          pending_points?: number
          phone?: string
          preferred_branch_id?: string | null
          status?: Database["public"]["Enums"]["customer_status"]
          tenant_id?: string | null
          total_points_earned?: number
          total_points_used?: number
          total_spent?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "customers_preferred_branch_id_fkey"
            columns: ["preferred_branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "customers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      debt_payments: {
        Row: {
          amount: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string
          entity_id: string
          entity_type: string
          id: string
          payment_source: string | null
          payment_type: string
          tenant_id: string | null
        }
        Insert: {
          amount: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description: string
          entity_id: string
          entity_type: string
          id?: string
          payment_source?: string | null
          payment_type: string
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string
          entity_id?: string
          entity_type?: string
          id?: string
          payment_source?: string | null
          payment_type?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "debt_payments_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "debt_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_configs: {
        Row: {
          api_key_encrypted: string | null
          api_url: string
          company_address: string | null
          company_email: string | null
          company_name: string
          company_phone: string | null
          created_at: string
          id: string
          invoice_series: string | null
          invoice_template: string | null
          is_active: boolean
          provider: Database["public"]["Enums"]["einvoice_provider"]
          provider_name: string
          sandbox_mode: boolean
          tax_code: string
          tenant_id: string
          updated_at: string
          username: string | null
        }
        Insert: {
          api_key_encrypted?: string | null
          api_url: string
          company_address?: string | null
          company_email?: string | null
          company_name: string
          company_phone?: string | null
          created_at?: string
          id?: string
          invoice_series?: string | null
          invoice_template?: string | null
          is_active?: boolean
          provider?: Database["public"]["Enums"]["einvoice_provider"]
          provider_name: string
          sandbox_mode?: boolean
          tax_code: string
          tenant_id: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          api_key_encrypted?: string | null
          api_url?: string
          company_address?: string | null
          company_email?: string | null
          company_name?: string
          company_phone?: string | null
          created_at?: string
          id?: string
          invoice_series?: string | null
          invoice_template?: string | null
          is_active?: boolean
          provider?: Database["public"]["Enums"]["einvoice_provider"]
          provider_name?: string
          sandbox_mode?: boolean
          tax_code?: string
          tenant_id?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_configs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_items: {
        Row: {
          amount: number
          created_at: string
          einvoice_id: string
          id: string
          line_number: number
          note: string | null
          product_code: string | null
          product_name: string
          quantity: number
          total_amount: number
          unit: string | null
          unit_price: number
          vat_amount: number | null
          vat_rate: number | null
        }
        Insert: {
          amount?: number
          created_at?: string
          einvoice_id: string
          id?: string
          line_number?: number
          note?: string | null
          product_code?: string | null
          product_name: string
          quantity?: number
          total_amount?: number
          unit?: string | null
          unit_price?: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Update: {
          amount?: number
          created_at?: string
          einvoice_id?: string
          id?: string
          line_number?: number
          note?: string | null
          product_code?: string | null
          product_name?: string
          quantity?: number
          total_amount?: number
          unit?: string | null
          unit_price?: number
          vat_amount?: number | null
          vat_rate?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_items_einvoice_id_fkey"
            columns: ["einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoice_logs: {
        Row: {
          action: string
          created_at: string
          einvoice_id: string | null
          error_message: string | null
          id: string
          request_data: Json | null
          response_data: Json | null
          status_code: number | null
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          einvoice_id?: string | null
          error_message?: string | null
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status_code?: number | null
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          einvoice_id?: string | null
          error_message?: string | null
          id?: string
          request_data?: Json | null
          response_data?: Json | null
          status_code?: number | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "einvoice_logs_einvoice_id_fkey"
            columns: ["einvoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoice_logs_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      einvoices: {
        Row: {
          adjustment_reason: string | null
          amount_in_words: string | null
          branch_id: string | null
          cancelled_at: string | null
          cancelled_by: string | null
          config_id: string
          created_at: string
          created_by: string | null
          customer_address: string | null
          customer_email: string | null
          customer_name: string
          customer_phone: string | null
          customer_tax_code: string | null
          error_message: string | null
          export_receipt_id: string | null
          id: string
          invoice_date: string
          invoice_number: string | null
          invoice_series: string | null
          lookup_code: string | null
          original_invoice_id: string | null
          provider_invoice_id: string | null
          provider_response: Json | null
          status: Database["public"]["Enums"]["einvoice_status"]
          subtotal: number
          tenant_id: string
          total_amount: number
          updated_at: string
          vat_amount: number
          vat_rate: number
        }
        Insert: {
          adjustment_reason?: string | null
          amount_in_words?: string | null
          branch_id?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          config_id: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name: string
          customer_phone?: string | null
          customer_tax_code?: string | null
          error_message?: string | null
          export_receipt_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          invoice_series?: string | null
          lookup_code?: string | null
          original_invoice_id?: string | null
          provider_invoice_id?: string | null
          provider_response?: Json | null
          status?: Database["public"]["Enums"]["einvoice_status"]
          subtotal?: number
          tenant_id: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Update: {
          adjustment_reason?: string | null
          amount_in_words?: string | null
          branch_id?: string | null
          cancelled_at?: string | null
          cancelled_by?: string | null
          config_id?: string
          created_at?: string
          created_by?: string | null
          customer_address?: string | null
          customer_email?: string | null
          customer_name?: string
          customer_phone?: string | null
          customer_tax_code?: string | null
          error_message?: string | null
          export_receipt_id?: string | null
          id?: string
          invoice_date?: string
          invoice_number?: string | null
          invoice_series?: string | null
          lookup_code?: string | null
          original_invoice_id?: string | null
          provider_invoice_id?: string | null
          provider_response?: Json | null
          status?: Database["public"]["Enums"]["einvoice_status"]
          subtotal?: number
          tenant_id?: string
          total_amount?: number
          updated_at?: string
          vat_amount?: number
          vat_rate?: number
        }
        Relationships: [
          {
            foreignKeyName: "einvoices_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_config_id_fkey"
            columns: ["config_id"]
            isOneToOne: false
            referencedRelation: "einvoice_configs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_export_receipt_id_fkey"
            columns: ["export_receipt_id"]
            isOneToOne: false
            referencedRelation: "export_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_original_invoice_id_fkey"
            columns: ["original_invoice_id"]
            isOneToOne: false
            referencedRelation: "einvoices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "einvoices_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      export_receipt_items: {
        Row: {
          category_id: string | null
          created_at: string
          id: string
          imei: string | null
          note: string | null
          product_id: string | null
          product_name: string
          receipt_id: string
          sale_price: number
          sku: string
          status: string
          warranty: string | null
        }
        Insert: {
          category_id?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          note?: string | null
          product_id?: string | null
          product_name: string
          receipt_id: string
          sale_price: number
          sku: string
          status?: string
          warranty?: string | null
        }
        Update: {
          category_id?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          note?: string | null
          product_id?: string | null
          product_name?: string
          receipt_id?: string
          sale_price?: number
          sku?: string
          status?: string
          warranty?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_receipt_items_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_receipt_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_receipt_items_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "export_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      export_receipt_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_type: string
          receipt_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_type: string
          receipt_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_type?: string
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_receipt_payments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "export_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      export_receipts: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          debt_amount: number
          export_date: string
          id: string
          note: string | null
          paid_amount: number
          points_discount: number | null
          points_earned: number | null
          points_redeemed: number | null
          status: string
          tenant_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          debt_amount?: number
          export_date?: string
          id?: string
          note?: string | null
          paid_amount?: number
          points_discount?: number | null
          points_earned?: number | null
          points_redeemed?: number | null
          status?: string
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          debt_amount?: number
          export_date?: string
          id?: string
          note?: string | null
          paid_amount?: number
          points_discount?: number | null
          points_earned?: number | null
          points_redeemed?: number | null
          status?: string
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_receipts_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      export_receipts_backup: {
        Row: {
          backup_date: string | null
          data: Json
          id: string
          tenant_id: string | null
        }
        Insert: {
          backup_date?: string | null
          data: Json
          id?: string
          tenant_id?: string | null
        }
        Update: {
          backup_date?: string | null
          data?: Json
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "export_receipts_backup_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      export_returns: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          export_receipt_id: string | null
          export_receipt_item_id: string | null
          fee_amount: number | null
          fee_percentage: number | null
          fee_type: Database["public"]["Enums"]["return_fee_type"]
          id: string
          imei: string | null
          import_price: number
          is_business_accounting: boolean | null
          new_import_receipt_id: string | null
          note: string | null
          original_sale_date: string | null
          product_id: string
          product_name: string
          refund_amount: number
          return_date: string
          sale_price: number
          sku: string
          store_keep_amount: number
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          export_receipt_id?: string | null
          export_receipt_item_id?: string | null
          fee_amount?: number | null
          fee_percentage?: number | null
          fee_type?: Database["public"]["Enums"]["return_fee_type"]
          id?: string
          imei?: string | null
          import_price: number
          is_business_accounting?: boolean | null
          new_import_receipt_id?: string | null
          note?: string | null
          original_sale_date?: string | null
          product_id: string
          product_name: string
          refund_amount?: number
          return_date?: string
          sale_price: number
          sku: string
          store_keep_amount?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          export_receipt_id?: string | null
          export_receipt_item_id?: string | null
          fee_amount?: number | null
          fee_percentage?: number | null
          fee_type?: Database["public"]["Enums"]["return_fee_type"]
          id?: string
          imei?: string | null
          import_price?: number
          is_business_accounting?: boolean | null
          new_import_receipt_id?: string | null
          note?: string | null
          original_sale_date?: string | null
          product_id?: string
          product_name?: string
          refund_amount?: number
          return_date?: string
          sale_price?: number
          sku?: string
          store_keep_amount?: number
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "export_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_returns_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_returns_export_receipt_id_fkey"
            columns: ["export_receipt_id"]
            isOneToOne: false
            referencedRelation: "export_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_returns_export_receipt_item_id_fkey"
            columns: ["export_receipt_item_id"]
            isOneToOne: false
            referencedRelation: "export_receipt_items"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_returns_new_import_receipt_id_fkey"
            columns: ["new_import_receipt_id"]
            isOneToOne: false
            referencedRelation: "import_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "export_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      imei_histories: {
        Row: {
          action_type: string
          created_at: string
          created_by: string | null
          customer_id: string | null
          id: string
          imei: string
          note: string | null
          price: number | null
          product_id: string
          reference_id: string | null
          reference_type: string | null
        }
        Insert: {
          action_type: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          imei: string
          note?: string | null
          price?: number | null
          product_id: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Update: {
          action_type?: string
          created_at?: string
          created_by?: string | null
          customer_id?: string | null
          id?: string
          imei?: string
          note?: string | null
          price?: number | null
          product_id?: string
          reference_id?: string | null
          reference_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imei_histories_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "imei_histories_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      import_receipts: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          debt_amount: number
          id: string
          import_date: string
          note: string | null
          paid_amount: number
          status: Database["public"]["Enums"]["receipt_status"]
          supplier_id: string | null
          tenant_id: string | null
          total_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          debt_amount?: number
          id?: string
          import_date?: string
          note?: string | null
          paid_amount?: number
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_id?: string | null
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          debt_amount?: number
          id?: string
          import_date?: string
          note?: string | null
          paid_amount?: number
          status?: Database["public"]["Enums"]["receipt_status"]
          supplier_id?: string | null
          tenant_id?: string | null
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_receipts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_receipts_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_receipts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_receipts_backup: {
        Row: {
          backup_date: string | null
          data: Json
          id: string
          tenant_id: string | null
        }
        Insert: {
          backup_date?: string | null
          data: Json
          id?: string
          tenant_id?: string | null
        }
        Update: {
          backup_date?: string | null
          data?: Json
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "import_receipts_backup_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      import_returns: {
        Row: {
          branch_id: string | null
          code: string
          created_at: string
          created_by: string | null
          id: string
          imei: string | null
          import_price: number
          import_receipt_id: string | null
          note: string | null
          original_import_date: string | null
          product_id: string
          product_name: string
          return_date: string
          sku: string
          supplier_id: string | null
          tenant_id: string | null
          total_refund_amount: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          code: string
          created_at?: string
          created_by?: string | null
          id?: string
          imei?: string | null
          import_price: number
          import_receipt_id?: string | null
          note?: string | null
          original_import_date?: string | null
          product_id: string
          product_name: string
          return_date?: string
          sku: string
          supplier_id?: string | null
          tenant_id?: string | null
          total_refund_amount?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          code?: string
          created_at?: string
          created_by?: string | null
          id?: string
          imei?: string | null
          import_price?: number
          import_receipt_id?: string | null
          note?: string | null
          original_import_date?: string | null
          product_id?: string
          product_name?: string
          return_date?: string
          sku?: string
          supplier_id?: string | null
          tenant_id?: string | null
          total_refund_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "import_returns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_returns_import_receipt_id_fkey"
            columns: ["import_receipt_id"]
            isOneToOne: false
            referencedRelation: "import_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_returns_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_returns_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "import_returns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      invoice_templates: {
        Row: {
          created_at: string
          field_order: Json | null
          font_size: string | null
          id: string
          is_default: boolean | null
          name: string
          paper_size: string
          show_customer_info: boolean | null
          show_debt: boolean | null
          show_imei: boolean | null
          show_logo: boolean | null
          show_note: boolean | null
          show_paid_amount: boolean | null
          show_product_name: boolean | null
          show_receipt_code: boolean | null
          show_sale_date: boolean | null
          show_sale_price: boolean | null
          show_sku: boolean | null
          show_store_address: boolean | null
          show_store_name: boolean | null
          show_store_phone: boolean | null
          show_thank_you: boolean | null
          show_total: boolean | null
          store_address: string | null
          store_name: string | null
          store_phone: string | null
          tenant_id: string | null
          text_align: string | null
          thank_you_text: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_order?: Json | null
          font_size?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          paper_size?: string
          show_customer_info?: boolean | null
          show_debt?: boolean | null
          show_imei?: boolean | null
          show_logo?: boolean | null
          show_note?: boolean | null
          show_paid_amount?: boolean | null
          show_product_name?: boolean | null
          show_receipt_code?: boolean | null
          show_sale_date?: boolean | null
          show_sale_price?: boolean | null
          show_sku?: boolean | null
          show_store_address?: boolean | null
          show_store_name?: boolean | null
          show_store_phone?: boolean | null
          show_thank_you?: boolean | null
          show_total?: boolean | null
          store_address?: string | null
          store_name?: string | null
          store_phone?: string | null
          tenant_id?: string | null
          text_align?: string | null
          thank_you_text?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_order?: Json | null
          font_size?: string | null
          id?: string
          is_default?: boolean | null
          name?: string
          paper_size?: string
          show_customer_info?: boolean | null
          show_debt?: boolean | null
          show_imei?: boolean | null
          show_logo?: boolean | null
          show_note?: boolean | null
          show_paid_amount?: boolean | null
          show_product_name?: boolean | null
          show_receipt_code?: boolean | null
          show_sale_date?: boolean | null
          show_sale_price?: boolean | null
          show_sku?: boolean | null
          show_store_address?: boolean | null
          show_store_name?: boolean | null
          show_store_phone?: boolean | null
          show_thank_you?: boolean | null
          show_total?: boolean | null
          store_address?: string | null
          store_name?: string | null
          store_phone?: string | null
          tenant_id?: string | null
          text_align?: string | null
          thank_you_text?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "invoice_templates_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      membership_tier_settings: {
        Row: {
          benefits: string | null
          created_at: string
          description: string | null
          id: string
          min_spent: number
          points_multiplier: number
          tenant_id: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at: string
        }
        Insert: {
          benefits?: string | null
          created_at?: string
          description?: string | null
          id?: string
          min_spent?: number
          points_multiplier?: number
          tenant_id?: string | null
          tier: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Update: {
          benefits?: string | null
          created_at?: string
          description?: string | null
          id?: string
          min_spent?: number
          points_multiplier?: number
          tenant_id?: string | null
          tier?: Database["public"]["Enums"]["membership_tier"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "membership_tier_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      minigame_campaigns: {
        Row: {
          background_image: string | null
          branch_id: string | null
          created_at: string
          created_by: string | null
          description: string | null
          end_date: string | null
          id: string
          max_spins_per_player: number | null
          name: string
          no_prize_message: string | null
          no_prize_probability: number | null
          password: string | null
          require_email: boolean | null
          require_name: boolean | null
          require_phone: boolean | null
          spin_button_color: string | null
          spin_button_text: string | null
          sponsor_logo: string | null
          sponsor_name: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["minigame_status"]
          tenant_id: string
          total_participants: number | null
          total_spins: number | null
          total_views: number | null
          updated_at: string
          wheel_background_color: string | null
          wheel_border_color: string | null
          wheel_border_image: string | null
        }
        Insert: {
          background_image?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          max_spins_per_player?: number | null
          name: string
          no_prize_message?: string | null
          no_prize_probability?: number | null
          password?: string | null
          require_email?: boolean | null
          require_name?: boolean | null
          require_phone?: boolean | null
          spin_button_color?: string | null
          spin_button_text?: string | null
          sponsor_logo?: string | null
          sponsor_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["minigame_status"]
          tenant_id: string
          total_participants?: number | null
          total_spins?: number | null
          total_views?: number | null
          updated_at?: string
          wheel_background_color?: string | null
          wheel_border_color?: string | null
          wheel_border_image?: string | null
        }
        Update: {
          background_image?: string | null
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          end_date?: string | null
          id?: string
          max_spins_per_player?: number | null
          name?: string
          no_prize_message?: string | null
          no_prize_probability?: number | null
          password?: string | null
          require_email?: boolean | null
          require_name?: boolean | null
          require_phone?: boolean | null
          spin_button_color?: string | null
          spin_button_text?: string | null
          sponsor_logo?: string | null
          sponsor_name?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["minigame_status"]
          tenant_id?: string
          total_participants?: number | null
          total_spins?: number | null
          total_views?: number | null
          updated_at?: string
          wheel_background_color?: string | null
          wheel_border_color?: string | null
          wheel_border_image?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "minigame_campaigns_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minigame_campaigns_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      minigame_participants: {
        Row: {
          campaign_id: string
          email: string | null
          first_played_at: string
          id: string
          ip_address: string | null
          last_played_at: string | null
          name: string
          phone: string
          total_spins: number | null
          total_wins: number | null
          user_agent: string | null
        }
        Insert: {
          campaign_id: string
          email?: string | null
          first_played_at?: string
          id?: string
          ip_address?: string | null
          last_played_at?: string | null
          name: string
          phone: string
          total_spins?: number | null
          total_wins?: number | null
          user_agent?: string | null
        }
        Update: {
          campaign_id?: string
          email?: string | null
          first_played_at?: string
          id?: string
          ip_address?: string | null
          last_played_at?: string | null
          name?: string
          phone?: string
          total_spins?: number | null
          total_wins?: number | null
          user_agent?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "minigame_participants_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "minigame_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      minigame_prizes: {
        Row: {
          campaign_id: string
          color: string | null
          created_at: string
          description: string | null
          display_order: number | null
          id: string
          image: string | null
          is_active: boolean | null
          max_per_player: number | null
          name: string
          prize_type: string | null
          prize_value: string | null
          probability: number | null
          remaining_quantity: number | null
          total_quantity: number | null
        }
        Insert: {
          campaign_id: string
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image?: string | null
          is_active?: boolean | null
          max_per_player?: number | null
          name: string
          prize_type?: string | null
          prize_value?: string | null
          probability?: number | null
          remaining_quantity?: number | null
          total_quantity?: number | null
        }
        Update: {
          campaign_id?: string
          color?: string | null
          created_at?: string
          description?: string | null
          display_order?: number | null
          id?: string
          image?: string | null
          is_active?: boolean | null
          max_per_player?: number | null
          name?: string
          prize_type?: string | null
          prize_value?: string | null
          probability?: number | null
          remaining_quantity?: number | null
          total_quantity?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "minigame_prizes_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "minigame_campaigns"
            referencedColumns: ["id"]
          },
        ]
      }
      minigame_spins: {
        Row: {
          campaign_id: string
          id: string
          ip_address: string | null
          participant_id: string
          prize_id: string | null
          prize_name: string | null
          prize_value: string | null
          result_type: Database["public"]["Enums"]["spin_result_type"]
          spun_at: string
        }
        Insert: {
          campaign_id: string
          id?: string
          ip_address?: string | null
          participant_id: string
          prize_id?: string | null
          prize_name?: string | null
          prize_value?: string | null
          result_type: Database["public"]["Enums"]["spin_result_type"]
          spun_at?: string
        }
        Update: {
          campaign_id?: string
          id?: string
          ip_address?: string | null
          participant_id?: string
          prize_id?: string | null
          prize_name?: string | null
          prize_value?: string | null
          result_type?: Database["public"]["Enums"]["spin_result_type"]
          spun_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "minigame_spins_campaign_id_fkey"
            columns: ["campaign_id"]
            isOneToOne: false
            referencedRelation: "minigame_campaigns"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minigame_spins_participant_id_fkey"
            columns: ["participant_id"]
            isOneToOne: false
            referencedRelation: "minigame_participants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "minigame_spins_prize_id_fkey"
            columns: ["prize_id"]
            isOneToOne: false
            referencedRelation: "minigame_prizes"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_config: {
        Row: {
          config_key: string
          config_value: string | null
          created_at: string
          id: string
          updated_at: string
        }
        Insert: {
          config_key: string
          config_value?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Update: {
          config_key?: string
          config_value?: string | null
          created_at?: string
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      payment_requests: {
        Row: {
          amount: number
          approved_at: string | null
          approved_by: string | null
          created_at: string
          id: string
          note: string | null
          payment_code: string
          payment_method: string
          payment_proof_url: string | null
          plan_id: string
          rejected_reason: string | null
          requested_at: string
          status: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at: string
        }
        Insert: {
          amount: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          payment_code: string
          payment_method?: string
          payment_proof_url?: string | null
          plan_id: string
          rejected_reason?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id: string
          updated_at?: string
        }
        Update: {
          amount?: number
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          id?: string
          note?: string | null
          payment_code?: string
          payment_method?: string
          payment_proof_url?: string | null
          plan_id?: string
          rejected_reason?: string | null
          requested_at?: string
          status?: Database["public"]["Enums"]["payment_status"]
          tenant_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_requests_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_requests_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_users: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          id: string
          is_active: boolean
          phone: string | null
          platform_role: Database["public"]["Enums"]["platform_role"]
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          id?: string
          is_active?: boolean
          phone?: string | null
          platform_role?: Database["public"]["Enums"]["platform_role"]
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "platform_users_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      point_settings: {
        Row: {
          earn_points: number
          id: string
          is_enabled: boolean
          max_redeem_amount: number | null
          max_redeem_percentage: number
          points_expire: boolean
          points_expire_days: number | null
          redeem_points: number
          redeem_value: number
          require_full_payment: boolean
          spend_amount: number
          tenant_id: string | null
          updated_at: string
          updated_by: string | null
          use_max_amount_limit: boolean | null
          use_percentage_limit: boolean | null
        }
        Insert: {
          earn_points?: number
          id?: string
          is_enabled?: boolean
          max_redeem_amount?: number | null
          max_redeem_percentage?: number
          points_expire?: boolean
          points_expire_days?: number | null
          redeem_points?: number
          redeem_value?: number
          require_full_payment?: boolean
          spend_amount?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          use_max_amount_limit?: boolean | null
          use_percentage_limit?: boolean | null
        }
        Update: {
          earn_points?: number
          id?: string
          is_enabled?: boolean
          max_redeem_amount?: number | null
          max_redeem_percentage?: number
          points_expire?: boolean
          points_expire_days?: number | null
          redeem_points?: number
          redeem_value?: number
          require_full_payment?: boolean
          spend_amount?: number
          tenant_id?: string | null
          updated_at?: string
          updated_by?: string | null
          use_max_amount_limit?: boolean | null
          use_percentage_limit?: boolean | null
        }
        Relationships: [
          {
            foreignKeyName: "point_settings_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      point_transactions: {
        Row: {
          balance_after: number
          branch_id: string | null
          created_at: string
          created_by: string | null
          customer_id: string
          description: string
          id: string
          note: string | null
          points: number
          reference_id: string | null
          reference_type: string | null
          status: Database["public"]["Enums"]["point_status"]
          transaction_type: Database["public"]["Enums"]["point_transaction_type"]
        }
        Insert: {
          balance_after?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id: string
          description: string
          id?: string
          note?: string | null
          points: number
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["point_status"]
          transaction_type: Database["public"]["Enums"]["point_transaction_type"]
        }
        Update: {
          balance_after?: number
          branch_id?: string | null
          created_at?: string
          created_by?: string | null
          customer_id?: string
          description?: string
          id?: string
          note?: string | null
          points?: number
          reference_id?: string | null
          reference_type?: string | null
          status?: Database["public"]["Enums"]["point_status"]
          transaction_type?: Database["public"]["Enums"]["point_transaction_type"]
        }
        Relationships: [
          {
            foreignKeyName: "point_transactions_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "point_transactions_customer_id_fkey"
            columns: ["customer_id"]
            isOneToOne: false
            referencedRelation: "customers"
            referencedColumns: ["id"]
          },
        ]
      }
      product_imports: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          import_date: string
          import_price: number
          import_receipt_id: string | null
          note: string | null
          product_id: string
          quantity: number
          supplier_id: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          import_date?: string
          import_price: number
          import_receipt_id?: string | null
          note?: string | null
          product_id: string
          quantity?: number
          supplier_id?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          import_date?: string
          import_price?: number
          import_receipt_id?: string | null
          note?: string | null
          product_id?: string
          quantity?: number
          supplier_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "product_imports_import_receipt_id_fkey"
            columns: ["import_receipt_id"]
            isOneToOne: false
            referencedRelation: "import_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_imports_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "product_imports_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          branch_id: string | null
          category_id: string | null
          created_at: string
          id: string
          imei: string | null
          import_date: string
          import_price: number
          import_receipt_id: string | null
          name: string
          note: string | null
          quantity: number
          sku: string
          status: Database["public"]["Enums"]["product_status"]
          supplier_id: string | null
          tenant_id: string | null
          total_import_cost: number
          updated_at: string
        }
        Insert: {
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          import_date?: string
          import_price: number
          import_receipt_id?: string | null
          name: string
          note?: string | null
          quantity?: number
          sku: string
          status?: Database["public"]["Enums"]["product_status"]
          supplier_id?: string | null
          tenant_id?: string | null
          total_import_cost?: number
          updated_at?: string
        }
        Update: {
          branch_id?: string | null
          category_id?: string | null
          created_at?: string
          id?: string
          imei?: string | null
          import_date?: string
          import_price?: number
          import_receipt_id?: string | null
          name?: string
          note?: string | null
          quantity?: number
          sku?: string
          status?: Database["public"]["Enums"]["product_status"]
          supplier_id?: string | null
          tenant_id?: string | null
          total_import_cost?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "products_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_category_id_fkey"
            columns: ["category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_import_receipt_id_fkey"
            columns: ["import_receipt_id"]
            isOneToOne: false
            referencedRelation: "import_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_supplier_id_fkey"
            columns: ["supplier_id"]
            isOneToOne: false
            referencedRelation: "suppliers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "products_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      products_backup: {
        Row: {
          backup_date: string | null
          data: Json
          id: string
          tenant_id: string | null
        }
        Insert: {
          backup_date?: string | null
          data: Json
          id?: string
          tenant_id?: string | null
        }
        Update: {
          backup_date?: string | null
          data?: Json
          id?: string
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "products_backup_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          display_name: string
          id: string
          phone: string | null
          tenant_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          display_name: string
          id?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          display_name?: string
          id?: string
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      receipt_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          receipt_id: string
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_type: Database["public"]["Enums"]["payment_type"]
          receipt_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_type?: Database["public"]["Enums"]["payment_type"]
          receipt_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "receipt_payments_receipt_id_fkey"
            columns: ["receipt_id"]
            isOneToOne: false
            referencedRelation: "import_receipts"
            referencedColumns: ["id"]
          },
        ]
      }
      return_payments: {
        Row: {
          amount: number
          created_at: string
          id: string
          payment_source: string
          return_id: string
          return_type: Database["public"]["Enums"]["return_type"]
          tenant_id: string | null
        }
        Insert: {
          amount: number
          created_at?: string
          id?: string
          payment_source: string
          return_id: string
          return_type: Database["public"]["Enums"]["return_type"]
          tenant_id?: string | null
        }
        Update: {
          amount?: number
          created_at?: string
          id?: string
          payment_source?: string
          return_id?: string
          return_type?: Database["public"]["Enums"]["return_type"]
          tenant_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "return_payments_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_count_items: {
        Row: {
          actual_quantity: number
          created_at: string
          has_imei: boolean
          id: string
          imei: string | null
          import_price: number
          is_checked: boolean
          note: string | null
          product_id: string | null
          product_name: string
          sku: string
          status: Database["public"]["Enums"]["stock_count_item_status"]
          stock_count_id: string
          system_quantity: number
          updated_at: string
          variance: number
        }
        Insert: {
          actual_quantity?: number
          created_at?: string
          has_imei?: boolean
          id?: string
          imei?: string | null
          import_price?: number
          is_checked?: boolean
          note?: string | null
          product_id?: string | null
          product_name: string
          sku: string
          status?: Database["public"]["Enums"]["stock_count_item_status"]
          stock_count_id: string
          system_quantity?: number
          updated_at?: string
          variance?: number
        }
        Update: {
          actual_quantity?: number
          created_at?: string
          has_imei?: boolean
          id?: string
          imei?: string | null
          import_price?: number
          is_checked?: boolean
          note?: string | null
          product_id?: string | null
          product_name?: string
          sku?: string
          status?: Database["public"]["Enums"]["stock_count_item_status"]
          stock_count_id?: string
          system_quantity?: number
          updated_at?: string
          variance?: number
        }
        Relationships: [
          {
            foreignKeyName: "stock_count_items_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_count_items_stock_count_id_fkey"
            columns: ["stock_count_id"]
            isOneToOne: false
            referencedRelation: "stock_counts"
            referencedColumns: ["id"]
          },
        ]
      }
      stock_counts: {
        Row: {
          adjustment_export_receipt_id: string | null
          adjustment_import_receipt_id: string | null
          branch_id: string | null
          code: string
          confirmed_at: string | null
          confirmed_by: string | null
          count_date: string
          created_at: string
          created_by: string
          id: string
          note: string | null
          scope: Database["public"]["Enums"]["stock_count_scope"]
          scope_category_id: string | null
          status: Database["public"]["Enums"]["stock_count_status"]
          tenant_id: string | null
          total_actual_quantity: number
          total_system_quantity: number
          total_variance: number
          updated_at: string
        }
        Insert: {
          adjustment_export_receipt_id?: string | null
          adjustment_import_receipt_id?: string | null
          branch_id?: string | null
          code: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          count_date?: string
          created_at?: string
          created_by: string
          id?: string
          note?: string | null
          scope?: Database["public"]["Enums"]["stock_count_scope"]
          scope_category_id?: string | null
          status?: Database["public"]["Enums"]["stock_count_status"]
          tenant_id?: string | null
          total_actual_quantity?: number
          total_system_quantity?: number
          total_variance?: number
          updated_at?: string
        }
        Update: {
          adjustment_export_receipt_id?: string | null
          adjustment_import_receipt_id?: string | null
          branch_id?: string | null
          code?: string
          confirmed_at?: string | null
          confirmed_by?: string | null
          count_date?: string
          created_at?: string
          created_by?: string
          id?: string
          note?: string | null
          scope?: Database["public"]["Enums"]["stock_count_scope"]
          scope_category_id?: string | null
          status?: Database["public"]["Enums"]["stock_count_status"]
          tenant_id?: string | null
          total_actual_quantity?: number
          total_system_quantity?: number
          total_variance?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stock_counts_adjustment_export_receipt_id_fkey"
            columns: ["adjustment_export_receipt_id"]
            isOneToOne: false
            referencedRelation: "export_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_adjustment_import_receipt_id_fkey"
            columns: ["adjustment_import_receipt_id"]
            isOneToOne: false
            referencedRelation: "import_receipts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_scope_category_id_fkey"
            columns: ["scope_category_id"]
            isOneToOne: false
            referencedRelation: "categories"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "stock_counts_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_history: {
        Row: {
          action: string
          created_at: string
          days_added: number | null
          id: string
          new_end_date: string | null
          new_status: Database["public"]["Enums"]["tenant_status"] | null
          note: string | null
          old_end_date: string | null
          old_status: Database["public"]["Enums"]["tenant_status"] | null
          payment_request_id: string | null
          performed_by: string | null
          plan_id: string | null
          tenant_id: string
        }
        Insert: {
          action: string
          created_at?: string
          days_added?: number | null
          id?: string
          new_end_date?: string | null
          new_status?: Database["public"]["Enums"]["tenant_status"] | null
          note?: string | null
          old_end_date?: string | null
          old_status?: Database["public"]["Enums"]["tenant_status"] | null
          payment_request_id?: string | null
          performed_by?: string | null
          plan_id?: string | null
          tenant_id: string
        }
        Update: {
          action?: string
          created_at?: string
          days_added?: number | null
          id?: string
          new_end_date?: string | null
          new_status?: Database["public"]["Enums"]["tenant_status"] | null
          note?: string | null
          old_end_date?: string | null
          old_status?: Database["public"]["Enums"]["tenant_status"] | null
          payment_request_id?: string | null
          performed_by?: string | null
          plan_id?: string | null
          tenant_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscription_history_payment_request_id_fkey"
            columns: ["payment_request_id"]
            isOneToOne: false
            referencedRelation: "payment_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscription_history_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          description: string | null
          discount_amount: number | null
          discount_percentage: number | null
          display_order: number | null
          duration_days: number | null
          id: string
          is_active: boolean
          max_branches: number | null
          max_users: number | null
          name: string
          plan_type: Database["public"]["Enums"]["subscription_plan"]
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          display_order?: number | null
          duration_days?: number | null
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_users?: number | null
          name: string
          plan_type: Database["public"]["Enums"]["subscription_plan"]
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          discount_amount?: number | null
          discount_percentage?: number | null
          display_order?: number | null
          duration_days?: number | null
          id?: string
          is_active?: boolean
          max_branches?: number | null
          max_users?: number | null
          name?: string
          plan_type?: Database["public"]["Enums"]["subscription_plan"]
          price?: number
          updated_at?: string
        }
        Relationships: []
      }
      suppliers: {
        Row: {
          address: string | null
          created_at: string
          id: string
          name: string
          note: string | null
          phone: string | null
          tenant_id: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          created_at?: string
          id?: string
          name: string
          note?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          phone?: string | null
          tenant_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "suppliers_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
      tenants: {
        Row: {
          address: string | null
          allow_custom_domain: boolean | null
          created_at: string
          einvoice_enabled: boolean
          email: string | null
          has_data_backup: boolean | null
          id: string
          is_data_hidden: boolean | null
          locked_at: string | null
          locked_reason: string | null
          max_branches: number | null
          max_users: number | null
          name: string
          note: string | null
          owner_id: string
          phone: string | null
          primary_domain: string | null
          status: Database["public"]["Enums"]["tenant_status"]
          subdomain: string
          subscription_end_date: string | null
          subscription_plan:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date: string | null
          trial_end_date: string
          trial_start_date: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          allow_custom_domain?: boolean | null
          created_at?: string
          einvoice_enabled?: boolean
          email?: string | null
          has_data_backup?: boolean | null
          id?: string
          is_data_hidden?: boolean | null
          locked_at?: string | null
          locked_reason?: string | null
          max_branches?: number | null
          max_users?: number | null
          name: string
          note?: string | null
          owner_id: string
          phone?: string | null
          primary_domain?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          subdomain: string
          subscription_end_date?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date?: string | null
          trial_end_date?: string
          trial_start_date?: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          allow_custom_domain?: boolean | null
          created_at?: string
          einvoice_enabled?: boolean
          email?: string | null
          has_data_backup?: boolean | null
          id?: string
          is_data_hidden?: boolean | null
          locked_at?: string | null
          locked_reason?: string | null
          max_branches?: number | null
          max_users?: number | null
          name?: string
          note?: string | null
          owner_id?: string
          phone?: string | null
          primary_domain?: string | null
          status?: Database["public"]["Enums"]["tenant_status"]
          subdomain?: string
          subscription_end_date?: string | null
          subscription_plan?:
            | Database["public"]["Enums"]["subscription_plan"]
            | null
          subscription_start_date?: string | null
          trial_end_date?: string
          trial_start_date?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          branch_id: string | null
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          tenant_id: string | null
          user_id: string
          user_role: Database["public"]["Enums"]["user_role"] | null
        }
        Insert: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id: string
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Update: {
          branch_id?: string | null
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          tenant_id?: string | null
          user_id?: string
          user_role?: Database["public"]["Enums"]["user_role"] | null
        }
        Relationships: [
          {
            foreignKeyName: "user_roles_branch_id_fkey"
            columns: ["branch_id"]
            isOneToOne: false
            referencedRelation: "branches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_roles_tenant_id_fkey"
            columns: ["tenant_id"]
            isOneToOne: false
            referencedRelation: "tenants"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      belongs_to_tenant: {
        Args: { _tenant_id: string; _user_id: string }
        Returns: boolean
      }
      can_access_branch: {
        Args: { _branch_id: string; _user_id: string }
        Returns: boolean
      }
      can_become_affiliate: { Args: { _tenant_id: string }; Returns: boolean }
      generate_affiliate_code: { Args: never; Returns: string }
      generate_domain_verification_token: { Args: never; Returns: string }
      get_current_tenant: { Args: never; Returns: string }
      get_user_branch: { Args: { _user_id: string }; Returns: string }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["user_role"]
      }
      get_user_tenant_id: { Args: { _user_id: string }; Returns: string }
      get_user_tenant_id_secure: { Args: never; Returns: string }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_authenticated: { Args: never; Returns: boolean }
      is_platform_admin: { Args: { _user_id: string }; Returns: boolean }
      is_tenant_accessible: { Args: { _tenant_id: string }; Returns: boolean }
      resolve_tenant_by_domain: { Args: { _domain: string }; Returns: string }
      user_belongs_to_tenant: { Args: { _tenant_id: string }; Returns: boolean }
    }
    Enums: {
      affiliate_status: "pending" | "active" | "blocked"
      app_role: "admin" | "staff"
      cash_book_type: "expense" | "income"
      commission_status: "pending" | "approved" | "paid" | "cancelled"
      commission_type: "percentage" | "fixed"
      customer_status: "active" | "inactive"
      einvoice_provider: "vnpt" | "viettel" | "fpt" | "misa" | "other"
      einvoice_status:
        | "draft"
        | "pending"
        | "issued"
        | "cancelled"
        | "adjusted"
        | "error"
      membership_tier: "regular" | "silver" | "gold" | "vip"
      minigame_status: "draft" | "active" | "paused" | "expired"
      payment_status: "pending" | "approved" | "rejected" | "cancelled"
      payment_type: "cash" | "bank_card" | "e_wallet" | "debt"
      platform_role: "platform_admin" | "tenant_admin"
      point_status: "active" | "pending" | "expired"
      point_transaction_type: "earn" | "redeem" | "refund" | "adjust" | "expire"
      product_status: "in_stock" | "sold" | "returned"
      receipt_status: "completed" | "cancelled"
      return_fee_type: "none" | "percentage" | "fixed_amount"
      return_type: "import_return" | "export_return"
      spin_result_type: "prize" | "no_prize"
      stock_count_item_status: "ok" | "missing" | "surplus" | "pending"
      stock_count_scope: "all" | "category" | "product"
      stock_count_status: "draft" | "confirmed"
      subscription_plan: "monthly" | "yearly" | "lifetime"
      tenant_status: "trial" | "active" | "expired" | "locked"
      user_role: "super_admin" | "branch_admin" | "staff" | "cashier"
      withdrawal_status: "pending" | "approved" | "paid" | "rejected"
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
      affiliate_status: ["pending", "active", "blocked"],
      app_role: ["admin", "staff"],
      cash_book_type: ["expense", "income"],
      commission_status: ["pending", "approved", "paid", "cancelled"],
      commission_type: ["percentage", "fixed"],
      customer_status: ["active", "inactive"],
      einvoice_provider: ["vnpt", "viettel", "fpt", "misa", "other"],
      einvoice_status: [
        "draft",
        "pending",
        "issued",
        "cancelled",
        "adjusted",
        "error",
      ],
      membership_tier: ["regular", "silver", "gold", "vip"],
      minigame_status: ["draft", "active", "paused", "expired"],
      payment_status: ["pending", "approved", "rejected", "cancelled"],
      payment_type: ["cash", "bank_card", "e_wallet", "debt"],
      platform_role: ["platform_admin", "tenant_admin"],
      point_status: ["active", "pending", "expired"],
      point_transaction_type: ["earn", "redeem", "refund", "adjust", "expire"],
      product_status: ["in_stock", "sold", "returned"],
      receipt_status: ["completed", "cancelled"],
      return_fee_type: ["none", "percentage", "fixed_amount"],
      return_type: ["import_return", "export_return"],
      spin_result_type: ["prize", "no_prize"],
      stock_count_item_status: ["ok", "missing", "surplus", "pending"],
      stock_count_scope: ["all", "category", "product"],
      stock_count_status: ["draft", "confirmed"],
      subscription_plan: ["monthly", "yearly", "lifetime"],
      tenant_status: ["trial", "active", "expired", "locked"],
      user_role: ["super_admin", "branch_admin", "staff", "cashier"],
      withdrawal_status: ["pending", "approved", "paid", "rejected"],
    },
  },
} as const
