CREATE TABLE file_meta (
      matter_id bigint,
      file_content_id bigint,
      id bigint NOT NULL,
      created_at timestamp with time zone NOT NULL,
      file_name character varying,
      created_by uuid
    );
    
    -- Indexes for file_meta
    CREATE UNIQUE INDEX file_meta_pkey ON public.file_meta USING btree (id)
    CREATE INDEX file_meta_matter_id_idx ON public.file_meta USING btree (matter_id)
    CREATE INDEX file_meta_created_by_idx ON public.file_meta USING btree (created_by)
    
    -- RLS for file_meta
    ALTER TABLE file_meta ENABLE ROW LEVEL SECURITY;
    
    -- Policies for file_meta
    -- No policies
    
