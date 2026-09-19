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
      care_clients: {
        Row: {
          address: string | null
          created_at: string
          door_code: string | null
          id: string
          is_active: boolean
          key_info: string | null
          lat: number | null
          lng: number | null
          name: string
          notes: string | null
          org_id: string
          personal_number: string | null
          phone: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          created_at?: string
          door_code?: string | null
          id?: string
          is_active?: boolean
          key_info?: string | null
          lat?: number | null
          lng?: number | null
          name: string
          notes?: string | null
          org_id: string
          personal_number?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          created_at?: string
          door_code?: string | null
          id?: string
          is_active?: boolean
          key_info?: string | null
          lat?: number | null
          lng?: number | null
          name?: string
          notes?: string | null
          org_id?: string
          personal_number?: string | null
          phone?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_clients_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_consents: {
        Row: {
          client_id: string
          created_at: string
          granted: boolean
          id: string
          relative_user_id: string
          scope: string
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          granted?: boolean
          id?: string
          relative_user_id: string
          scope: string
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          granted?: boolean
          id?: string
          relative_user_id?: string
          scope?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_consents_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "care_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_medication_events: {
        Row: {
          created_at: string
          given_at: string
          given_by: string | null
          given_role: string | null
          id: string
          medication_id: string
          note: string | null
          org_id: string
          visit_id: string | null
        }
        Insert: {
          created_at?: string
          given_at?: string
          given_by?: string | null
          given_role?: string | null
          id?: string
          medication_id: string
          note?: string | null
          org_id: string
          visit_id?: string | null
        }
        Update: {
          created_at?: string
          given_at?: string
          given_by?: string | null
          given_role?: string | null
          id?: string
          medication_id?: string
          note?: string | null
          org_id?: string
          visit_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_medication_events_medication_id_fkey"
            columns: ["medication_id"]
            isOneToOne: false
            referencedRelation: "care_medications"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_medication_events_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_medication_events_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "care_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      care_medications: {
        Row: {
          client_id: string
          created_at: string
          dose: string | null
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          org_id: string
          requires_delegation: boolean
          times: string | null
          updated_at: string
        }
        Insert: {
          client_id: string
          created_at?: string
          dose?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          org_id: string
          requires_delegation?: boolean
          times?: string | null
          updated_at?: string
        }
        Update: {
          client_id?: string
          created_at?: string
          dose?: string | null
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          org_id?: string
          requires_delegation?: boolean
          times?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_medications_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "care_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_medications_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_message_reads: {
        Row: {
          client_id: string
          read_at: string
          user_id: string
        }
        Insert: {
          client_id: string
          read_at?: string
          user_id: string
        }
        Update: {
          client_id?: string
          read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_message_reads_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "care_clients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_messages: {
        Row: {
          author_id: string
          author_name: string
          author_role: string
          body: string
          client_id: string
          created_at: string
          id: string
          org_id: string
        }
        Insert: {
          author_id: string
          author_name: string
          author_role?: string
          body: string
          client_id: string
          created_at?: string
          id?: string
          org_id: string
        }
        Update: {
          author_id?: string
          author_name?: string
          author_role?: string
          body?: string
          client_id?: string
          created_at?: string
          id?: string
          org_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_messages_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "care_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_messages_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_org_finance: {
        Row: {
          created_at: string
          currency: string
          hourly_rate: number
          org_id: string
          staff_cost_per_hour: number
          travel_cost_per_km: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          currency?: string
          hourly_rate?: number
          org_id: string
          staff_cost_per_hour?: number
          travel_cost_per_km?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          currency?: string
          hourly_rate?: number
          org_id?: string
          staff_cost_per_hour?: number
          travel_cost_per_km?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_org_finance_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_relatives: {
        Row: {
          client_id: string
          consent: Json
          created_at: string
          email: string | null
          id: string
          name: string
          notes: string | null
          org_id: string
          phone: string | null
          relation: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          client_id: string
          consent?: Json
          created_at?: string
          email?: string | null
          id?: string
          name: string
          notes?: string | null
          org_id: string
          phone?: string | null
          relation?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          client_id?: string
          consent?: Json
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          notes?: string | null
          org_id?: string
          phone?: string | null
          relation?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_relatives_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "care_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_relatives_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_shopping_items: {
        Row: {
          amount: number | null
          client_id: string
          created_at: string
          created_by: string | null
          created_name: string | null
          created_role: string | null
          done_at: string | null
          done_by: string | null
          id: string
          is_done: boolean
          note: string | null
          org_id: string
          quantity: string | null
          title: string
          updated_at: string
        }
        Insert: {
          amount?: number | null
          client_id: string
          created_at?: string
          created_by?: string | null
          created_name?: string | null
          created_role?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          note?: string | null
          org_id: string
          quantity?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          amount?: number | null
          client_id?: string
          created_at?: string
          created_by?: string | null
          created_name?: string | null
          created_role?: string | null
          done_at?: string | null
          done_by?: string | null
          id?: string
          is_done?: boolean
          note?: string | null
          org_id?: string
          quantity?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_shopping_items_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "care_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_shopping_items_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_task_templates: {
        Row: {
          created_at: string
          default_minutes: number
          description: string | null
          id: string
          is_active: boolean
          org_id: string
          title: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          default_minutes?: number
          description?: string | null
          id?: string
          is_active?: boolean
          org_id: string
          title: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          default_minutes?: number
          description?: string | null
          id?: string
          is_active?: boolean
          org_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_task_templates_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      care_visit_tasks: {
        Row: {
          created_at: string
          done_at: string | null
          done_by: string | null
          done_role: string | null
          id: string
          is_done: boolean
          org_id: string
          sort_order: number
          template_id: string | null
          title: string
          updated_at: string
          visit_id: string
        }
        Insert: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          done_role?: string | null
          id?: string
          is_done?: boolean
          org_id: string
          sort_order?: number
          template_id?: string | null
          title: string
          updated_at?: string
          visit_id: string
        }
        Update: {
          created_at?: string
          done_at?: string | null
          done_by?: string | null
          done_role?: string | null
          id?: string
          is_done?: boolean
          org_id?: string
          sort_order?: number
          template_id?: string | null
          title?: string
          updated_at?: string
          visit_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_visit_tasks_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_visit_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "care_task_templates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_visit_tasks_visit_id_fkey"
            columns: ["visit_id"]
            isOneToOne: false
            referencedRelation: "care_visits"
            referencedColumns: ["id"]
          },
        ]
      }
      care_visits: {
        Row: {
          checkin_at: string | null
          checkout_at: string | null
          client_id: string
          created_at: string
          deviation: string | null
          ends_at: string
          id: string
          note: string | null
          org_id: string
          repeat_rule: string | null
          staff_id: string | null
          starts_at: string
          status: string
          title: string | null
          travel_meters: number | null
          travel_seconds: number | null
          updated_at: string
        }
        Insert: {
          checkin_at?: string | null
          checkout_at?: string | null
          client_id: string
          created_at?: string
          deviation?: string | null
          ends_at: string
          id?: string
          note?: string | null
          org_id: string
          repeat_rule?: string | null
          staff_id?: string | null
          starts_at: string
          status?: string
          title?: string | null
          travel_meters?: number | null
          travel_seconds?: number | null
          updated_at?: string
        }
        Update: {
          checkin_at?: string | null
          checkout_at?: string | null
          client_id?: string
          created_at?: string
          deviation?: string | null
          ends_at?: string
          id?: string
          note?: string | null
          org_id?: string
          repeat_rule?: string | null
          staff_id?: string | null
          starts_at?: string
          status?: string
          title?: string | null
          travel_meters?: number | null
          travel_seconds?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_visits_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "care_clients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_visits_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_visits_staff_id_fkey"
            columns: ["staff_id"]
            isOneToOne: false
            referencedRelation: "org_members"
            referencedColumns: ["id"]
          },
        ]
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
      cron_settings: {
        Row: {
          created_at: string
          id: boolean
          token: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          token?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          token?: string
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
            foreignKeyName: "fixed_expense_payments_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
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
          account_id: string | null
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
          account_id?: string | null
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
          account_id?: string | null
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
            foreignKeyName: "fixed_expenses_account_id_fkey"
            columns: ["account_id"]
            isOneToOne: false
            referencedRelation: "finance_accounts"
            referencedColumns: ["id"]
          },
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
      location_ingest_log: {
        Row: {
          detail: string | null
          had_token: boolean
          id: string
          outcome: string
          received_at: string
          user_agent: string | null
        }
        Insert: {
          detail?: string | null
          had_token?: boolean
          id?: string
          outcome: string
          received_at?: string
          user_agent?: string | null
        }
        Update: {
          detail?: string | null
          had_token?: boolean
          id?: string
          outcome?: string
          received_at?: string
          user_agent?: string | null
        }
        Relationships: []
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
      location_settings: {
        Row: {
          created_at: string
          id: boolean
          locator_mode: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: boolean
          locator_mode?: string
          token: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: boolean
          locator_mode?: string
          token?: string
          updated_at?: string
        }
        Relationships: []
      }
      mail_findings: {
        Row: {
          account_id: string | null
          amount: number | null
          attachment_names: string[] | null
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
          suggested_slots: Json | null
          summary: string | null
          thread_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          account_id?: string | null
          amount?: number | null
          attachment_names?: string[] | null
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
          suggested_slots?: Json | null
          summary?: string | null
          thread_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          account_id?: string | null
          amount?: number | null
          attachment_names?: string[] | null
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
          suggested_slots?: Json | null
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
      mail_seen: {
        Row: {
          created_at: string
          had_finding: boolean
          id: string
          message_id: string
          scanned_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          had_finding?: boolean
          id?: string
          message_id: string
          scanned_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          had_finding?: boolean
          id?: string
          message_id?: string
          scanned_at?: string
          user_id?: string
        }
        Relationships: []
      }
      org_invites: {
        Row: {
          created_at: string
          display_name: string | null
          email: string
          expires_at: string
          id: string
          invited_by: string | null
          org_id: string
          role: Database["public"]["Enums"]["care_role"]
          status: string
          token: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          display_name?: string | null
          email: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id: string
          role: Database["public"]["Enums"]["care_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          display_name?: string | null
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string | null
          org_id?: string
          role?: Database["public"]["Enums"]["care_role"]
          status?: string
          token?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_invites_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_members: {
        Row: {
          created_at: string
          display_name: string
          email: string | null
          employment: string | null
          id: string
          is_active: boolean
          notes: string | null
          org_id: string
          phone: string | null
          role: Database["public"]["Enums"]["care_role"]
          updated_at: string
          user_id: string | null
          work_hours: string | null
        }
        Insert: {
          created_at?: string
          display_name: string
          email?: string | null
          employment?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id: string
          phone?: string | null
          role: Database["public"]["Enums"]["care_role"]
          updated_at?: string
          user_id?: string | null
          work_hours?: string | null
        }
        Update: {
          created_at?: string
          display_name?: string
          email?: string | null
          employment?: string | null
          id?: string
          is_active?: boolean
          notes?: string | null
          org_id?: string
          phone?: string | null
          role?: Database["public"]["Enums"]["care_role"]
          updated_at?: string
          user_id?: string | null
          work_hours?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "org_members_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_modules: {
        Row: {
          created_at: string
          enabled: boolean
          id: string
          module: string
          org_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          id?: string
          module: string
          org_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          enabled?: boolean
          id?: string
          module?: string
          org_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_modules_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      org_permissions: {
        Row: {
          can_edit: boolean
          can_view: boolean
          created_at: string
          id: string
          module: string
          org_id: string
          role: Database["public"]["Enums"]["care_role"]
          updated_at: string
        }
        Insert: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module: string
          org_id: string
          role: Database["public"]["Enums"]["care_role"]
          updated_at?: string
        }
        Update: {
          can_edit?: boolean
          can_view?: boolean
          created_at?: string
          id?: string
          module?: string
          org_id?: string
          role?: Database["public"]["Enums"]["care_role"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "org_permissions_org_id_fkey"
            columns: ["org_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          billing_address: string | null
          billing_email: string | null
          billing_reference: string | null
          contact_email: string | null
          contact_name: string | null
          contact_phone: string | null
          contact_role: string | null
          contract_start: string | null
          contract_type: string
          created_at: string
          created_by: string | null
          id: string
          internal_notes: string | null
          is_active: boolean
          name: string
          org_number: string | null
          seats: number | null
          segment: string | null
          slug: string | null
          status: string
          updated_at: string
          website: string | null
        }
        Insert: {
          address?: string | null
          billing_address?: string | null
          billing_email?: string | null
          billing_reference?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          contract_start?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          name: string
          org_number?: string | null
          seats?: number | null
          segment?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
        }
        Update: {
          address?: string | null
          billing_address?: string | null
          billing_email?: string | null
          billing_reference?: string | null
          contact_email?: string | null
          contact_name?: string | null
          contact_phone?: string | null
          contact_role?: string | null
          contract_start?: string | null
          contract_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          internal_notes?: string | null
          is_active?: boolean
          name?: string
          org_number?: string | null
          seats?: number | null
          segment?: string | null
          slug?: string | null
          status?: string
          updated_at?: string
          website?: string | null
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
      sales_leads: {
        Row: {
          contact_name: string
          created_at: string
          email: string
          id: string
          message: string | null
          org_name: string
          phone: string | null
          segment: string | null
          status: string
          updated_at: string
        }
        Insert: {
          contact_name: string
          created_at?: string
          email: string
          id?: string
          message?: string | null
          org_name: string
          phone?: string | null
          segment?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          contact_name?: string
          created_at?: string
          email?: string
          id?: string
          message?: string | null
          org_name?: string
          phone?: string | null
          segment?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: []
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
      trip_logs: {
        Row: {
          created_at: string
          driven_km: number
          driven_on: string
          from_label: string
          from_lat: number | null
          from_lng: number | null
          id: string
          purpose: string | null
          route_checked_at: string | null
          route_meters: number | null
          route_minutes: number | null
          to_label: string
          to_lat: number | null
          to_lng: number | null
          travel_mode: Database["public"]["Enums"]["travel_mode"]
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          driven_km?: number
          driven_on?: string
          from_label: string
          from_lat?: number | null
          from_lng?: number | null
          id?: string
          purpose?: string | null
          route_checked_at?: string | null
          route_meters?: number | null
          route_minutes?: number | null
          to_label: string
          to_lat?: number | null
          to_lng?: number | null
          travel_mode?: Database["public"]["Enums"]["travel_mode"]
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          driven_km?: number
          driven_on?: string
          from_label?: string
          from_lat?: number | null
          from_lng?: number | null
          id?: string
          purpose?: string | null
          route_checked_at?: string | null
          route_meters?: number | null
          route_minutes?: number | null
          to_label?: string
          to_lat?: number | null
          to_lng?: number | null
          travel_mode?: Database["public"]["Enums"]["travel_mode"]
          updated_at?: string
          user_id?: string
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
      can_access_care_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      can_manage_org: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
      can_view_client: {
        Args: { _client_id: string; _user_id: string }
        Returns: boolean
      }
      has_org_role: {
        Args: {
          _org_id: string
          _role: Database["public"]["Enums"]["care_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_app_owner: { Args: { _user_id: string }; Returns: boolean }
      is_org_member: {
        Args: { _org_id: string; _user_id: string }
        Returns: boolean
      }
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
      care_role:
        | "superadmin"
        | "org_admin"
        | "caregiver"
        | "client"
        | "relative"
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
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
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
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
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
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
      care_role: ["superadmin", "org_admin", "caregiver", "client", "relative"],
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
