'use client';

import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Insert a row into a Supabase table (non-blocking).
 * Mirrors addDocumentNonBlocking() from Firestore.
 */
export function insertRowNonBlocking(supabase: SupabaseClient, table: string, data: Record<string, any>): void {
  supabase.from(table).insert(data).then(({ error }) => {
    if (error) console.error(`[Supabase] insert error on "${table}":`, error.message);
  });
}

/**
 * Upsert (insert or update) a row in a Supabase table (non-blocking).
 * Mirrors setDocumentNonBlocking() from Firestore.
 */
export function upsertRowNonBlocking(supabase: SupabaseClient, table: string, data: Record<string, any>): void {
  supabase.from(table).upsert(data).then(({ error }) => {
    if (error) console.error(`[Supabase] upsert error on "${table}":`, error.message);
  });
}

/**
 * Update a row by id (non-blocking).
 * Mirrors updateDocumentNonBlocking() from Firestore.
 */
export function updateRowNonBlocking(supabase: SupabaseClient, table: string, id: string, data: Record<string, any>): void {
  supabase.from(table).update(data).eq('id', id).then(({ error }) => {
    if (error) console.error(`[Supabase] update error on "${table}" id=${id}:`, error.message);
  });
}

/**
 * Delete a row by id (non-blocking).
 * Mirrors deleteDocumentNonBlocking() from Firestore.
 */
export function deleteRowNonBlocking(supabase: SupabaseClient, table: string, id: string): void {
  supabase.from(table).delete().eq('id', id).then(({ error }) => {
    if (error) console.error(`[Supabase] delete error on "${table}" id=${id}:`, error.message);
  });
}
