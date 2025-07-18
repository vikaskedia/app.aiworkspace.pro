CREATE TABLE workspace_custom_fields (
    id bigint GENERATED BY DEFAULT AS IDENTITY PRIMARY KEY,
    matter_id bigint REFERENCES matters(id) ON DELETE CASCADE,
    field_key text NOT NULL,
    field_label text NOT NULL,
    field_type text NOT NULL,
    field_options jsonb NULL, -- For dropdown options
    field_value text NULL,
    required boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    UNIQUE(matter_id, field_key)
);
