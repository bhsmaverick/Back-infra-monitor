-- Step 1: PostgreSQL Database Schema (SQL Migration)

-- Enable pgcrypto for UUIDs if not already enabled
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- TARGETS TABLE
CREATE TABLE public.targets (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
    name TEXT NOT NULL,
    url TEXT NOT NULL,
    expected_status INTEGER DEFAULT 200,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for targets
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own targets"
    ON public.targets FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own targets"
    ON public.targets FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own targets"
    ON public.targets FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own targets"
    ON public.targets FOR DELETE
    USING (auth.uid() = user_id);

-- NOTIFICATION CONFIGS TABLE
CREATE TABLE public.notification_configs (
    user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE PRIMARY KEY,
    telegram_bot_token TEXT,
    telegram_chat_id TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for notification_configs
ALTER TABLE public.notification_configs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert their own notification config"
    ON public.notification_configs FOR INSERT
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own notification config"
    ON public.notification_configs FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Users can update their own notification config"
    ON public.notification_configs FOR UPDATE
    USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own notification config"
    ON public.notification_configs FOR DELETE
    USING (auth.uid() = user_id);
