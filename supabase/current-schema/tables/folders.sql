CREATE TABLE folders (
      id bigint NOT NULL,
      matter_id bigint,
      created_at timestamp with time zone NOT NULL,
      created_by uuid,
      folder_name character varying,
      parent_folder_id bigint,
      file_meta_ids json
    );
    
    -- Indexes for folders
    CREATE UNIQUE INDEX folders_pkey ON public.folders USING btree (id)
    CREATE INDEX folders_matter_id_idx ON public.folders USING btree (matter_id)
    
    -- RLS for folders
    ALTER TABLE folders ENABLE ROW LEVEL SECURITY;
    
    -- Policies for folders
    -- No policies
    