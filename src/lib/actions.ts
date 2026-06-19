'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { z } from 'zod';
import { createServerSupabase, isApprovedAdmin } from '@/lib/supabase';

export type ActionState = {
  ok: boolean;
  message: string;
};

const requiredText = (maxLength: number) => z.string().trim().min(1).max(maxLength);
const optionalUrl = z.string().trim().url().optional().or(z.literal(''));

export async function submitSuggestion(_state: ActionState, formData: FormData): Promise<ActionState> {
  const schema = z.object({
    name: requiredText(80),
    email: z.string().trim().email(),
    title: requiredText(120),
    description: requiredText(1500),
    category: requiredText(80),
    reference_link: optionalUrl,
    budget_range: z.string().trim().max(80).optional(),
  });

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Please check the form and try again.' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('suggestions').insert({ ...parsed.data, status: 'New' });

  return {
    ok: !error,
    message: error ? 'Could not save suggestion. Please try again.' : 'Thanks! Your idea was submitted.',
  };
}

export async function submitContact(_state: ActionState, formData: FormData): Promise<ActionState> {
  const schema = z.object({
    name: requiredText(80),
    email: z.string().trim().email(),
    message: requiredText(1500),
  });

  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    return { ok: false, message: 'Please enter your name, email, and message.' };
  }

  const supabase = await createServerSupabase();
  const { error } = await supabase.from('contact_messages').insert(parsed.data);

  return {
    ok: !error,
    message: error ? 'Could not send message. Please try again.' : 'Message sent — thank you!',
  };
}

export async function signIn(_state: ActionState, formData: FormData): Promise<ActionState> {
  const supabase = await createServerSupabase();
  const email = String(formData.get('email') || '');
  const password = String(formData.get('password') || '');
  const { error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) return { ok: false, message: error.message };
  redirect('/admin');
  return { ok: true, message: 'Signed in.' };
}

export async function signOut() {
  const supabase = await createServerSupabase();
  await supabase.auth.signOut();
  redirect('/admin/login');
}

async function requireAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!isApprovedAdmin(user?.email)) {
    throw new Error('Unauthorized');
  }

  return supabase;
}

export async function upsertProduct(formData: FormData) {
  const supabase = await requireAdmin();
  const tags = String(formData.get('tags') || '')
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean);

  const payload = {
    name: String(formData.get('name') || '').trim(),
    slug: String(formData.get('slug') || '').trim(),
    short_description: String(formData.get('short_description') || '').trim(),
    full_description: String(formData.get('full_description') || '').trim(),
    category: String(formData.get('category') || '').trim(),
    price: formData.get('price') ? Number(formData.get('price')) : null,
    etsy_url: String(formData.get('etsy_url') || '').trim(),
    main_image_url: String(formData.get('main_image_url') || '').trim(),
    video_url: String(formData.get('video_url') || '').trim(),
    materials: String(formData.get('materials') || '').trim(),
    dimensions: String(formData.get('dimensions') || '').trim(),
    customization_notes: String(formData.get('customization_notes') || '').trim(),
    tags,
    featured: formData.get('featured') === 'on',
    active: formData.get('active') === 'on',
    updated_at: new Date().toISOString(),
  };

  const id = formData.get('id');
  if (id) await supabase.from('products').update(payload).eq('id', id);
  else await supabase.from('products').insert(payload);

  revalidatePath('/admin');
  revalidatePath('/products');
}

export async function deleteProduct(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from('products').delete().eq('id', String(formData.get('id')));
  revalidatePath('/admin');
}

export async function updateSuggestionStatus(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from('suggestions').update({ status: String(formData.get('status')) }).eq('id', String(formData.get('id')));
  revalidatePath('/admin/suggestions');
}

export async function deleteSuggestion(formData: FormData) {
  const supabase = await requireAdmin();
  await supabase.from('suggestions').delete().eq('id', String(formData.get('id')));
  revalidatePath('/admin/suggestions');
}
