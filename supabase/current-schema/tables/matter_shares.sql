/* 
Features we want to support:

1. Each matter has View rights and edit rights.

2. Users with edit rights can:
2A. Give View rights or edit rights to other users.
2B. Edit the matter name or description.
2C. Archive the matter.

3. Users with View rights can only view the matter.
*/

CREATE TABLE matter_shares (
  matter_id bigint REFERENCES matters(id) NOT NULL,
  shared_with_user_id uuid REFERENCES auth.users(id) NOT NULL,
  access_type character varying NOT NULL CHECK (access_type IN ('view', 'edit')),
  created_by uuid REFERENCES auth.users(id) NOT NULL,
  created_at timestamp with time zone DEFAULT now() NOT NULL,
  PRIMARY KEY (matter_id, shared_with_user_id),
  CONSTRAINT no_self_sharing CHECK (shared_with_user_id != created_by)
);

COMMENT ON TABLE matter_shares IS 'Tracks matter sharing permissions. View access allows reading only, while edit access allows updating matter details and sharing with others.';

-- Indexes for matter_shares
CREATE INDEX matter_shares_shared_with_user_id_idx ON public.matter_shares USING btree (shared_with_user_id)
CREATE INDEX matter_shares_created_by_idx ON public.matter_shares USING btree (created_by)

-- RLS for matter_shares
ALTER TABLE matter_shares ENABLE ROW LEVEL SECURITY;

-- Policies for matter_shares
CREATE POLICY "Users can view matter shares" ON matter_shares
FOR SELECT USING (
    matter_id IN (
        SELECT matter_id FROM matter_shares WHERE shared_with_user_id = auth.uid()
    )
);

CREATE POLICY "Users with edit access can create shares" ON matter_shares
FOR INSERT WITH CHECK (
    matter_id IN (
        SELECT matter_id FROM matter_shares 
        WHERE shared_with_user_id = auth.uid() AND access_type = 'edit'
    )
);

CREATE POLICY "Users with edit access can delete shares" ON matter_shares
FOR DELETE USING (
    matter_id IN (
        SELECT matter_id FROM matter_shares 
        WHERE shared_with_user_id = auth.uid() AND access_type = 'edit'
    )
);

-- Add trigger to automatically add creator to matter_shares
CREATE FUNCTION add_creator_share() RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO matter_shares (matter_id, shared_with_user_id, access_type, created_by)
    VALUES (NEW.id, auth.uid(), 'edit', auth.uid());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_matter_created
    AFTER INSERT ON matters
    FOR EACH ROW
    EXECUTE FUNCTION add_creator_share();
