export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      admin_users: {
        Row: {
          granted_at: string
          note: string | null
          user_id: string
        }
        Insert: {
          granted_at?: string
          note?: string | null
          user_id: string
        }
        Update: {
          granted_at?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "matched_contacts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "admin_users_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      app_settings: {
        Row: {
          company_addr: string
          company_email_domains: string[]
          company_lat: number
          company_lng: number
          company_name: string
          id: number
          match_default_tolerance_min: number
          match_radius_m: number
          require_company_email: boolean
          updated_at: string
        }
        Insert: {
          company_addr: string
          company_email_domains?: string[]
          company_lat: number
          company_lng: number
          company_name: string
          id?: number
          match_default_tolerance_min?: number
          match_radius_m?: number
          require_company_email?: boolean
          updated_at?: string
        }
        Update: {
          company_addr?: string
          company_email_domains?: string[]
          company_lat?: number
          company_lng?: number
          company_name?: string
          id?: number
          match_default_tolerance_min?: number
          match_radius_m?: number
          require_company_email?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      carpool_offers: {
        Row: {
          created_at: string
          depart_time: string
          dest_addr: string
          dest_lat: number
          dest_lng: number
          dest_point: unknown
          direction: Database["public"]["Enums"]["carpool_direction"]
          driver_id: string
          id: string
          origin_addr: string
          origin_lat: number
          origin_lng: number
          origin_point: unknown
          recurring_group_id: string | null
          ride_date: string
          route: unknown
          route_distance_m: number | null
          route_duration_s: number | null
          seats_available: number
          seats_total: number
          status: Database["public"]["Enums"]["offer_status"]
          waypoints: Json
        }
        Insert: {
          created_at?: string
          depart_time: string
          dest_addr: string
          dest_lat: number
          dest_lng: number
          dest_point?: unknown
          direction: Database["public"]["Enums"]["carpool_direction"]
          driver_id: string
          id?: string
          origin_addr: string
          origin_lat: number
          origin_lng: number
          origin_point?: unknown
          recurring_group_id?: string | null
          ride_date: string
          route?: unknown
          route_distance_m?: number | null
          route_duration_s?: number | null
          seats_available: number
          seats_total?: number
          status?: Database["public"]["Enums"]["offer_status"]
          waypoints?: Json
        }
        Update: {
          created_at?: string
          depart_time?: string
          dest_addr?: string
          dest_lat?: number
          dest_lng?: number
          dest_point?: unknown
          direction?: Database["public"]["Enums"]["carpool_direction"]
          driver_id?: string
          id?: string
          origin_addr?: string
          origin_lat?: number
          origin_lng?: number
          origin_point?: unknown
          recurring_group_id?: string | null
          ride_date?: string
          route?: unknown
          route_distance_m?: number | null
          route_duration_s?: number | null
          seats_available?: number
          seats_total?: number
          status?: Database["public"]["Enums"]["offer_status"]
          waypoints?: Json
        }
        Relationships: [
          {
            foreignKeyName: "carpool_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "matched_contacts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "carpool_offers_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      carpool_requests: {
        Row: {
          board_addr: string
          board_lat: number
          board_lng: number
          board_point: unknown
          created_at: string
          desired_time: string
          id: string
          offer_id: string
          passenger_id: string
          status: Database["public"]["Enums"]["request_status"]
          time_tolerance: number
        }
        Insert: {
          board_addr: string
          board_lat: number
          board_lng: number
          board_point?: unknown
          created_at?: string
          desired_time: string
          id?: string
          offer_id: string
          passenger_id: string
          status?: Database["public"]["Enums"]["request_status"]
          time_tolerance?: number
        }
        Update: {
          board_addr?: string
          board_lat?: number
          board_lng?: number
          board_point?: unknown
          created_at?: string
          desired_time?: string
          id?: string
          offer_id?: string
          passenger_id?: string
          status?: Database["public"]["Enums"]["request_status"]
          time_tolerance?: number
        }
        Relationships: [
          {
            foreignKeyName: "carpool_requests_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "carpool_offers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "carpool_requests_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "matched_contacts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "carpool_requests_passenger_id_fkey"
            columns: ["passenger_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      driver_ratings: {
        Row: {
          driver_id: string
          earned_at: string
          id: string
          offer_id: string
          points: number
        }
        Insert: {
          driver_id: string
          earned_at?: string
          id?: string
          offer_id: string
          points?: number
        }
        Update: {
          driver_id?: string
          earned_at?: string
          id?: string
          offer_id?: string
          points?: number
        }
        Relationships: [
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "matched_contacts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "driver_ratings_driver_id_fkey"
            columns: ["driver_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "driver_ratings_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: true
            referencedRelation: "carpool_offers"
            referencedColumns: ["id"]
          },
        ]
      }
      profile_private: {
        Row: {
          email: string
          id: string
          login_id: string
          phone: string
        }
        Insert: {
          email: string
          id: string
          login_id: string
          phone: string
        }
        Update: {
          email?: string
          id?: string
          login_id?: string
          phone?: string
        }
        Relationships: [
          {
            foreignKeyName: "profile_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "matched_contacts"
            referencedColumns: ["user_id"]
          },
          {
            foreignKeyName: "profile_private_id_fkey"
            columns: ["id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          created_at: string
          department: string
          id: string
          name: string
        }
        Insert: {
          created_at?: string
          department: string
          id: string
          name: string
        }
        Update: {
          created_at?: string
          department?: string
          id?: string
          name?: string
        }
        Relationships: []
      }
    }
    Views: {
      matched_contacts: {
        Row: {
          department: string | null
          name: string | null
          offer_id: string | null
          phone: string | null
          request_id: string | null
          user_id: string | null
        }
        Relationships: [
          {
            foreignKeyName: "carpool_requests_offer_id_fkey"
            columns: ["offer_id"]
            isOneToOne: false
            referencedRelation: "carpool_offers"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      accept_carpool_request: {
        Args: { p_request_id: string }
        Returns: {
          board_addr: string
          board_lat: number
          board_lng: number
          board_point: unknown
          created_at: string
          desired_time: string
          id: string
          offer_id: string
          passenger_id: string
          status: Database["public"]["Enums"]["request_status"]
          time_tolerance: number
        }
        SetofOptions: {
          from: "*"
          to: "carpool_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      admin_list_accounts: {
        Args: { p_query?: string }
        Returns: {
          created_at: string
          department: string
          email: string
          is_admin: boolean
          login_id: string
          name: string
          offers: number
          phone_masked: string
          points: number
          rides: number
          user_id: string
        }[]
      }
      admin_stats: {
        Args: never
        Returns: {
          completed: number
          matched: number
          offers: number
          points: number
          requests: number
          users: number
        }[]
      }
      auto_complete_due_offers: { Args: never; Returns: number }
      can_share_location: { Args: { p_offer_id: string }; Returns: boolean }
      can_use_trip_channel: { Args: { p_topic: string }; Returns: boolean }
      cancel_carpool_offers: {
        Args: { p_offer_id: string; p_whole_group?: boolean }
        Returns: number
      }
      cancel_carpool_request: {
        Args: { p_request_id: string }
        Returns: {
          board_addr: string
          board_lat: number
          board_lng: number
          board_point: unknown
          created_at: string
          desired_time: string
          id: string
          offer_id: string
          passenger_id: string
          status: Database["public"]["Enums"]["request_status"]
          time_tolerance: number
        }
        SetofOptions: {
          from: "*"
          to: "carpool_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      complete_carpool_offer: {
        Args: { p_offer_id: string }
        Returns: {
          created_at: string
          depart_time: string
          dest_addr: string
          dest_lat: number
          dest_lng: number
          dest_point: unknown
          direction: Database["public"]["Enums"]["carpool_direction"]
          driver_id: string
          id: string
          origin_addr: string
          origin_lat: number
          origin_lng: number
          origin_point: unknown
          recurring_group_id: string | null
          ride_date: string
          route: unknown
          route_distance_m: number | null
          route_duration_s: number | null
          seats_available: number
          seats_total: number
          status: Database["public"]["Enums"]["offer_status"]
          waypoints: Json
        }
        SetofOptions: {
          from: "*"
          to: "carpool_offers"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      create_carpool_offers: {
        Args: {
          p_dates: string[]
          p_depart_time: string
          p_dest: Json
          p_direction: Database["public"]["Enums"]["carpool_direction"]
          p_origin: Json
          p_route?: Json
          p_route_distance_m?: number
          p_route_duration_s?: number
          p_seats_total?: number
          p_waypoints?: Json
        }
        Returns: {
          created_at: string
          depart_time: string
          dest_addr: string
          dest_lat: number
          dest_lng: number
          dest_point: unknown
          direction: Database["public"]["Enums"]["carpool_direction"]
          driver_id: string
          id: string
          origin_addr: string
          origin_lat: number
          origin_lng: number
          origin_point: unknown
          recurring_group_id: string | null
          ride_date: string
          route: unknown
          route_distance_m: number | null
          route_duration_s: number | null
          seats_available: number
          seats_total: number
          status: Database["public"]["Enums"]["offer_status"]
          waypoints: Json
        }[]
        SetofOptions: {
          from: "*"
          to: "carpool_offers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      is_admin: { Args: never; Returns: boolean }
      is_login_id_available: { Args: { p_login_id: string }; Returns: boolean }
      my_rating_rank: {
        Args: { p_period?: string }
        Returns: {
          points: number
          rank: number
          rides: number
          total_drivers: number
        }[]
      }
      my_rating_summary: {
        Args: never
        Returns: {
          monthly: number
          rides: number
          total: number
          yearly: number
        }[]
      }
      offer_route_path: { Args: { p_offer_id: string }; Returns: Json }
      rating_leaderboard: {
        Args: { p_limit?: number; p_period?: string }
        Returns: {
          department: string
          is_me: boolean
          name: string
          points: number
          rank: number
          rides: number
          user_id: string
        }[]
      }
      reject_carpool_request: {
        Args: { p_request_id: string }
        Returns: {
          board_addr: string
          board_lat: number
          board_lng: number
          board_point: unknown
          created_at: string
          desired_time: string
          id: string
          offer_id: string
          passenger_id: string
          status: Database["public"]["Enums"]["request_status"]
          time_tolerance: number
        }
        SetofOptions: {
          from: "*"
          to: "carpool_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      request_carpool: {
        Args: {
          p_addr: string
          p_desired_time: string
          p_lat: number
          p_lng: number
          p_offer_id: string
          p_tolerance?: number
        }
        Returns: {
          board_addr: string
          board_lat: number
          board_lng: number
          board_point: unknown
          created_at: string
          desired_time: string
          id: string
          offer_id: string
          passenger_id: string
          status: Database["public"]["Enums"]["request_status"]
          time_tolerance: number
        }
        SetofOptions: {
          from: "*"
          to: "carpool_requests"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      search_carpool_offers: {
        Args: {
          p_date: string
          p_desired_time: string
          p_direction: Database["public"]["Enums"]["carpool_direction"]
          p_lat: number
          p_lng: number
          p_radius_m?: number
          p_tolerance_min?: number
        }
        Returns: {
          already_requested: boolean
          depart_time: string
          dest_addr: string
          dest_lat: number
          dest_lng: number
          detour_m: number
          driver_department: string
          driver_id: string
          driver_name: string
          driver_points: number
          est_time: string
          offer_id: string
          origin_addr: string
          origin_lat: number
          origin_lng: number
          ride_date: string
          route_distance_m: number
          route_duration_s: number
          route_path: Json
          score: number
          seats_available: number
          seats_total: number
          time_diff_min: number
          waypoints: Json
        }[]
      }
    }
    Enums: {
      carpool_direction: "commute-in" | "commute-out"
      offer_status: "open" | "full" | "done" | "cancelled"
      request_status: "pending" | "accepted" | "rejected" | "cancelled" | "done"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      carpool_direction: ["commute-in", "commute-out"],
      offer_status: ["open", "full", "done", "cancelled"],
      request_status: ["pending", "accepted", "rejected", "cancelled", "done"],
    },
  },
} as const

