'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase';

export function MediaUploader() {
  const [status, setStatus] = useState('');
  const [url, setUrl] = useState('');

  async function upload(formData: FormData) {
    const file = formData.get('file');
    if (!(file instanceof File) || file.size === 0) {
      setStatus('Choose a file first.');
      return;
    }

    setStatus('Uploading...');
    const supabase = createClient();
    const path = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '-')}`;
    const { error } = await supabase.storage.from('product-media').upload(path, file, { upsert: false });

    if (error) {
      setStatus(error.message);
      return;
    }

    const { data } = supabase.storage.from('product-media').getPublicUrl(path);
    setUrl(data.publicUrl);
    setStatus('Upload complete. Copy this URL into a product image/video field.');
  }

  return (
    <form action={upload} className="grid gap-3 rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <div>
        <h3 className="font-black">Upload media</h3>
        <p className="mt-1 text-sm text-zinc-400">Upload product images or videos to the Supabase `product-media` bucket.</p>
      </div>
      <input className="input" name="file" type="file" accept="image/*,video/*" />
      <button className="btn btn-ghost" type="submit">
        Upload to Supabase Storage
      </button>
      {status ? <p className="text-sm text-zinc-300">{status}</p> : null}
      {url ? <input className="input" readOnly value={url} onFocus={(event) => event.currentTarget.select()} /> : null}
    </form>
  );
}
