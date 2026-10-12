// lib/api.ts
'use client';
import { supabase } from "@/lib/supabaseClient";

export async function getUser() {
    const { data, error} = await supabase
    .from('users')
    .select('*')
    return data;
}