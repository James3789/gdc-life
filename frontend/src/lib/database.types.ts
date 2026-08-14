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
            referencedRelation: "profiles"
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
      [_ in never]: never
    }
    Functions: {
      cancel_carpool_offers: {
        Args: { p_offer_id: string; p_whole_group?: boolean }
        Returns: number
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
      is_login_id_available: { Args: { p_login_id: string }; Returns: boolean }
    }
    Enums: {
      carpool_direction: "commute-in" | "commute-out"
      offer_status: "open" | "full" | "done" | "cancelled"
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
    },
  },
} as const

