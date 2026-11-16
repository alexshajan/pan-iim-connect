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
    PostgrestVersion: "14.17"
  }
  public: {
    Tables: {
      accommodations: {
        Row: {
          check_in: string | null
          check_out: string | null
          created_at: string
          id: string
          is_placeholder: boolean
          person_id: string
          placeholder_batch: string | null
          residence: string
          room_no: string | null
        }
        Insert: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          id?: string
          is_placeholder?: boolean
          person_id: string
          placeholder_batch?: string | null
          residence: string
          room_no?: string | null
        }
        Update: {
          check_in?: string | null
          check_out?: string | null
          created_at?: string
          id?: string
          is_placeholder?: boolean
          person_id?: string
          placeholder_batch?: string | null
          residence?: string
          room_no?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "accommodations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "accommodations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      alert_requests: {
        Row: {
          announcement_id: string | null
          audience: string
          body: string
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          ends_at: string | null
          id: string
          kind: string
          requested_by: string
          session_id: string | null
          status: string
          title: string
          urgent: boolean
        }
        Insert: {
          announcement_id?: string | null
          audience?: string
          body: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          requested_by?: string
          session_id?: string | null
          status?: string
          title: string
          urgent?: boolean
        }
        Update: {
          announcement_id?: string | null
          audience?: string
          body?: string
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          requested_by?: string
          session_id?: string | null
          status?: string
          title?: string
          urgent?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "alert_requests_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      announcements: {
        Row: {
          audience: string
          body: string
          created_by: string | null
          ends_at: string | null
          id: string
          kind: string
          published_at: string
          session_id: string | null
          title: string
          urgent: boolean
          withdrawn_at: string | null
        }
        Insert: {
          audience?: string
          body: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          published_at?: string
          session_id?: string | null
          title: string
          urgent?: boolean
          withdrawn_at?: string | null
        }
        Update: {
          audience?: string
          body?: string
          created_by?: string | null
          ends_at?: string | null
          id?: string
          kind?: string
          published_at?: string
          session_id?: string | null
          title?: string
          urgent?: boolean
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "announcements_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_log: {
        Row: {
          action: string
          actor: string | null
          at: string
          diff: Json | null
          id: string
          row_id: string | null
          table_name: string
        }
        Insert: {
          action: string
          actor?: string | null
          at?: string
          diff?: Json | null
          id?: string
          row_id?: string | null
          table_name: string
        }
        Update: {
          action?: string
          actor?: string | null
          at?: string
          diff?: Json | null
          id?: string
          row_id?: string | null
          table_name?: string
        }
        Relationships: []
      }
      bookmarks: {
        Row: {
          created_at: string
          id: string
          session_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          session_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "bookmarks_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      cab_drivers: {
        Row: {
          active: boolean
          id: string
          is_placeholder: boolean
          languages: string[]
          name: string
          notes: string | null
          phone: string
          placeholder_batch: string | null
          routes: Json
          seats: number
          updated_at: string
          vehicle: string | null
          whatsapp: string | null
        }
        Insert: {
          active?: boolean
          id?: string
          is_placeholder?: boolean
          languages?: string[]
          name: string
          notes?: string | null
          phone: string
          placeholder_batch?: string | null
          routes?: Json
          seats?: number
          updated_at?: string
          vehicle?: string | null
          whatsapp?: string | null
        }
        Update: {
          active?: boolean
          id?: string
          is_placeholder?: boolean
          languages?: string[]
          name?: string
          notes?: string | null
          phone?: string
          placeholder_batch?: string | null
          routes?: Json
          seats?: number
          updated_at?: string
          vehicle?: string | null
          whatsapp?: string | null
        }
        Relationships: []
      }
      calendar_feeds: {
        Row: {
          created_at: string
          token: string
          user_id: string
        }
        Insert: {
          created_at?: string
          token?: string
          user_id: string
        }
        Update: {
          created_at?: string
          token?: string
          user_id?: string
        }
        Relationships: []
      }
      campus_services: {
        Row: {
          action_label: string | null
          action_url: string | null
          category: string
          created_at: string
          description: string | null
          featured: boolean
          hours: string | null
          icon: string
          id: string
          lat: number | null
          lng: number | null
          name: string
          phone: string | null
          sort_order: number
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          action_label?: string | null
          action_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          hours?: string | null
          icon?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name: string
          phone?: string | null
          sort_order?: number
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          action_label?: string | null
          action_url?: string | null
          category?: string
          created_at?: string
          description?: string | null
          featured?: boolean
          hours?: string | null
          icon?: string
          id?: string
          lat?: number | null
          lng?: number | null
          name?: string
          phone?: string | null
          sort_order?: number
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "campus_services_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      check_ins: {
        Row: {
          by_user: string | null
          checked_in_at: string
          event_day: string
          id: string
          is_placeholder: boolean
          method: string
          person_id: string
          placeholder_batch: string | null
          voided_at: string | null
          voided_by: string | null
        }
        Insert: {
          by_user?: string | null
          checked_in_at?: string
          event_day?: string
          id?: string
          is_placeholder?: boolean
          method?: string
          person_id: string
          placeholder_batch?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Update: {
          by_user?: string | null
          checked_in_at?: string
          event_day?: string
          id?: string
          is_placeholder?: boolean
          method?: string
          person_id?: string
          placeholder_batch?: string | null
          voided_at?: string | null
          voided_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "check_ins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "check_ins_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      console_settings: {
        Row: {
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      content_blocks: {
        Row: {
          body: string | null
          category: string
          id: string
          meta: Json
          sort_order: number
          subtitle: string | null
          title: string
          updated_at: string
        }
        Insert: {
          body?: string | null
          category: string
          id?: string
          meta?: Json
          sort_order?: number
          subtitle?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          body?: string | null
          category?: string
          id?: string
          meta?: Json
          sort_order?: number
          subtitle?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      detail_requests: {
        Row: {
          author_index: number | null
          created_at: string
          decided_at: string | null
          decided_by: string | null
          decision_note: string | null
          id: string
          kind: string
          note: string | null
          person_id: string
          proposed_email: string | null
          proposed_name: string | null
          proposed_org: string | null
          status: string
          submission_id: string | null
          user_id: string
        }
        Insert: {
          author_index?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          kind: string
          note?: string | null
          person_id: string
          proposed_email?: string | null
          proposed_name?: string | null
          proposed_org?: string | null
          status?: string
          submission_id?: string | null
          user_id: string
        }
        Update: {
          author_index?: number | null
          created_at?: string
          decided_at?: string | null
          decided_by?: string | null
          decision_note?: string | null
          id?: string
          kind?: string
          note?: string | null
          person_id?: string
          proposed_email?: string | null
          proposed_name?: string | null
          proposed_org?: string | null
          status?: string
          submission_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "detail_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detail_requests_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detail_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "public_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "detail_requests_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      feedback: {
        Row: {
          comment: string | null
          created_at: string
          id: string
          rating: number | null
          session_id: string | null
          user_id: string | null
        }
        Insert: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Update: {
          comment?: string | null
          created_at?: string
          id?: string
          rating?: number | null
          session_id?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "feedback_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_messages: {
        Row: {
          created_at: string
          id: string
          message: Json
          message_id: string
          thread_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          message: Json
          message_id: string
          thread_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          message?: Json
          message_id?: string
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "guide_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "guide_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      guide_prompts: {
        Row: {
          active: boolean
          id: string
          module: string
          sort_order: number
          text: string
        }
        Insert: {
          active?: boolean
          id?: string
          module?: string
          sort_order?: number
          text: string
        }
        Update: {
          active?: boolean
          id?: string
          module?: string
          sort_order?: number
          text?: string
        }
        Relationships: []
      }
      guide_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      help_requests: {
        Row: {
          assigned_to: string | null
          category: string
          contact: string | null
          created_at: string
          detail_request_id: string | null
          id: string
          location: string | null
          message: string
          name: string | null
          resolution_note: string | null
          resolved_at: string | null
          seen_at: string | null
          status: string
          updated_at: string
          urgent: boolean
          user_id: string | null
        }
        Insert: {
          assigned_to?: string | null
          category?: string
          contact?: string | null
          created_at?: string
          detail_request_id?: string | null
          id?: string
          location?: string | null
          message: string
          name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          seen_at?: string | null
          status?: string
          updated_at?: string
          urgent?: boolean
          user_id?: string | null
        }
        Update: {
          assigned_to?: string | null
          category?: string
          contact?: string | null
          created_at?: string
          detail_request_id?: string | null
          id?: string
          location?: string | null
          message?: string
          name?: string | null
          resolution_note?: string | null
          resolved_at?: string | null
          seen_at?: string | null
          status?: string
          updated_at?: string
          urgent?: boolean
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "help_requests_detail_request_id_fkey"
            columns: ["detail_request_id"]
            isOneToOne: false
            referencedRelation: "detail_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      import_batches: {
        Row: {
          created_at: string
          created_by: string | null
          file_name: string
          id: string
          rolled_back_at: string | null
          row_count: number
          summary: Json
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          file_name: string
          id?: string
          rolled_back_at?: string | null
          row_count?: number
          summary?: Json
        }
        Update: {
          created_at?: string
          created_by?: string | null
          file_name?: string
          id?: string
          rolled_back_at?: string | null
          row_count?: number
          summary?: Json
        }
        Relationships: []
      }
      institution_aliases: {
        Row: {
          canonical: string
          method: string
          raw: string
          updated_at: string
        }
        Insert: {
          canonical: string
          method?: string
          raw: string
          updated_at?: string
        }
        Update: {
          canonical?: string
          method?: string
          raw?: string
          updated_at?: string
        }
        Relationships: []
      }
      map_pins: {
        Row: {
          category: string
          description: string | null
          id: string
          lat: number
          lng: number
          name: string
          sort_order: number
        }
        Insert: {
          category: string
          description?: string | null
          id?: string
          lat: number
          lng: number
          name: string
          sort_order?: number
        }
        Update: {
          category?: string
          description?: string | null
          id?: string
          lat?: number
          lng?: number
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      mess_meals: {
        Row: {
          created_at: string
          ends_at: string
          highlight: string
          id: string
          items: string[]
          location_name: string | null
          meal: string
          note: string | null
          sort_order: number
          starts_at: string
          status: string
          tags: string[]
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          created_at?: string
          ends_at: string
          highlight: string
          id?: string
          items?: string[]
          location_name?: string | null
          meal: string
          note?: string | null
          sort_order?: number
          starts_at: string
          status?: string
          tags?: string[]
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          created_at?: string
          ends_at?: string
          highlight?: string
          id?: string
          items?: string[]
          location_name?: string | null
          meal?: string
          note?: string | null
          sort_order?: number
          starts_at?: string
          status?: string
          tags?: string[]
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "mess_meals_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      network_waves: {
        Row: {
          created_at: string
          from_person_id: string
          id: string
          to_person_id: string
        }
        Insert: {
          created_at?: string
          from_person_id: string
          id?: string
          to_person_id: string
        }
        Update: {
          created_at?: string
          from_person_id?: string
          id?: string
          to_person_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "network_waves_from_person_id_fkey"
            columns: ["from_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_waves_from_person_id_fkey"
            columns: ["from_person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_waves_to_person_id_fkey"
            columns: ["to_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "network_waves_to_person_id_fkey"
            columns: ["to_person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_prefs: {
        Row: {
          email_updates: boolean
          general_updates: boolean
          push_enabled: boolean
          schedule_changes: boolean
          session_reminders: boolean
          updated_at: string
          user_id: string
        }
        Insert: {
          email_updates?: boolean
          general_updates?: boolean
          push_enabled?: boolean
          schedule_changes?: boolean
          session_reminders?: boolean
          updated_at?: string
          user_id: string
        }
        Update: {
          email_updates?: boolean
          general_updates?: boolean
          push_enabled?: boolean
          schedule_changes?: boolean
          session_reminders?: boolean
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      papers: {
        Row: {
          abstract: string | null
          affiliation: string | null
          authors: string
          discussant: string | null
          id: string
          import_batch: string | null
          presenter_email: string | null
          session_id: string
          slot_order: number
          title: string
        }
        Insert: {
          abstract?: string | null
          affiliation?: string | null
          authors: string
          discussant?: string | null
          id?: string
          import_batch?: string | null
          presenter_email?: string | null
          session_id: string
          slot_order?: number
          title: string
        }
        Update: {
          abstract?: string | null
          affiliation?: string | null
          authors?: string
          discussant?: string | null
          id?: string
          import_batch?: string | null
          presenter_email?: string | null
          session_id?: string
          slot_order?: number
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "papers_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      participants: {
        Row: {
          affiliation: string | null
          arrival_note: string | null
          created_at: string
          email: string
          full_name: string
          id: string
          residence: string | null
          role: string
          room_no: string | null
        }
        Insert: {
          affiliation?: string | null
          arrival_note?: string | null
          created_at?: string
          email: string
          full_name: string
          id?: string
          residence?: string | null
          role?: string
          room_no?: string | null
        }
        Update: {
          affiliation?: string | null
          arrival_note?: string | null
          created_at?: string
          email?: string
          full_name?: string
          id?: string
          residence?: string | null
          role?: string
          room_no?: string | null
        }
        Relationships: []
      }
      people: {
        Row: {
          address: string | null
          alt_email: string | null
          attendance_mode: string
          bio: string | null
          card_role: string | null
          category: string | null
          consent_calls: boolean
          consent_networking: boolean
          consent_photo: boolean
          consent_whatsapp: boolean
          created_at: string
          created_batch_id: string | null
          delegate_code: string
          directory_opt_in: boolean
          email: string
          email_missing: boolean
          full_name: string
          id: string
          is_placeholder: boolean
          keywords: string[]
          linkedin_url: string | null
          notes: string | null
          organization: string | null
          organization_raw: string | null
          phone: string | null
          placeholder_batch: string | null
          profile_links: Json
          share_contact_card: boolean
          source_rows: number[]
          submission_ref: string | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          address?: string | null
          alt_email?: string | null
          attendance_mode?: string
          bio?: string | null
          card_role?: string | null
          category?: string | null
          consent_calls?: boolean
          consent_networking?: boolean
          consent_photo?: boolean
          consent_whatsapp?: boolean
          created_at?: string
          created_batch_id?: string | null
          delegate_code: string
          directory_opt_in?: boolean
          email: string
          email_missing?: boolean
          full_name: string
          id?: string
          is_placeholder?: boolean
          keywords?: string[]
          linkedin_url?: string | null
          notes?: string | null
          organization?: string | null
          organization_raw?: string | null
          phone?: string | null
          placeholder_batch?: string | null
          profile_links?: Json
          share_contact_card?: boolean
          source_rows?: number[]
          submission_ref?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          address?: string | null
          alt_email?: string | null
          attendance_mode?: string
          bio?: string | null
          card_role?: string | null
          category?: string | null
          consent_calls?: boolean
          consent_networking?: boolean
          consent_photo?: boolean
          consent_whatsapp?: boolean
          created_at?: string
          created_batch_id?: string | null
          delegate_code?: string
          directory_opt_in?: boolean
          email?: string
          email_missing?: boolean
          full_name?: string
          id?: string
          is_placeholder?: boolean
          keywords?: string[]
          linkedin_url?: string | null
          notes?: string | null
          organization?: string | null
          organization_raw?: string | null
          phone?: string | null
          placeholder_batch?: string | null
          profile_links?: Json
          share_contact_card?: boolean
          source_rows?: number[]
          submission_ref?: string | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "people_created_batch_id_fkey"
            columns: ["created_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      person_bookmarks: {
        Row: {
          created_at: string
          id: string
          owner_user_id: string
          submission_id: string | null
          target_person_id: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          owner_user_id: string
          submission_id?: string | null
          target_person_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          owner_user_id?: string
          submission_id?: string | null
          target_person_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "person_bookmarks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "public_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_bookmarks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_bookmarks_target_person_id_fkey"
            columns: ["target_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_bookmarks_target_person_id_fkey"
            columns: ["target_person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      person_connections: {
        Row: {
          created_at: string
          id: string
          note: string | null
          other_person_id: string
          owner_person_id: string
          source: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          other_person_id: string
          owner_person_id: string
          source?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          other_person_id?: string
          owner_person_id?: string
          source?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_connections_other_person_id_fkey"
            columns: ["other_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_connections_other_person_id_fkey"
            columns: ["other_person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_connections_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_connections_owner_person_id_fkey"
            columns: ["owner_person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      person_roles: {
        Row: {
          id: string
          is_placeholder: boolean
          person_id: string
          placeholder_batch: string | null
          role: string
        }
        Insert: {
          id?: string
          is_placeholder?: boolean
          person_id: string
          placeholder_batch?: string | null
          role: string
        }
        Update: {
          id?: string
          is_placeholder?: boolean
          person_id?: string
          placeholder_batch?: string | null
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "person_roles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "person_roles_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          affiliation: string | null
          created_at: string
          email: string | null
          full_name: string | null
          headline: string | null
          id: string
          linkedin_url: string | null
          networking_opt_in: boolean
          onboarded_at: string | null
          phone: string | null
        }
        Insert: {
          affiliation?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id: string
          linkedin_url?: string | null
          networking_opt_in?: boolean
          onboarded_at?: string | null
          phone?: string | null
        }
        Update: {
          affiliation?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          headline?: string | null
          id?: string
          linkedin_url?: string | null
          networking_opt_in?: boolean
          onboarded_at?: string | null
          phone?: string | null
        }
        Relationships: []
      }
      programme_days: {
        Row: {
          day: string
          id: string
          is_final: boolean
          label: string
          sort_order: number
          structure_note: string | null
        }
        Insert: {
          day: string
          id?: string
          is_final?: boolean
          label: string
          sort_order?: number
          structure_note?: string | null
        }
        Update: {
          day?: string
          id?: string
          is_final?: boolean
          label?: string
          sort_order?: number
          structure_note?: string | null
        }
        Relationships: []
      }
      programme_rooms: {
        Row: {
          capacity: number | null
          id: string
          is_hybrid: boolean
          name: string
          room_no: number
          venue_id: string | null
        }
        Insert: {
          capacity?: number | null
          id?: string
          is_hybrid?: boolean
          name: string
          room_no: number
          venue_id?: string | null
        }
        Update: {
          capacity?: number | null
          id?: string
          is_hybrid?: boolean
          name?: string
          room_no?: number
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_rooms_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      programme_slots: {
        Row: {
          day_id: string
          ends_at: string | null
          id: string
          label: string | null
          slot_no: number
          starts_at: string | null
        }
        Insert: {
          day_id: string
          ends_at?: string | null
          id?: string
          label?: string | null
          slot_no: number
          starts_at?: string | null
        }
        Update: {
          day_id?: string
          ends_at?: string | null
          id?: string
          label?: string | null
          slot_no?: number
          starts_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "programme_slots_day_id_fkey"
            columns: ["day_id"]
            isOneToOne: false
            referencedRelation: "programme_days"
            referencedColumns: ["id"]
          },
        ]
      }
      registrations: {
        Row: {
          batch_id: string | null
          created_at: string
          id: string
          is_placeholder: boolean
          payment_status: string | null
          person_id: string | null
          placeholder_batch: string | null
          raw: Json
          source_row: number | null
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          id?: string
          is_placeholder?: boolean
          payment_status?: string | null
          person_id?: string | null
          placeholder_batch?: string | null
          raw?: Json
          source_row?: number | null
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          id?: string
          is_placeholder?: boolean
          payment_status?: string | null
          person_id?: string | null
          placeholder_batch?: string | null
          raw?: Json
          source_row?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "registrations_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "registrations_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      review_items: {
        Row: {
          batch_id: string | null
          created_at: string
          detail: Json
          id: string
          kind: string
          person_ids: string[]
          resolved_at: string | null
          resolved_by: string | null
          status: string
        }
        Insert: {
          batch_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          kind: string
          person_ids?: string[]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Update: {
          batch_id?: string | null
          created_at?: string
          detail?: Json
          id?: string
          kind?: string
          person_ids?: string[]
          resolved_at?: string | null
          resolved_by?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "review_items_batch_id_fkey"
            columns: ["batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
        ]
      }
      role_claims: {
        Row: {
          created_at: string
          id: string
          note: string | null
          resolved_at: string | null
          resolved_by: string | null
          role: string
          status: string
          submission_code: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          role: string
          status?: string
          submission_code?: string | null
          user_id?: string
        }
        Update: {
          created_at?: string
          id?: string
          note?: string | null
          resolved_at?: string | null
          resolved_by?: string | null
          role?: string
          status?: string
          submission_code?: string | null
          user_id?: string
        }
        Relationships: []
      }
      session_chairs: {
        Row: {
          chair: string | null
          co_chair: string | null
          session_id: string
          updated_at: string
        }
        Insert: {
          chair?: string | null
          co_chair?: string | null
          session_id: string
          updated_at?: string
        }
        Update: {
          chair?: string | null
          co_chair?: string | null
          session_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_chairs_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: true
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          area: string | null
          base_room: string | null
          base_starts_at: string | null
          base_venue_id: string | null
          capacity: number | null
          chair: string | null
          created_at: string
          ends_at: string
          id: string
          import_batch: string | null
          in_everyone_plan: boolean
          is_locked: boolean
          mode: string | null
          moved_at: string | null
          paper_target: number | null
          parallel_track: string | null
          room: string | null
          session_code: string | null
          session_type: string
          slot_code: string | null
          starts_at: string
          status: string
          status_note: string | null
          summary: string | null
          title: string
          track_id: string | null
          updated_at: string
          venue_id: string | null
        }
        Insert: {
          area?: string | null
          base_room?: string | null
          base_starts_at?: string | null
          base_venue_id?: string | null
          capacity?: number | null
          chair?: string | null
          created_at?: string
          ends_at: string
          id?: string
          import_batch?: string | null
          in_everyone_plan?: boolean
          is_locked?: boolean
          mode?: string | null
          moved_at?: string | null
          paper_target?: number | null
          parallel_track?: string | null
          room?: string | null
          session_code?: string | null
          session_type?: string
          slot_code?: string | null
          starts_at: string
          status?: string
          status_note?: string | null
          summary?: string | null
          title: string
          track_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Update: {
          area?: string | null
          base_room?: string | null
          base_starts_at?: string | null
          base_venue_id?: string | null
          capacity?: number | null
          chair?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          import_batch?: string | null
          in_everyone_plan?: boolean
          is_locked?: boolean
          mode?: string | null
          moved_at?: string | null
          paper_target?: number | null
          parallel_track?: string | null
          room?: string | null
          session_code?: string | null
          session_type?: string
          slot_code?: string | null
          starts_at?: string
          status?: string
          status_note?: string | null
          summary?: string | null
          title?: string
          track_id?: string | null
          updated_at?: string
          venue_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sessions_track_id_fkey"
            columns: ["track_id"]
            isOneToOne: false
            referencedRelation: "tracks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sessions_venue_id_fkey"
            columns: ["venue_id"]
            isOneToOne: false
            referencedRelation: "venues"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_decks: {
        Row: {
          file_name: string
          file_path: string
          id: string
          is_placeholder: boolean
          placeholder_batch: string | null
          submission_id: string
          uploaded_at: string
          uploaded_by: string | null
          version: number
        }
        Insert: {
          file_name: string
          file_path: string
          id?: string
          is_placeholder?: boolean
          placeholder_batch?: string | null
          submission_id: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Update: {
          file_name?: string
          file_path?: string
          id?: string
          is_placeholder?: boolean
          placeholder_batch?: string | null
          submission_id?: string
          uploaded_at?: string
          uploaded_by?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "submission_decks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "public_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_decks_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submission_people: {
        Row: {
          affiliation: string | null
          author_order: number | null
          id: string
          is_placeholder: boolean
          is_presenter: boolean
          person_id: string
          placeholder_batch: string | null
          role: string
          submission_id: string
        }
        Insert: {
          affiliation?: string | null
          author_order?: number | null
          id?: string
          is_placeholder?: boolean
          is_presenter?: boolean
          person_id: string
          placeholder_batch?: string | null
          role?: string
          submission_id: string
        }
        Update: {
          affiliation?: string | null
          author_order?: number | null
          id?: string
          is_placeholder?: boolean
          is_presenter?: boolean
          person_id?: string
          placeholder_batch?: string | null
          role?: string
          submission_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "submission_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_people_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "public_papers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_people_submission_id_fkey"
            columns: ["submission_id"]
            isOneToOne: false
            referencedRelation: "submissions"
            referencedColumns: ["id"]
          },
        ]
      }
      submissions: {
        Row: {
          abstract: string | null
          authors: Json
          contact_email: string | null
          contact_name: string | null
          created_at: string
          created_batch_id: string | null
          data_flag: string | null
          id: string
          is_placeholder: boolean
          meeting_url: string | null
          mode_status: string
          payment_status: string | null
          placeholder_batch: string | null
          presentation_mode: string
          presenter_name: string | null
          room_id: string | null
          session_id: string | null
          session_order: number | null
          slot_id: string | null
          submission_code: string
          title: string | null
          track: string | null
          updated_at: string
        }
        Insert: {
          abstract?: string | null
          authors?: Json
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_batch_id?: string | null
          data_flag?: string | null
          id?: string
          is_placeholder?: boolean
          meeting_url?: string | null
          mode_status?: string
          payment_status?: string | null
          placeholder_batch?: string | null
          presentation_mode?: string
          presenter_name?: string | null
          room_id?: string | null
          session_id?: string | null
          session_order?: number | null
          slot_id?: string | null
          submission_code: string
          title?: string | null
          track?: string | null
          updated_at?: string
        }
        Update: {
          abstract?: string | null
          authors?: Json
          contact_email?: string | null
          contact_name?: string | null
          created_at?: string
          created_batch_id?: string | null
          data_flag?: string | null
          id?: string
          is_placeholder?: boolean
          meeting_url?: string | null
          mode_status?: string
          payment_status?: string | null
          placeholder_batch?: string | null
          presentation_mode?: string
          presenter_name?: string | null
          room_id?: string | null
          session_id?: string | null
          session_order?: number | null
          slot_id?: string | null
          submission_code?: string
          title?: string | null
          track?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "submissions_created_batch_id_fkey"
            columns: ["created_batch_id"]
            isOneToOne: false
            referencedRelation: "import_batches"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_room_fk"
            columns: ["room_id"]
            isOneToOne: false
            referencedRelation: "programme_rooms"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submissions_slot_fk"
            columns: ["slot_id"]
            isOneToOne: false
            referencedRelation: "programme_slots"
            referencedColumns: ["id"]
          },
        ]
      }
      sync_papers: {
        Row: {
          code: string
          mode: string | null
          ord: number | null
          sess: string | null
        }
        Insert: {
          code: string
          mode?: string | null
          ord?: number | null
          sess?: string | null
        }
        Update: {
          code?: string
          mode?: string | null
          ord?: number | null
          sess?: string | null
        }
        Relationships: []
      }
      sync_sessions: {
        Row: {
          area: string | null
          chair: string | null
          co: string | null
          code: string
          e: string | null
          mode: string | null
          pt: string | null
          room: string | null
          s: string | null
          slot: string | null
          title: string | null
        }
        Insert: {
          area?: string | null
          chair?: string | null
          co?: string | null
          code: string
          e?: string | null
          mode?: string | null
          pt?: string | null
          room?: string | null
          s?: string | null
          slot?: string | null
          title?: string | null
        }
        Update: {
          area?: string | null
          chair?: string | null
          co?: string | null
          code?: string
          e?: string | null
          mode?: string | null
          pt?: string | null
          room?: string | null
          s?: string | null
          slot?: string | null
          title?: string | null
        }
        Relationships: []
      }
      tourism_places: {
        Row: {
          area: string
          closed: boolean
          closes: string
          drive_min: number
          effort: string
          entry_fee: number
          id: string
          is_placeholder: boolean
          last_verified: string | null
          lat: number | null
          lng: number | null
          low_signal: boolean
          name: string
          no_atm: boolean
          notes: string | null
          opens: string
          placeholder_batch: string | null
          region: string | null
          sort_order: number
          step_free: boolean
          summary: string | null
          tags: string[]
          updated_at: string
          visit_min: number
        }
        Insert: {
          area: string
          closed?: boolean
          closes?: string
          drive_min?: number
          effort?: string
          entry_fee?: number
          id?: string
          is_placeholder?: boolean
          last_verified?: string | null
          lat?: number | null
          lng?: number | null
          low_signal?: boolean
          name: string
          no_atm?: boolean
          notes?: string | null
          opens?: string
          placeholder_batch?: string | null
          region?: string | null
          sort_order?: number
          step_free?: boolean
          summary?: string | null
          tags?: string[]
          updated_at?: string
          visit_min?: number
        }
        Update: {
          area?: string
          closed?: boolean
          closes?: string
          drive_min?: number
          effort?: string
          entry_fee?: number
          id?: string
          is_placeholder?: boolean
          last_verified?: string | null
          lat?: number | null
          lng?: number | null
          low_signal?: boolean
          name?: string
          no_atm?: boolean
          notes?: string | null
          opens?: string
          placeholder_batch?: string | null
          region?: string | null
          sort_order?: number
          step_free?: boolean
          summary?: string | null
          tags?: string[]
          updated_at?: string
          visit_min?: number
        }
        Relationships: []
      }
      tracks: {
        Row: {
          accent: string
          description: string | null
          id: string
          name: string
          sort_order: number
        }
        Insert: {
          accent?: string
          description?: string | null
          id?: string
          name: string
          sort_order?: number
        }
        Update: {
          accent?: string
          description?: string | null
          id?: string
          name?: string
          sort_order?: number
        }
        Relationships: []
      }
      travel_legs: {
        Row: {
          duration_min: number
          fare_max: number
          fare_min: number
          frequency: string | null
          from_place: string
          id: string
          is_placeholder: boolean
          kind: string
          last_verified: string | null
          mode: string
          notes: string | null
          placeholder_batch: string | null
          sort_order: number
          to_place: string
          updated_at: string
        }
        Insert: {
          duration_min: number
          fare_max: number
          fare_min: number
          frequency?: string | null
          from_place: string
          id?: string
          is_placeholder?: boolean
          kind: string
          last_verified?: string | null
          mode: string
          notes?: string | null
          placeholder_batch?: string | null
          sort_order?: number
          to_place: string
          updated_at?: string
        }
        Update: {
          duration_min?: number
          fare_max?: number
          fare_min?: number
          frequency?: string | null
          from_place?: string
          id?: string
          is_placeholder?: boolean
          kind?: string
          last_verified?: string | null
          mode?: string
          notes?: string | null
          placeholder_batch?: string | null
          sort_order?: number
          to_place?: string
          updated_at?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      venues: {
        Row: {
          created_at: string
          description: string | null
          id: string
          kind: string
          lat: number | null
          lng: number | null
          name: string
          short_name: string | null
          sort_order: number
          updated_at: string
          walk_minutes: number | null
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name: string
          short_name?: string | null
          sort_order?: number
          updated_at?: string
          walk_minutes?: number | null
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          kind?: string
          lat?: number | null
          lng?: number | null
          name?: string
          short_name?: string | null
          sort_order?: number
          updated_at?: string
          walk_minutes?: number | null
        }
        Relationships: []
      }
      whatsapp_broadcasts: {
        Row: {
          accepted: number
          audience: Json
          created_at: string
          created_by: string | null
          failed: number
          id: string
          language: string
          params: Json
          template_name: string
          total: number
        }
        Insert: {
          accepted?: number
          audience?: Json
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          language?: string
          params?: Json
          template_name: string
          total?: number
        }
        Update: {
          accepted?: number
          audience?: Json
          created_at?: string
          created_by?: string | null
          failed?: number
          id?: string
          language?: string
          params?: Json
          template_name?: string
          total?: number
        }
        Relationships: []
      }
      whatsapp_messages: {
        Row: {
          body: string | null
          broadcast_id: string | null
          created_at: string
          delivered_at: string | null
          direction: string
          error: Json | null
          failed_at: string | null
          id: string
          kind: string
          media_id: string | null
          person_id: string | null
          provider_ts: string | null
          read_at: string | null
          sent_at: string | null
          sent_by: string | null
          status: string
          template_name: string | null
          wa_id: string
          wamid: string | null
        }
        Insert: {
          body?: string | null
          broadcast_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction: string
          error?: Json | null
          failed_at?: string | null
          id?: string
          kind?: string
          media_id?: string | null
          person_id?: string | null
          provider_ts?: string | null
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string | null
          wa_id: string
          wamid?: string | null
        }
        Update: {
          body?: string | null
          broadcast_id?: string | null
          created_at?: string
          delivered_at?: string | null
          direction?: string
          error?: Json | null
          failed_at?: string | null
          id?: string
          kind?: string
          media_id?: string | null
          person_id?: string | null
          provider_ts?: string | null
          read_at?: string | null
          sent_at?: string | null
          sent_by?: string | null
          status?: string
          template_name?: string | null
          wa_id?: string
          wamid?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "whatsapp_messages_broadcast_id_fkey"
            columns: ["broadcast_id"]
            isOneToOne: false
            referencedRelation: "whatsapp_broadcasts"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "whatsapp_messages_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
      whatsapp_webhook_events: {
        Row: {
          attempts: number
          delivery_id: string
          event: string
          id: string
          payload: Json
          processed_at: string | null
          processing_error: string | null
          received_at: string
        }
        Insert: {
          attempts?: number
          delivery_id: string
          event: string
          id?: string
          payload: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Update: {
          attempts?: number
          delivery_id?: string
          event?: string
          id?: string
          payload?: Json
          processed_at?: string | null
          processing_error?: string | null
          received_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      people_directory: {
        Row: {
          category: string | null
          claimed: boolean | null
          delegate_code: string | null
          full_name: string | null
          id: string | null
          is_placeholder: boolean | null
          organization: string | null
        }
        Insert: {
          category?: string | null
          claimed?: never
          delegate_code?: string | null
          full_name?: string | null
          id?: string | null
          is_placeholder?: boolean | null
          organization?: string | null
        }
        Update: {
          category?: string | null
          claimed?: never
          delegate_code?: string | null
          full_name?: string | null
          id?: string | null
          is_placeholder?: boolean | null
          organization?: string | null
        }
        Relationships: []
      }
      public_papers: {
        Row: {
          authors: Json | null
          id: string | null
          presentation_mode: string | null
          presenter_name: string | null
          session_id: string | null
          session_order: number | null
          submission_code: string | null
          title: string | null
        }
        Insert: {
          authors?: never
          id?: string | null
          presentation_mode?: string | null
          presenter_name?: string | null
          session_id?: string | null
          session_order?: number | null
          submission_code?: string | null
          title?: string | null
        }
        Update: {
          authors?: never
          id?: string | null
          presentation_mode?: string | null
          presenter_name?: string | null
          session_id?: string | null
          session_order?: number | null
          submission_code?: string | null
          title?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submissions_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      v_person_papers: {
        Row: {
          is_presenter: boolean | null
          person_id: string | null
          presentation_mode: string | null
        }
        Relationships: [
          {
            foreignKeyName: "submission_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "submission_people_person_id_fkey"
            columns: ["person_id"]
            isOneToOne: false
            referencedRelation: "people_directory"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      add_connection: {
        Args: { _code: string; _source?: string }
        Returns: string
      }
      apply_slotter_moves: { Args: { _moves: Json }; Returns: Json }
      card_is_team: { Args: { _person: string }; Returns: boolean }
      card_status: { Args: { _code: string }; Returns: Json }
      check_in_person: {
        Args: { _method?: string; _person_id: string }
        Returns: Json
      }
      checkin_lookup: {
        Args: { _q: string }
        Returns: {
          category: string
          check_in_id: string
          checked_in_at: string
          checked_in_by: string
          claimed: boolean
          delegate_code: string
          full_name: string
          organization: string
          papers: string[]
          person_id: string
          roles: string[]
        }[]
      }
      claim_my_person: { Args: never; Returns: string }
      clear_guide_placeholders: { Args: never; Returns: undefined }
      clear_placeholders: { Args: never; Returns: undefined }
      close_my_help: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      complete_onboarding: {
        Args: {
          _calls: boolean
          _networking: boolean
          _phone: string
          _photo: boolean
          _whatsapp: boolean
        }
        Returns: undefined
      }
      confirm_my_details: {
        Args: { _alt_email?: string; _phone?: string }
        Returns: string
      }
      console_team: {
        Args: never
        Returns: {
          email: string
          full_name: string
          roles: string[]
          user_id: string
        }[]
      }
      contact_card: { Args: { _code: string }; Returns: Json }
      data_completeness: { Args: never; Returns: Json }
      decide_alert_request: {
        Args: {
          _approve: boolean
          _body: string
          _id: string
          _note: string
          _title: string
        }
        Returns: Json
      }
      decide_detail_change: {
        Args: {
          _approve: boolean
          _id: string
          _name?: string
          _note: string
          _org?: string
        }
        Returns: undefined
      }
      deck_drive: {
        Args: never
        Returns: {
          deck_id: string
          file_name: string
          file_path: string
          presenter_name: string
          session_title: string
          starts_at: string
          submission_code: string
          submission_id: string
          title: string
          track: string
          uploaded_at: string
          venue: string
          version: number
        }[]
      }
      delete_paper: { Args: { _submission: string }; Returns: Json }
      detail_queue: {
        Args: never
        Returns: {
          alt_email: string
          author_index: number
          authors: Json
          code: string
          created_at: string
          decided_at: string
          decision_note: string
          email: string
          full_name: string
          id: string
          kind: string
          note: string
          organization: string
          presenter_name: string
          proposed_email: string
          proposed_name: string
          proposed_org: string
          status: string
          submission_code: string
          title: string
        }[]
      }
      directory_people: {
        Args: never
        Returns: {
          bio: string
          code: string
          email: string
          full_name: string
          is_placeholder: boolean
          keywords: string[]
          linkedin_url: string
          organization: string
          papers: Json
          roles: string[]
        }[]
      }
      gen_delegate_code: { Args: never; Returns: string }
      has_any_role: {
        Args: { _roles: string[]; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      help_queue: {
        Args: never
        Returns: {
          assigned_to: string
          category: string
          contact: string
          created_at: string
          id: string
          location: string
          message: string
          name: string
          person: Json
          resolution_note: string
          resolved_at: string
          status: string
          updated_at: string
          urgent: boolean
          user_id: string
        }[]
      }
      is_organizer: { Args: { _user_id: string }; Returns: boolean }
      merge_people: {
        Args: { _drop: string; _keep: string }
        Returns: undefined
      }
      my_connections: {
        Args: never
        Returns: {
          code: string
          created_at: string
          email: string
          full_name: string
          id: string
          linkedin_url: string
          note: string
          organization: string
          source: string
        }[]
      }
      my_paper_authors: {
        Args: never
        Returns: {
          authors: Json
          my_order: number
          presenter_name: string
          presenters: string[]
          submission_code: string
          submission_id: string
          title: string
        }[]
      }
      my_waves: {
        Args: never
        Returns: {
          code: string
          created_at: string
          direction: string
        }[]
      }
      norm_person_name: { Args: { _n: string }; Returns: string }
      paper_author_links: {
        Args: never
        Returns: {
          code: string
          full_name: string
          is_presenter: boolean
          submission_id: string
        }[]
      }
      person_id_for_code: { Args: { _code: string }; Returns: string }
      public_profile: { Args: { _code: string }; Returns: Json }
      record_handshake: {
        Args: { _code: string; _medium?: string }
        Returns: Json
      }
      refresh_attendance_modes: { Args: never; Returns: undefined }
      reopen_my_help: {
        Args: { _id: string; _note: string }
        Returns: undefined
      }
      request_affiliation_change: {
        Args: { _note?: string; _org: string }
        Returns: string
      }
      request_detail_change: {
        Args: {
          _author_index: number
          _email: string
          _kind: string
          _name: string
          _note: string
          _submission: string
        }
        Returns: string
      }
      resolve_role_claim: {
        Args: { _approve: boolean; _claim: string }
        Returns: undefined
      }
      rollback_import: { Args: { _batch: string }; Returns: undefined }
      save_paper_authors: {
        Args: {
          _authors: Json
          _extra: Json
          _submission: string
          _title: string
          _track: string
        }
        Returns: undefined
      }
      seed_placeholder_cohort: { Args: { _batch?: string }; Returns: number }
      send_wave: { Args: { _code: string }; Returns: Json }
      set_contact_card_share: { Args: { _on: boolean }; Returns: undefined }
      set_my_directory: {
        Args: { _linkedin?: string; _on: boolean }
        Returns: undefined
      }
      set_my_profile: {
        Args: { _bio: string; _keywords: string[] }
        Returns: undefined
      }
      set_my_profile_links: { Args: { _links: Json }; Returns: undefined }
      set_presentation_mode: {
        Args: { _mode: string; _submission: string }
        Returns: undefined
      }
      set_presenting: {
        Args: { _name: string; _on: boolean; _submission: string }
        Returns: string
      }
      set_user_roles: {
        Args: { _email: string; _roles: string[] }
        Returns: Json
      }
      start_visitor_pass: {
        Args: { _name: string; _org: string }
        Returns: string
      }
      unmatched_signins: {
        Args: never
        Returns: {
          created_at: string
          email: string
          user_id: string
        }[]
      }
      void_check_in: { Args: { _id: string }; Returns: undefined }
      withdraw_detail_change: { Args: { _id: string }; Returns: undefined }
    }
    Enums: {
      app_role:
        | "admin"
        | "editor"
        | "volunteer"
        | "desk_volunteer"
        | "room_volunteer"
        | "help_volunteer"
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
      app_role: [
        "admin",
        "editor",
        "volunteer",
        "desk_volunteer",
        "room_volunteer",
        "help_volunteer",
      ],
    },
  },
} as const
