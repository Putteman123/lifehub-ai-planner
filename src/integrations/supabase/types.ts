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
      account_transfers: {
        Row: {
          amount: number
          created_at: string
          from_account_id: string | null
          id: string
          note: string | null
          to_account_id: string | null
          transferred_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          from_account_id?: string | null
          id?: string
          note?: string | null
          to_account_id?: string | null
          transferred_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          from_account_id?: string | null
          id?: string
          note?: string | null
          to_account_id?: string | null
          transferred_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "account_transfers_from_account_id_fkey"
            columns: ["from_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "account_transfers_to_account_id_fkey"
            columns: ["to_account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      andrea_memories: {
        Row: {
          confidence: number
          content: string
          created_at: string
          id: string
          kind: string
          last_confirmed_at: string
          source: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          confidence?: number
          content: string
          created_at?: string
          id?: string
          kind?: string
          last_confirmed_at?: string
          source?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          confidence?: number
          content?: string
          created_at?: string
          id?: string
          kind?: string
          last_confirmed_at?: string
          source?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      andrea_profile: {
        Row: {
          call_name: string | null
          created_at: string
          directness: number
          focus: string | null
          id: string
          notes: string | null
          tone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          call_name?: string | null
          created_at?: string
          directness?: number
          focus?: string | null
          id?: string
          notes?: string | null
          tone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          call_name?: string | null
          created_at?: string
          directness?: number
          focus?: string | null
          id?: string
          notes?: string | null
          tone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      app_challenges: {
        Row: {
          challenge: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
        }
        Insert: {
          challenge: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose: string
        }
        Update: {
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
        }
        Relationships: []
      }
      app_owner: {
        Row: {
          claimed_at: string
          id: boolean
          user_id: string
        }
        Insert: {
          claimed_at?: string
          id?: boolean
          user_id: string
        }
        Update: {
          claimed_at?: string
          id?: boolean
          user_id?: string
        }
        Relationships: []
      }
      app_passkeys: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          id: string
          label: string | null
          public_key: string
          rp_id: string | null
          updated_at: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          id?: string
          label?: string | null
          public_key: string
          rp_id?: string | null
          updated_at?: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          id?: string
          label?: string | null
          public_key?: string
          rp_id?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      bets: {
        Row: {
          account_id: string | null
          bet_date: string
          created_at: string
          game_type: string
          id: string
          note: string | null
          payout: number
          raw_ai: Json | null
          receipt_path: string | null
          rows_count: number
          spend_id: string | null
          stake: number
          status: string
          track: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          bet_date?: string
          created_at?: string
          game_type?: string
          id?: string
          note?: string | null
          payout?: number
          raw_ai?: Json | null
          receipt_path?: string | null
          rows_count?: number
          spend_id?: string | null
          stake?: number
          status?: string
          track?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          bet_date?: string
          created_at?: string
          game_type?: string
          id?: string
          note?: string | null
          payout?: number
          raw_ai?: Json | null
          receipt_path?: string | null
          rows_count?: number
          spend_id?: string | null
          stake?: number
          status?: string
          track?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bets_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "bets_spend_id_fkey"
            columns: ["spend_id"]
            isOneToOne: false
            referencedRelation: "spend_entries"
            referencedColumns: ["id"]
          },
        ]
      }
      calendars: {
        Row: {
          color: string
          created_at: string
          external_id: string | null
          ics_url: string | null
          id: string
          is_active: boolean
          last_synced_at: string | null
          name: string
          source: Database["public"]["Enums"]["calendar_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          color?: string
          created_at?: string
          external_id?: string | null
          ics_url?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name: string
          source?: Database["public"]["Enums"]["calendar_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          color?: string
          created_at?: string
          external_id?: string | null
          ics_url?: string | null
          id?: string
          is_active?: boolean
          last_synced_at?: string | null
          name?: string
          source?: Database["public"]["Enums"]["calendar_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      case_tasks: {
        Row: {
          case_id: string | null
          created_at: string
          due_date: string | null
          id: string
          is_done: boolean
          notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          case_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          case_id?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "case_tasks_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
        ]
      }
      children: {
        Row: {
          birth_date: string | null
          color: string
          created_at: string
          id: string
          name: string
          updated_at: string
          user_id: string
        }
        Insert: {
          birth_date?: string | null
          color?: string
          created_at?: string
          id?: string
          name: string
          updated_at?: string
          user_id: string
        }
        Update: {
          birth_date?: string | null
          color?: string
          created_at?: string
          id?: string
          name?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      day_segments: {
        Row: {
          address: string | null
          confidence: number
          created_at: string
          day: string
          distance_m: number
          end_lat: number | null
          end_lng: number | null
          ends_at: string
          entry_kind: Database["public"]["Enums"]["visit_kind"]
          id: string
          lat: number | null
          lng: number | null
          place_id: string | null
          reasoning: string | null
          seen_count: number
          spend_total: number
          starts_at: string
          status: string
          suggested_activity: string | null
          suggested_label: string | null
          travel_mode: Database["public"]["Enums"]["travel_mode"]
          updated_at: string
          user_id: string
          visit_id: string | null
        }
        Insert: {
          address?: string | null
          confidence?: number
          created_at?: string
          day: string
          distance_m?: number
          end_lat?: number | null
          end_lng?: number | null
          ends_at: string
          entry_kind?: Database["public"]["Enums"]["visit_kind"]
          id?: string
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          reasoning?: string | null
          seen_count?: number
          spend_total?: number
          starts_at: string
          status?: string
          suggested_activity?: string | null
          suggested_label?: string | null
          travel_mode?: Database["public"]["Enums"]["travel_mode"]
          updated_at?: string
          user_id: string
          visit_id?: string | null
        }
        Update: {
          address?: string | null
          confidence?: number
          created_at?: string
          day?: string
          distance_m?: number
          end_lat?: number | null
          end_lng?: number | null
          ends_at?: string
          entry_kind?: Database["public"]["Enums"]["visit_kind"]
          id?: string
          lat?: number | null
          lng?: number | null
          place_id?: string | null
          reasoning?: string | null
          seen_count?: number
          spend_total?: number
          starts_at?: string
          status?: string
          suggested_activity?: string | null
          suggested_label?: string | null
          travel_mode?: Database["public"]["Enums"]["travel_mode"]
          updated_at?: string
          user_id?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "day_segments_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "day_segments_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      event_categories: {
        Row: {
          color_token: string
          created_at: string
          id: string
          label: string
          sort_order: number
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          color_token?: string
          created_at?: string
          id?: string
          label: string
          sort_order?: number
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          color_token?: string
          created_at?: string
          id?: string
          label?: string
          sort_order?: number
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      events: {
        Row: {
          all_day: boolean
          calendar_id: string | null
          case_id: string | null
          category: string
          child_id: string | null
          created_at: string
          description: string | null
          ends_at: string
          external_id: string | null
          id: string
          location: string | null
          starts_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          all_day?: boolean
          calendar_id?: string | null
          case_id?: string | null
          category?: string
          child_id?: string | null
          created_at?: string
          description?: string | null
          ends_at: string
          external_id?: string | null
          id?: string
          location?: string | null
          starts_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          all_day?: boolean
          calendar_id?: string | null
          case_id?: string | null
          category?: string
          child_id?: string | null
          created_at?: string
          description?: string | null
          ends_at?: string
          external_id?: string | null
          id?: string
          location?: string | null
          starts_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "events_calendar_id_fkey"
            columns: ["calendar_id"]
            isOneToOne: false
            referencedRelation: "calendars"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_case_id_fkey"
            columns: ["case_id"]
            isOneToOne: false
            referencedRelation: "legal_cases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "events_child_id_fkey"
            columns: ["child_id"]
            isOneToOne: false
            referencedRelation: "children"
            referencedColumns: ["id"]
          },
        ]
      }
      finance_accounts: {
        Row: {
          balance: number
          created_at: string
          id: string
          name: string
          note: string | null
          sort_order: number
          updated_at: string
          user_id: string
        }
        Insert: {
          balance?: number
          created_at?: string
          id?: string
          name: string
          note?: string | null
          sort_order?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          balance?: number
          created_at?: string
          id?: string
          name?: string
          note?: string | null
          sort_order?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_files: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string
          id: string
          kind: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string
          id?: string
          kind?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      finance_incomes: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          expected_on: string
          id: string
          is_received: boolean
          kind: string
          label: string
          loan_id: string | null
          note: string | null
          received_on: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          expected_on: string
          id?: string
          is_received?: boolean
          kind?: string
          label: string
          loan_id?: string | null
          note?: string | null
          received_on?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          expected_on?: string
          id?: string
          is_received?: boolean
          kind?: string
          label?: string
          loan_id?: string | null
          note?: string | null
          received_on?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "finance_incomes_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "finance_incomes_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expense_payments: {
        Row: {
          amount: number
          created_at: string
          expense_id: string
          file_id: string | null
          id: string
          paid_on: string
          period: string
          source: string
          todo_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          expense_id: string
          file_id?: string | null
          id?: string
          paid_on?: string
          period: string
          source?: string
          todo_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          expense_id?: string
          file_id?: string | null
          id?: string
          paid_on?: string
          period?: string
          source?: string
          todo_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expense_payments_expense_id_fkey"
            columns: ["expense_id"]
            isOneToOne: false
            referencedRelation: "fixed_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expense_payments_file_id_fkey"
            columns: ["file_id"]
            isOneToOne: false
            referencedRelation: "finance_files"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "fixed_expense_payments_todo_id_fkey"
            columns: ["todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      fixed_expenses: {
        Row: {
          amount: number
          anchor_month: number | null
          category: string | null
          created_at: string
          due_day: number
          id: string
          interval_months: number
          is_active: boolean
          is_subscription: boolean
          loan_id: string | null
          name: string
          part: string | null
          sync_calendar: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          amount?: number
          anchor_month?: number | null
          category?: string | null
          created_at?: string
          due_day?: number
          id?: string
          interval_months?: number
          is_active?: boolean
          is_subscription?: boolean
          loan_id?: string | null
          name: string
          part?: string | null
          sync_calendar?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          anchor_month?: number | null
          category?: string | null
          created_at?: string
          due_day?: number
          id?: string
          interval_months?: number
          is_active?: boolean
          is_subscription?: boolean
          loan_id?: string | null
          name?: string
          part?: string | null
          sync_calendar?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "fixed_expenses_loan_id_fkey"
            columns: ["loan_id"]
            isOneToOne: false
            referencedRelation: "loans"
            referencedColumns: ["id"]
          },
        ]
      }
      iptv_lines: {
        Row: {
          created_at: string
          customer_name: string
          device_type: string
          expires_at: string | null
          id: string
          last_response: Json | null
          last_synced_at: string | null
          m3u_url: string | null
          mac: string | null
          months: number
          note: string | null
          online: boolean
          package_id: string | null
          package_name: string | null
          panel_id: string | null
          password: string | null
          protocol_code: string | null
          status: string
          updated_at: string
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          customer_name: string
          device_type?: string
          expires_at?: string | null
          id?: string
          last_response?: Json | null
          last_synced_at?: string | null
          m3u_url?: string | null
          mac?: string | null
          months?: number
          note?: string | null
          online?: boolean
          package_id?: string | null
          package_name?: string | null
          panel_id?: string | null
          password?: string | null
          protocol_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          customer_name?: string
          device_type?: string
          expires_at?: string | null
          id?: string
          last_response?: Json | null
          last_synced_at?: string | null
          m3u_url?: string | null
          mac?: string | null
          months?: number
          note?: string | null
          online?: boolean
          package_id?: string | null
          package_name?: string | null
          panel_id?: string | null
          password?: string | null
          protocol_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      legal_cases: {
        Row: {
          client_name: string | null
          created_at: string
          description: string | null
          id: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          client_name?: string | null
          created_at?: string
          description?: string | null
          id?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      loans: {
        Row: {
          account_id: string | null
          created_at: string
          disbursed_on: string
          due_day: number
          id: string
          is_active: boolean
          monthly_interest: number
          monthly_payment: number
          name: string
          note: string | null
          principal: number
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          created_at?: string
          disbursed_on?: string
          due_day?: number
          id?: string
          is_active?: boolean
          monthly_interest?: number
          monthly_payment?: number
          name: string
          note?: string | null
          principal?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          created_at?: string
          disbursed_on?: string
          due_day?: number
          id?: string
          is_active?: boolean
          monthly_interest?: number
          monthly_payment?: number
          name?: string
          note?: string | null
          principal?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "loans_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      location_pings: {
        Row: {
          accuracy_m: number | null
          created_at: string
          id: string
          lat: number
          lng: number
          recorded_at: string
          source: string
          user_id: string
        }
        Insert: {
          accuracy_m?: number | null
          created_at?: string
          id?: string
          lat: number
          lng: number
          recorded_at?: string
          source?: string
          user_id: string
        }
        Update: {
          accuracy_m?: number | null
          created_at?: string
          id?: string
          lat?: number
          lng?: number
          recorded_at?: string
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      mail_findings: {
        Row: {
          account_id: string | null
          amount: number | null
          category: string | null
          created_at: string
          created_expense_id: string | null
          created_spend_id: string | null
          created_todo_id: string | null
          currency: string
          due_date: string | null
          id: string
          kind: string
          merchant: string | null
          message_id: string
          occurred_at: string | null
          raw_ai: Json | null
          reference: string | null
          sender: string | null
          status: string
          subject: string | null
          summary: string | null
          thread_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          category?: string | null
          created_at?: string
          created_expense_id?: string | null
          created_spend_id?: string | null
          created_todo_id?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          kind?: string
          merchant?: string | null
          message_id: string
          occurred_at?: string | null
          raw_ai?: Json | null
          reference?: string | null
          sender?: string | null
          status?: string
          subject?: string | null
          summary?: string | null
          thread_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          category?: string | null
          created_at?: string
          created_expense_id?: string | null
          created_spend_id?: string | null
          created_todo_id?: string | null
          currency?: string
          due_date?: string | null
          id?: string
          kind?: string
          merchant?: string | null
          message_id?: string
          occurred_at?: string | null
          raw_ai?: Json | null
          reference?: string | null
          sender?: string | null
          status?: string
          subject?: string | null
          summary?: string | null
          thread_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mail_findings_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_findings_created_expense_id_fkey"
            columns: ["created_expense_id"]
            isOneToOne: false
            referencedRelation: "fixed_expenses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_findings_created_spend_id_fkey"
            columns: ["created_spend_id"]
            isOneToOne: false
            referencedRelation: "spend_entries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "mail_findings_created_todo_id_fkey"
            columns: ["created_todo_id"]
            isOneToOne: false
            referencedRelation: "todos"
            referencedColumns: ["id"]
          },
        ]
      }
      mail_rules: {
        Row: {
          created_at: string
          id: string
          is_active: boolean
          kind: string
          mode: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind: string
          mode?: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          created_at?: string
          id?: string
          is_active?: boolean
          kind?: string
          mode?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      pantry_items: {
        Row: {
          category: string | null
          created_at: string
          id: string
          last_added_at: string
          last_purchased_at: string | null
          name: string
          name_key: string
          source: Database["public"]["Enums"]["shopping_source"]
          times_added: number
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          created_at?: string
          id?: string
          last_added_at?: string
          last_purchased_at?: string | null
          name: string
          name_key: string
          source?: Database["public"]["Enums"]["shopping_source"]
          times_added?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          created_at?: string
          id?: string
          last_added_at?: string
          last_purchased_at?: string | null
          name?: string
          name_key?: string
          source?: Database["public"]["Enums"]["shopping_source"]
          times_added?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      pantry_prices: {
        Row: {
          created_at: string
          id: string
          is_campaign: boolean
          merchant: string | null
          name: string
          name_key: string
          pantry_item_id: string | null
          price: number
          purchased_at: string
          quantity: string | null
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          is_campaign?: boolean
          merchant?: string | null
          name: string
          name_key: string
          pantry_item_id?: string | null
          price: number
          purchased_at?: string
          quantity?: string | null
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          is_campaign?: boolean
          merchant?: string | null
          name?: string
          name_key?: string
          pantry_item_id?: string | null
          price?: number
          purchased_at?: string
          quantity?: string | null
          source?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pantry_prices_pantry_item_id_fkey"
            columns: ["pantry_item_id"]
            isOneToOne: false
            referencedRelation: "pantry_items"
            referencedColumns: ["id"]
          },
        ]
      }
      places: {
        Row: {
          address: string | null
          color: string
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["place_kind"]
          lat: number
          lng: number
          name: string
          radius_m: number
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          color?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["place_kind"]
          lat: number
          lng: number
          name: string
          radius_m?: number
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          color?: string
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["place_kind"]
          lat?: number
          lng?: number
          name?: string
          radius_m?: number
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          email: string | null
          full_name: string | null
          id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string
        }
        Relationships: []
      }
      reminders: {
        Row: {
          created_at: string
          event_id: string | null
          id: string
          is_done: boolean
          remind_at: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          event_id?: string | null
          id?: string
          is_done?: boolean
          remind_at: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          event_id?: string | null
          id?: string
          is_done?: boolean
          remind_at?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "reminders_event_id_fkey"
            columns: ["event_id"]
            isOneToOne: false
            referencedRelation: "events"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_items: {
        Row: {
          category: string | null
          checked_at: string | null
          created_at: string
          id: string
          is_checked: boolean
          list_id: string
          name: string
          quantity: string | null
          sort_order: number
          source: Database["public"]["Enums"]["shopping_source"]
          updated_at: string
          user_id: string
        }
        Insert: {
          category?: string | null
          checked_at?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean
          list_id: string
          name: string
          quantity?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["shopping_source"]
          updated_at?: string
          user_id: string
        }
        Update: {
          category?: string | null
          checked_at?: string | null
          created_at?: string
          id?: string
          is_checked?: boolean
          list_id?: string
          name?: string
          quantity?: string | null
          sort_order?: number
          source?: Database["public"]["Enums"]["shopping_source"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "shopping_items_list_id_fkey"
            columns: ["list_id"]
            isOneToOne: false
            referencedRelation: "shopping_lists"
            referencedColumns: ["id"]
          },
        ]
      }
      shopping_lists: {
        Row: {
          completed_at: string | null
          created_at: string
          id: string
          status: Database["public"]["Enums"]["shopping_status"]
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["shopping_status"]
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          id?: string
          status?: Database["public"]["Enums"]["shopping_status"]
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      spend_entries: {
        Row: {
          account_id: string | null
          amount: number
          category: string | null
          created_at: string
          id: string
          note: string | null
          spent_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount: number
          category?: string | null
          created_at?: string
          id?: string
          note?: string | null
          spent_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number
          category?: string | null
          created_at?: string
          id?: string
          note?: string | null
          spent_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "spend_entries_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
        ]
      }
      todos: {
        Row: {
          completed_at: string | null
          created_at: string
          due_date: string | null
          id: string
          is_done: boolean
          notes: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          due_date?: string | null
          id?: string
          is_done?: boolean
          notes?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      travel_preferences: {
        Row: {
          created_at: string
          id: string
          kind: string
          preferred_mode: Database["public"]["Enums"]["travel_mode"]
          route_key: string | null
          updated_at: string
          user_id: string
          weekday: number | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          preferred_mode?: Database["public"]["Enums"]["travel_mode"]
          route_key?: string | null
          updated_at?: string
          user_id: string
          weekday?: number | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          preferred_mode?: Database["public"]["Enums"]["travel_mode"]
          route_key?: string | null
          updated_at?: string
          user_id?: string
          weekday?: number | null
        }
        Relationships: []
      }
      vault_challenges: {
        Row: {
          challenge: string
          created_at: string
          expires_at: string
          id: string
          purpose: string
          user_id: string
        }
        Insert: {
          challenge: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose: string
          user_id: string
        }
        Update: {
          challenge?: string
          created_at?: string
          expires_at?: string
          id?: string
          purpose?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_credentials: {
        Row: {
          counter: number
          created_at: string
          credential_id: string
          id: string
          label: string | null
          public_key: string
          rp_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          counter?: number
          created_at?: string
          credential_id: string
          id?: string
          label?: string | null
          public_key: string
          rp_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          counter?: number
          created_at?: string
          credential_id?: string
          id?: string
          label?: string | null
          public_key?: string
          rp_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_files: {
        Row: {
          caption: string | null
          created_at: string
          file_name: string
          id: string
          mime_type: string | null
          size_bytes: number | null
          storage_path: string
          updated_at: string
          user_id: string
        }
        Insert: {
          caption?: string | null
          created_at?: string
          file_name: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path: string
          updated_at?: string
          user_id: string
        }
        Update: {
          caption?: string | null
          created_at?: string
          file_name?: string
          id?: string
          mime_type?: string | null
          size_bytes?: number | null
          storage_path?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      vault_items: {
        Row: {
          created_at: string
          id: string
          kind: Database["public"]["Enums"]["vault_kind"]
          notes: string | null
          secret: string | null
          title: string
          updated_at: string
          url: string | null
          user_id: string
          username: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["vault_kind"]
          notes?: string | null
          secret?: string | null
          title: string
          updated_at?: string
          url?: string | null
          user_id: string
          username?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: Database["public"]["Enums"]["vault_kind"]
          notes?: string | null
          secret?: string | null
          title?: string
          updated_at?: string
          url?: string | null
          user_id?: string
          username?: string | null
        }
        Relationships: []
      }
      visit_edits: {
        Row: {
          created_at: string
          field: string
          id: string
          new_value: string | null
          old_value: string | null
          user_id: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          field: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id: string
          visit_id: string
        }
        Update: {
          created_at?: string
          field?: string
          id?: string
          new_value?: string | null
          old_value?: string | null
          user_id?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visit_edits_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "visits"
            referencedColumns: ["id"]
          },
        ]
      }
      visits: {
        Row: {
          address: string | null
          arrived_at: string
          created_at: string
          distance_m: number
          distance_verified: boolean
          end_lat: number | null
          end_lng: number | null
          entry_kind: Database["public"]["Enums"]["visit_kind"]
          id: string
          is_manual: boolean
          label: string | null
          lat: number | null
          left_at: string | null
          lng: number | null
          note: string | null
          place_id: string | null
          source: string
          travel_mode: Database["public"]["Enums"]["travel_mode"]
          updated_at: string
          user_id: string
        }
        Insert: {
          address?: string | null
          arrived_at: string
          created_at?: string
          distance_m?: number
          distance_verified?: boolean
          end_lat?: number | null
          end_lng?: number | null
          entry_kind?: Database["public"]["Enums"]["visit_kind"]
          id?: string
          is_manual?: boolean
          label?: string | null
          lat?: number | null
          left_at?: string | null
          lng?: number | null
          note?: string | null
          place_id?: string | null
          source?: string
          travel_mode?: Database["public"]["Enums"]["travel_mode"]
          updated_at?: string
          user_id: string
        }
        Update: {
          address?: string | null
          arrived_at?: string
          created_at?: string
          distance_m?: number
          distance_verified?: boolean
          end_lat?: number | null
          end_lng?: number | null
          entry_kind?: Database["public"]["Enums"]["visit_kind"]
          id?: string
          is_manual?: boolean
          label?: string | null
          lat?: number | null
          left_at?: string | null
          lng?: number | null
          note?: string | null
          place_id?: string | null
          source?: string
          travel_mode?: Database["public"]["Enums"]["travel_mode"]
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "visits_place_id_fkey"
            columns: ["place_id"]
            isOneToOne: false
            referencedRelation: "places"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      calendar_source:
        | "local"
        | "google"
        | "outlook"
        | "apple"
        | "ics"
        | "school"
        | "sports"
        | "family"
      event_category:
        | "jobb"
        | "ledig"
        | "jurist"
        | "barn"
        | "privat"
        | "viktigt"
      place_kind: "jobb" | "jurist" | "hem" | "barn" | "annat"
      shopping_source: "manuell" | "ai"
      shopping_status: "aktiv" | "klar"
      travel_mode: "bil" | "kollektivt" | "gang_cykel" | "okant"
      vault_kind: "losenord" | "pinkod" | "kod" | "anteckning"
      visit_kind: "besok" | "resa"
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
      calendar_source: [
        "local",
        "google",
        "outlook",
        "apple",
        "ics",
        "school",
        "sports",
        "family",
      ],
      event_category: ["jobb", "ledig", "jurist", "barn", "privat", "viktigt"],
      place_kind: ["jobb", "jurist", "hem", "barn", "annat"],
      shopping_source: ["manuell", "ai"],
      shopping_status: ["aktiv", "klar"],
      travel_mode: ["bil", "kollektivt", "gang_cykel", "okant"],
      vault_kind: ["losenord", "pinkod", "kod", "anteckning"],
      visit_kind: ["besok", "resa"],
    },
  },
} as const
