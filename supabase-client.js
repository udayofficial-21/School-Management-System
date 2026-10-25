import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from './supabase-config.js';

const placeholderValues = [
    'YOUR_PROJECT_REF',
    'YOUR_PUBLIC_KEY'
];

export const isSupabaseConfigured = Boolean(
    SUPABASE_URL &&
    SUPABASE_PUBLISHABLE_KEY &&
    SUPABASE_URL.startsWith('https://') &&
    !placeholderValues.some((value) => `${SUPABASE_URL} ${SUPABASE_PUBLISHABLE_KEY}`.includes(value))
);

export const supabase = isSupabaseConfigured
    ? createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
        auth: {
            autoRefreshToken: true,
            persistSession: true,
            detectSessionInUrl: true
        }
    })
    : null;
