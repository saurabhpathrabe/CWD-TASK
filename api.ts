const BACKEND = import.meta.env.VITE_BACKEND_URL || '';

export async function getConnectUrl(): Promise<string> {
  const res = await fetch(`${BACKEND}/connect`);
  if (!res.ok) throw new Error('Failed to get connect URL');
  const data = await res.json();
  return data.authorizeUrl;
}

export interface Contact {
  id: string;
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
  };
}

export interface ContactsResponse {
  results: Contact[];
  paging: { next?: { after: string } } | null;
}

export async function getContacts(after?: string): Promise<ContactsResponse> {
  const url = after ? `${BACKEND}/contacts?after=${after}` : `${BACKEND}/contacts`;
  const res = await fetch(url);
  const data = await res.json();

  if (!res.ok) {
    // Propagate clean error from backend
    throw Object.assign(new Error(data.message || 'Failed to fetch contacts'), {
      code: data.error,
      status: res.status,
    });
  }

  return data;
}
