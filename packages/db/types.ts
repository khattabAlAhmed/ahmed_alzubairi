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
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      audit_log: {
        Row: {
          action: string
          actor_id: string | null
          created_at: string
          entity: string
          entity_id: string | null
          id: string
          metadata: Json
        }
        Insert: {
          action: string
          actor_id?: string | null
          created_at?: string
          entity: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Update: {
          action?: string
          actor_id?: string | null
          created_at?: string
          entity?: string
          entity_id?: string | null
          id?: string
          metadata?: Json
        }
        Relationships: [
          {
            foreignKeyName: "audit_log_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
        ]
      }
      consultation_attachments: {
        Row: {
          consultation_id: string
          created_at: string
          file_name: string
          id: string
          message_id: string | null
          mime: string
          size_bytes: number
          status: string
          storage_key: string
          uploaded_by: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          file_name: string
          id?: string
          message_id?: string | null
          mime: string
          size_bytes: number
          status?: string
          storage_key: string
          uploaded_by: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          file_name?: string
          id?: string
          message_id?: string | null
          mime?: string
          size_bytes?: number
          status?: string
          storage_key?: string
          uploaded_by?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_attachments_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_attachments_message_id_fkey"
            columns: ["message_id"]
            isOneToOne: false
            referencedRelation: "consultation_messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_attachments_uploaded_by_fkey"
            columns: ["uploaded_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
        ]
      }
      consultation_messages: {
        Row: {
          body: string | null
          consultation_id: string
          created_at: string
          id: string
          sender_id: string
        }
        Insert: {
          body?: string | null
          consultation_id: string
          created_at?: string
          id?: string
          sender_id: string
        }
        Update: {
          body?: string | null
          consultation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
        ]
      }
      consultations: {
        Row: {
          assigned_to: string | null
          client_id: string
          closed_at: string | null
          created_at: string
          description: string
          first_reply_at: string | null
          id: string
          kind: string
          organization: string | null
          service_id: string | null
          status: string
          title: string
        }
        Insert: {
          assigned_to?: string | null
          client_id: string
          closed_at?: string | null
          created_at?: string
          description: string
          first_reply_at?: string | null
          id?: string
          kind?: string
          organization?: string | null
          service_id?: string | null
          status?: string
          title: string
        }
        Update: {
          assigned_to?: string | null
          client_id?: string
          closed_at?: string | null
          created_at?: string
          description?: string
          first_reply_at?: string | null
          id?: string
          kind?: string
          organization?: string | null
          service_id?: string | null
          status?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultations_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
          {
            foreignKeyName: "consultations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
          {
            foreignKeyName: "consultations_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      contact_messages: {
        Row: {
          created_at: string
          email: string
          id: string
          message: string
          name: string
          org_type: string
          read_at: string | null
          subject: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          message: string
          name: string
          org_type: string
          read_at?: string | null
          subject: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          message?: string
          name?: string
          org_type?: string
          read_at?: string | null
          subject?: string
        }
        Relationships: []
      }
      course_registrations: {
        Row: {
          client_id: string
          course_id: string
          created_at: string
          id: string
        }
        Insert: {
          client_id: string
          course_id: string
          created_at?: string
          id?: string
        }
        Update: {
          client_id?: string
          course_id?: string
          created_at?: string
          id?: string
        }
        Relationships: [
          {
            foreignKeyName: "course_registrations_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
          {
            foreignKeyName: "course_registrations_course_id_fkey"
            columns: ["course_id"]
            isOneToOne: false
            referencedRelation: "courses"
            referencedColumns: ["id"]
          },
        ]
      }
      courses: {
        Row: {
          audience_ar: string | null
          audience_en: string | null
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          online_url: string | null
          place_ar: string | null
          place_en: string | null
          seats: number | null
          slug: string
          starts_at: string | null
          status: string
          title_ar: string | null
          title_en: string | null
          type: string
          updated_at: string
        }
        Insert: {
          audience_ar?: string | null
          audience_en?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          online_url?: string | null
          place_ar?: string | null
          place_en?: string | null
          seats?: number | null
          slug: string
          starts_at?: string | null
          status?: string
          title_ar?: string | null
          title_en?: string | null
          type: string
          updated_at?: string
        }
        Update: {
          audience_ar?: string | null
          audience_en?: string | null
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          online_url?: string | null
          place_ar?: string | null
          place_en?: string | null
          seats?: number | null
          slug?: string
          starts_at?: string | null
          status?: string
          title_ar?: string | null
          title_en?: string | null
          type?: string
          updated_at?: string
        }
        Relationships: []
      }
      custom_training_requests: {
        Row: {
          client_id: string | null
          contact_email: string
          created_at: string
          id: string
          org_name: string
          place: string | null
          suggested_date: string
          topic: string
          trainee_count: number
        }
        Insert: {
          client_id?: string | null
          contact_email: string
          created_at?: string
          id?: string
          org_name: string
          place?: string | null
          suggested_date: string
          topic: string
          trainee_count: number
        }
        Update: {
          client_id?: string | null
          contact_email?: string
          created_at?: string
          id?: string
          org_name?: string
          place?: string | null
          suggested_date?: string
          topic?: string
          trainee_count?: number
        }
        Relationships: [
          {
            foreignKeyName: "custom_training_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
        ]
      }
      document_access_log: {
        Row: {
          action: string
          client_id: string
          created_at: string
          document_id: string
          id: string
          request_id: string
        }
        Insert: {
          action: string
          client_id: string
          created_at?: string
          document_id: string
          id?: string
          request_id: string
        }
        Update: {
          action?: string
          client_id?: string
          created_at?: string
          document_id?: string
          id?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_access_log_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
        ]
      }
      document_recommendations: {
        Row: {
          created_at: string
          id: string
          member_id: string
          note: string | null
          recommendation: string
          request_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          member_id: string
          note?: string | null
          recommendation: string
          request_id: string
        }
        Update: {
          created_at?: string
          id?: string
          member_id?: string
          note?: string | null
          recommendation?: string
          request_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_recommendations_member_id_fkey"
            columns: ["member_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
          {
            foreignKeyName: "document_recommendations_request_id_fkey"
            columns: ["request_id"]
            isOneToOne: false
            referencedRelation: "document_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      document_requests: {
        Row: {
          client_id: string
          consultation_id: string | null
          created_at: string
          decided_by: string | null
          document_id: string
          expires_at: string | null
          granted_at: string | null
          id: string
          purpose: string
          revoked_at: string | null
          status: string
        }
        Insert: {
          client_id: string
          consultation_id?: string | null
          created_at?: string
          decided_by?: string | null
          document_id: string
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          purpose: string
          revoked_at?: string | null
          status?: string
        }
        Update: {
          client_id?: string
          consultation_id?: string | null
          created_at?: string
          decided_by?: string | null
          document_id?: string
          expires_at?: string | null
          granted_at?: string | null
          id?: string
          purpose?: string
          revoked_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "document_requests_client_id_fkey"
            columns: ["client_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
          {
            foreignKeyName: "document_requests_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "document_requests_decided_by_fkey"
            columns: ["decided_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
          {
            foreignKeyName: "document_requests_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "documents"
            referencedColumns: ["id"]
          },
        ]
      }
      documents: {
        Row: {
          access_mode: string
          category: string
          id: string
          mime: string
          status: string
          storage_key: string
          title_ar: string
          title_en: string
        }
        Insert: {
          access_mode: string
          category: string
          id?: string
          mime: string
          status?: string
          storage_key: string
          title_ar: string
          title_en: string
        }
        Update: {
          access_mode?: string
          category?: string
          id?: string
          mime?: string
          status?: string
          storage_key?: string
          title_ar?: string
          title_en?: string
        }
        Relationships: []
      }
      email_outbox: {
        Row: {
          attempts: number
          created_at: string
          event: string
          id: string
          last_error: string | null
          locale: string
          payload: Json
          sent_at: string | null
          status: string
          to_email: string
        }
        Insert: {
          attempts?: number
          created_at?: string
          event: string
          id?: string
          last_error?: string | null
          locale: string
          payload?: Json
          sent_at?: string | null
          status?: string
          to_email: string
        }
        Update: {
          attempts?: number
          created_at?: string
          event?: string
          id?: string
          last_error?: string | null
          locale?: string
          payload?: Json
          sent_at?: string | null
          status?: string
          to_email?: string
        }
        Relationships: []
      }
      email_templates: {
        Row: {
          body_ar: string
          body_en: string
          event: string
          subject_ar: string
          subject_en: string
        }
        Insert: {
          body_ar: string
          body_en: string
          event: string
          subject_ar: string
          subject_en: string
        }
        Update: {
          body_ar?: string
          body_en?: string
          event?: string
          subject_ar?: string
          subject_en?: string
        }
        Relationships: []
      }
      expertise_areas: {
        Row: {
          body_ar: Json | null
          body_en: Json | null
          created_at: string
          id: string
          position: number
          slug: string
          status: string
          summary_ar: string | null
          summary_en: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          body_ar?: Json | null
          body_en?: Json | null
          created_at?: string
          id?: string
          position?: number
          slug: string
          status?: string
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          body_ar?: Json | null
          body_en?: Json | null
          created_at?: string
          id?: string
          position?: number
          slug?: string
          status?: string
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      faqs: {
        Row: {
          answer_ar: string | null
          answer_en: string | null
          category: string
          created_at: string
          id: string
          position: number
          question_ar: string | null
          question_en: string | null
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          answer_ar?: string | null
          answer_en?: string | null
          category: string
          created_at?: string
          id?: string
          position?: number
          question_ar?: string | null
          question_en?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          answer_ar?: string | null
          answer_en?: string | null
          category?: string
          created_at?: string
          id?: string
          position?: number
          question_ar?: string | null
          question_en?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "faqs_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      home_sections: {
        Row: {
          content_ar: Json | null
          content_en: Json | null
          created_at: string
          is_visible: boolean
          key: string
          position: number
          status: string
          updated_at: string
        }
        Insert: {
          content_ar?: Json | null
          content_en?: Json | null
          created_at?: string
          is_visible?: boolean
          key: string
          position?: number
          status?: string
          updated_at?: string
        }
        Update: {
          content_ar?: Json | null
          content_en?: Json | null
          created_at?: string
          is_visible?: boolean
          key?: string
          position?: number
          status?: string
          updated_at?: string
        }
        Relationships: []
      }
      home_stats: {
        Row: {
          created_at: string
          id: string
          label_ar: string | null
          label_en: string | null
          position: number
          status: string
          updated_at: string
          value: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          label_ar?: string | null
          label_en?: string | null
          position?: number
          status?: string
          updated_at?: string
          value?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          label_ar?: string | null
          label_en?: string | null
          position?: number
          status?: string
          updated_at?: string
          value?: string | null
        }
        Relationships: []
      }
      media_items: {
        Row: {
          category: string
          created_at: string
          date: string | null
          id: string
          image_path: string | null
          outlet_ar: string | null
          outlet_en: string | null
          status: string
          title_ar: string | null
          title_en: string | null
          updated_at: string
          url: string | null
          video_url: string | null
        }
        Insert: {
          category: string
          created_at?: string
          date?: string | null
          id?: string
          image_path?: string | null
          outlet_ar?: string | null
          outlet_en?: string | null
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          url?: string | null
          video_url?: string | null
        }
        Update: {
          category?: string
          created_at?: string
          date?: string | null
          id?: string
          image_path?: string | null
          outlet_ar?: string | null
          outlet_en?: string | null
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
          url?: string | null
          video_url?: string | null
        }
        Relationships: []
      }
      meetings: {
        Row: {
          consultation_id: string
          created_at: string
          duration_minutes: number
          id: string
          platform: string
          reminder_sent_at: string | null
          starts_at: string
          url: string
        }
        Insert: {
          consultation_id: string
          created_at?: string
          duration_minutes: number
          id?: string
          platform: string
          reminder_sent_at?: string | null
          starts_at: string
          url: string
        }
        Update: {
          consultation_id?: string
          created_at?: string
          duration_minutes?: number
          id?: string
          platform?: string
          reminder_sent_at?: string | null
          starts_at?: string
          url?: string
        }
        Relationships: [
          {
            foreignKeyName: "meetings_consultation_id_fkey"
            columns: ["consultation_id"]
            isOneToOne: false
            referencedRelation: "consultations"
            referencedColumns: ["id"]
          },
        ]
      }
      newsletter_subscribers: {
        Row: {
          confirm_token_hash: string | null
          consented_at: string | null
          created_at: string
          email: string
          id: string
          locale: string
          source: string
          status: string
        }
        Insert: {
          confirm_token_hash?: string | null
          consented_at?: string | null
          created_at?: string
          email: string
          id?: string
          locale: string
          source: string
          status?: string
        }
        Update: {
          confirm_token_hash?: string | null
          consented_at?: string | null
          created_at?: string
          email?: string
          id?: string
          locale?: string
          source?: string
          status?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          entity: string | null
          entity_id: string | null
          id: string
          read_at: string | null
          type: string
          user_id: string
        }
        Insert: {
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          read_at?: string | null
          type: string
          user_id: string
        }
        Update: {
          created_at?: string
          entity?: string | null
          entity_id?: string | null
          id?: string
          read_at?: string | null
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
        ]
      }
      pages: {
        Row: {
          body_ar: Json | null
          body_en: Json | null
          created_at: string
          id: string
          key: string
          status: string
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          body_ar?: Json | null
          body_en?: Json | null
          created_at?: string
          id?: string
          key: string
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          body_ar?: Json | null
          body_en?: Json | null
          created_at?: string
          id?: string
          key?: string
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      partners: {
        Row: {
          admin_approved: boolean
          approved_by: string | null
          consent_confirmed: boolean
          created_at: string
          id: string
          logo_path: string | null
          name_ar: string | null
          name_en: string | null
          position: number
          status: string
          updated_at: string
        }
        Insert: {
          admin_approved?: boolean
          approved_by?: string | null
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          logo_path?: string | null
          name_ar?: string | null
          name_en?: string | null
          position?: number
          status?: string
          updated_at?: string
        }
        Update: {
          admin_approved?: boolean
          approved_by?: string | null
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          logo_path?: string | null
          name_ar?: string | null
          name_en?: string | null
          position?: number
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "partners_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
        ]
      }
      posts: {
        Row: {
          body_ar: Json | null
          body_en: Json | null
          cover_path: string | null
          created_at: string
          excerpt_ar: string | null
          excerpt_en: string | null
          expertise_id: string | null
          id: string
          published_at: string | null
          reading_minutes_ar: number | null
          reading_minutes_en: number | null
          slug_ar: string | null
          slug_en: string | null
          status: string
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          body_ar?: Json | null
          body_en?: Json | null
          cover_path?: string | null
          created_at?: string
          excerpt_ar?: string | null
          excerpt_en?: string | null
          expertise_id?: string | null
          id?: string
          published_at?: string | null
          reading_minutes_ar?: number | null
          reading_minutes_en?: number | null
          slug_ar?: string | null
          slug_en?: string | null
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          body_ar?: Json | null
          body_en?: Json | null
          cover_path?: string | null
          created_at?: string
          excerpt_ar?: string | null
          excerpt_en?: string | null
          expertise_id?: string | null
          id?: string
          published_at?: string | null
          reading_minutes_ar?: number | null
          reading_minutes_en?: number | null
          slug_ar?: string | null
          slug_en?: string | null
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "posts_expertise_id_fkey"
            columns: ["expertise_id"]
            isOneToOne: false
            referencedRelation: "expertise_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          clerk_user_id: string
          created_at: string
          email: string
          full_name: string
          job_title: string | null
          locale: string
          notify_optional: boolean
          org_name: string | null
          org_type: string | null
          phone: string
          role_id: string | null
          status: string
          terms_accepted_at: string
          timezone: string
        }
        Insert: {
          clerk_user_id: string
          created_at?: string
          email: string
          full_name: string
          job_title?: string | null
          locale?: string
          notify_optional?: boolean
          org_name?: string | null
          org_type?: string | null
          phone: string
          role_id?: string | null
          status?: string
          terms_accepted_at: string
          timezone: string
        }
        Update: {
          clerk_user_id?: string
          created_at?: string
          email?: string
          full_name?: string
          job_title?: string | null
          locale?: string
          notify_optional?: boolean
          org_name?: string | null
          org_type?: string | null
          phone?: string
          role_id?: string | null
          status?: string
          terms_accepted_at?: string
          timezone?: string
        }
        Relationships: [
          {
            foreignKeyName: "profiles_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      project_images: {
        Row: {
          alt_ar: string | null
          alt_en: string | null
          created_at: string
          id: string
          path: string
          position: number
          project_id: string
          updated_at: string
        }
        Insert: {
          alt_ar?: string | null
          alt_en?: string | null
          created_at?: string
          id?: string
          path: string
          position?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          alt_ar?: string | null
          alt_en?: string | null
          created_at?: string
          id?: string
          path?: string
          position?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_images_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_services: {
        Row: {
          project_id: string
          service_id: string
        }
        Insert: {
          project_id: string
          service_id: string
        }
        Update: {
          project_id?: string
          service_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_services_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          activities_ar: string | null
          activities_en: string | null
          created_at: string
          duration_ar: string | null
          duration_en: string | null
          expertise_id: string | null
          goal_ar: string | null
          goal_en: string | null
          hide_org_name: boolean
          id: string
          is_featured: boolean
          key_result_ar: string | null
          key_result_en: string | null
          org_label_ar: string | null
          org_label_en: string | null
          org_name_ar: string | null
          org_name_en: string | null
          org_type: string | null
          results_ar: string | null
          results_en: string | null
          role_ar: string | null
          role_en: string | null
          slug: string
          status: string
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          activities_ar?: string | null
          activities_en?: string | null
          created_at?: string
          duration_ar?: string | null
          duration_en?: string | null
          expertise_id?: string | null
          goal_ar?: string | null
          goal_en?: string | null
          hide_org_name?: boolean
          id?: string
          is_featured?: boolean
          key_result_ar?: string | null
          key_result_en?: string | null
          org_label_ar?: string | null
          org_label_en?: string | null
          org_name_ar?: string | null
          org_name_en?: string | null
          org_type?: string | null
          results_ar?: string | null
          results_en?: string | null
          role_ar?: string | null
          role_en?: string | null
          slug: string
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          activities_ar?: string | null
          activities_en?: string | null
          created_at?: string
          duration_ar?: string | null
          duration_en?: string | null
          expertise_id?: string | null
          goal_ar?: string | null
          goal_en?: string | null
          hide_org_name?: boolean
          id?: string
          is_featured?: boolean
          key_result_ar?: string | null
          key_result_en?: string | null
          org_label_ar?: string | null
          org_label_en?: string | null
          org_name_ar?: string | null
          org_name_en?: string | null
          org_type?: string | null
          results_ar?: string | null
          results_en?: string | null
          role_ar?: string | null
          role_en?: string | null
          slug?: string
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_expertise_id_fkey"
            columns: ["expertise_id"]
            isOneToOne: false
            referencedRelation: "expertise_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          access: string
          created_at: string
          description_ar: string | null
          description_en: string | null
          expertise_id: string | null
          id: string
          kind: string
          status: string
          storage_key: string
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          access: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          expertise_id?: string | null
          id?: string
          kind: string
          status?: string
          storage_key: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          access?: string
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          expertise_id?: string | null
          id?: string
          kind?: string
          status?: string
          storage_key?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "resources_expertise_id_fkey"
            columns: ["expertise_id"]
            isOneToOne: false
            referencedRelation: "expertise_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      role_permissions: {
        Row: {
          permission: string
          role_id: string
        }
        Insert: {
          permission: string
          role_id: string
        }
        Update: {
          permission?: string
          role_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "role_permissions_role_id_fkey"
            columns: ["role_id"]
            isOneToOne: false
            referencedRelation: "roles"
            referencedColumns: ["id"]
          },
        ]
      }
      roles: {
        Row: {
          id: string
          is_system: boolean
          key: string
          name_ar: string
          name_en: string
        }
        Insert: {
          id?: string
          is_system?: boolean
          key: string
          name_ar: string
          name_en: string
        }
        Update: {
          id?: string
          is_system?: boolean
          key?: string
          name_ar?: string
          name_en?: string
        }
        Relationships: []
      }
      services: {
        Row: {
          audience_ar: string | null
          audience_en: string | null
          created_at: string
          deliverables_ar: string | null
          deliverables_en: string | null
          expertise_id: string | null
          id: string
          is_featured: boolean
          position: number
          slug: string
          stages_ar: string | null
          stages_en: string | null
          status: string
          summary_ar: string | null
          summary_en: string | null
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          audience_ar?: string | null
          audience_en?: string | null
          created_at?: string
          deliverables_ar?: string | null
          deliverables_en?: string | null
          expertise_id?: string | null
          id?: string
          is_featured?: boolean
          position?: number
          slug: string
          stages_ar?: string | null
          stages_en?: string | null
          status?: string
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          audience_ar?: string | null
          audience_en?: string | null
          created_at?: string
          deliverables_ar?: string | null
          deliverables_en?: string | null
          expertise_id?: string | null
          id?: string
          is_featured?: boolean
          position?: number
          slug?: string
          stages_ar?: string | null
          stages_en?: string | null
          status?: string
          summary_ar?: string | null
          summary_en?: string | null
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_expertise_id_fkey"
            columns: ["expertise_id"]
            isOneToOne: false
            referencedRelation: "expertise_areas"
            referencedColumns: ["id"]
          },
        ]
      }
      site_settings: {
        Row: {
          created_at: string
          key: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          key: string
          updated_at?: string
          value: Json
        }
        Update: {
          created_at?: string
          key?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      testimonials: {
        Row: {
          admin_approved: boolean
          approved_by: string | null
          author_ar: string | null
          author_en: string | null
          consent_confirmed: boolean
          created_at: string
          id: string
          letter_path: string | null
          partner_id: string | null
          position: number
          quote_ar: string | null
          quote_en: string | null
          status: string
          updated_at: string
        }
        Insert: {
          admin_approved?: boolean
          approved_by?: string | null
          author_ar?: string | null
          author_en?: string | null
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          letter_path?: string | null
          partner_id?: string | null
          position?: number
          quote_ar?: string | null
          quote_en?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          admin_approved?: boolean
          approved_by?: string | null
          author_ar?: string | null
          author_en?: string | null
          consent_confirmed?: boolean
          created_at?: string
          id?: string
          letter_path?: string | null
          partner_id?: string | null
          position?: number
          quote_ar?: string | null
          quote_en?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "testimonials_approved_by_fkey"
            columns: ["approved_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["clerk_user_id"]
          },
          {
            foreignKeyName: "testimonials_partner_id_fkey"
            columns: ["partner_id"]
            isOneToOne: false
            referencedRelation: "partners"
            referencedColumns: ["id"]
          },
        ]
      }
      timeline_items: {
        Row: {
          created_at: string
          description_ar: string | null
          description_en: string | null
          id: string
          kind: string
          period: string | null
          position: number
          status: string
          title_ar: string | null
          title_en: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          kind: string
          period?: string | null
          position?: number
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          description_ar?: string | null
          description_en?: string | null
          id?: string
          kind?: string
          period?: string | null
          position?: number
          status?: string
          title_ar?: string | null
          title_en?: string | null
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      disable_client: { Args: { client_id: string }; Returns: number }
      has_permission: { Args: { key: string }; Returns: boolean }
      scoped_client_ids: { Args: never; Returns: string[] }
      visible_consultation_ids: { Args: never; Returns: string[] }
    }
    Enums: {
      [_ in never]: never
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
    Enums: {},
  },
} as const
