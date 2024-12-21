    CREATE TABLE events (
      end_time timestamp with time zone NOT NULL,
      start_time timestamp with time zone NOT NULL,
      event_type text NOT NULL,
      description text,
      title text NOT NULL,
      id bigint NOT NULL,
      created_at timestamp with time zone,
      created_by uuid,
      matter_id bigint,
      attendees jsonb,
      location text,
      updated_at timestamp with time zone
    );
    
    -- Indexes for events
    CREATE UNIQUE INDEX events_pkey ON public.events USING btree (id)
    CREATE INDEX events_matter_id_idx ON public.events USING btree (matter_id)
    CREATE INDEX events_created_by_idx ON public.events USING btree (created_by)
    CREATE INDEX events_start_time_idx ON public.events USING btree (start_time)
    
    -- RLS for events
    ALTER TABLE events ENABLE ROW LEVEL SECURITY;
    
    -- Policies for events
    CREATE POLICY Users can delete events in their matters ON events FOR DELETE USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    CREATE POLICY Users can update events in their matters ON events FOR UPDATE USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    CREATE POLICY Users can view events in their matters ON events FOR SELECT USING ((matter_id IN ( SELECT matters.id
   FROM matters
  WHERE (matters.created_by = auth.uid()))));
    
