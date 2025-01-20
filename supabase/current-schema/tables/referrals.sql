CREATE TABLE referrals (
  id BIGINT PRIMARY KEY GENERATED ALWAYS AS IDENTITY,
  referrer_id UUID REFERENCES auth.users(id) NOT NULL,
  referred_email TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('Pending', 'Active')),
  reward_amount DECIMAL(10,2) DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Enable RLS
ALTER TABLE referrals ENABLE ROW LEVEL SECURITY;

-- Replace all existing policies
DROP POLICY IF EXISTS "Users can view their own referrals" ON referrals;
DROP POLICY IF EXISTS "Allow referral inserts with pending status" ON referrals;
DROP POLICY IF EXISTS "Allow updating pending referrals to active" ON referrals;

-- View policy
CREATE POLICY "Users can view their own referrals"
  ON referrals FOR SELECT
  USING (auth.uid() = referrer_id);

-- Insert policy
CREATE POLICY "Allow referral inserts with pending status"
  ON referrals FOR INSERT
  WITH CHECK (
    (auth.uid() = referrer_id) OR  
    (status = 'Pending' AND referred_email = 'pending')
  );

-- Update policy for pending to active conversion
CREATE POLICY "Allow updating pending referrals"
  ON referrals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM referrals r
      WHERE r.id = id
      AND r.status = 'Pending' 
      AND r.referred_email = 'pending'
    )
  )
  WITH CHECK (
    status = 'Active' AND 
    referred_email != 'pending'
  );

-- Update policy for referrer updates
CREATE POLICY "Allow referrer to update their referrals"
  ON referrals FOR UPDATE
  USING (auth.uid() = referrer_id);

-- Add trigger for updated_at
CREATE TRIGGER handle_updated_at
  BEFORE UPDATE ON referrals
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Create function to get referred user info
CREATE OR REPLACE FUNCTION get_referred_user_info(ref_id UUID)
RETURNS TABLE (email TEXT)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT email FROM auth.users WHERE id = ref_id;
$$;

CREATE OR REPLACE FUNCTION get_user_id_by_email_prefix(email_prefix TEXT)
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT id FROM auth.users 
  WHERE email LIKE email_prefix || '@%'
  LIMIT 1;
$$;
