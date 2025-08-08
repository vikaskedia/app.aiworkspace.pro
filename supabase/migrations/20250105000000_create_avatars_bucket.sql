-- Create the avatars bucket for user profile pictures and icons
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO NOTHING;

-- Create bucket if it doesn't exist (alternative approach for some Supabase versions)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM storage.buckets WHERE id = 'avatars') THEN
        INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
        VALUES (
            'avatars', 
            'avatars', 
            true,
            5242880, -- 5MB limit
            ARRAY['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp']
        );
    END IF;
END $$;

-- Allow authenticated users to upload avatars
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Authenticated users can upload avatars'
    ) THEN
        CREATE POLICY "Authenticated users can upload avatars"
        ON storage.objects FOR INSERT
        TO authenticated
        WITH CHECK (bucket_id = 'avatars');
    END IF;
END $$;

-- Allow public access to read avatars
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Public users can view avatars'
    ) THEN
        CREATE POLICY "Public users can view avatars"
        ON storage.objects FOR SELECT
        TO public
        USING (bucket_id = 'avatars');
    END IF;
END $$;

-- Allow authenticated users to update their own avatars
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can update their own avatars'
    ) THEN
        CREATE POLICY "Users can update their own avatars"
        ON storage.objects FOR UPDATE
        TO authenticated
        USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
    END IF;
END $$;

-- Allow authenticated users to delete their own avatars
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
        AND tablename = 'objects' 
        AND policyname = 'Users can delete their own avatars'
    ) THEN
        CREATE POLICY "Users can delete their own avatars"
        ON storage.objects FOR DELETE
        TO authenticated
        USING (bucket_id = 'avatars' AND (storage.foldername(name))[1] = auth.uid()::text);
    END IF;
END $$;