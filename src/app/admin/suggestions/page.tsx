import { redirect } from 'next/navigation';
import { deleteSuggestion, updateSuggestionStatus } from '@/lib/actions';
import { createServerSupabase, isApprovedAdmin } from '@/lib/supabase';
import type { Suggestion } from '@/types/database';

const statuses: Suggestion['status'][] = ['New', 'Reviewing', 'In Progress', 'Made', 'Rejected'];

export const metadata = { title: 'Suggestion Admin' };

export default async function SuggestionsAdmin() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/admin/login');
  if (!isApprovedAdmin(user.email)) {
    return <section className="container py-12">Access denied</section>;
  }

  const { data: suggestions = [] } = await supabase.from('suggestions').select('*').order('created_at', { ascending: false });

  return (
    <section className="container py-12">
      <h1 className="text-4xl font-black">Customer suggestions</h1>
      <p className="mt-3 text-zinc-400">Review ideas, update workflow status, and remove spam submissions.</p>

      <div className="mt-8 grid gap-4">
        {(suggestions as Suggestion[]).map((suggestion) => (
          <article className="glass rounded-2xl p-5" key={suggestion.id}>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-black">{suggestion.title}</h2>
                <p className="text-zinc-400">
                  {suggestion.name} · {suggestion.email} · {new Date(suggestion.created_at).toLocaleDateString()}
                </p>
              </div>
              <span className="badge">{suggestion.status}</span>
            </div>

            <p className="mt-3 text-zinc-300">{suggestion.description}</p>
            {suggestion.reference_link ? <p className="mt-2 text-sm text-orange-300">Reference: {suggestion.reference_link}</p> : null}
            {suggestion.budget_range ? <p className="mt-2 text-sm text-zinc-400">Budget: {suggestion.budget_range}</p> : null}

            <div className="mt-4 flex flex-wrap gap-3">
              <form action={updateSuggestionStatus} className="flex flex-wrap gap-3">
                <input type="hidden" name="id" value={suggestion.id} />
                <select className="input max-w-xs" name="status" defaultValue={suggestion.status}>
                  {statuses.map((status) => (
                    <option key={status}>{status}</option>
                  ))}
                </select>
                <button className="btn btn-primary">Update</button>
              </form>
              <form action={deleteSuggestion}>
                <input type="hidden" name="id" value={suggestion.id} />
                <button className="btn btn-ghost">Delete</button>
              </form>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
