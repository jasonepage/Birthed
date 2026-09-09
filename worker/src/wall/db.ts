// The wall's rows, read and written over the project's automatic interface
// with the service role. Shared by the checker and the news seeder. The seed
// tool keeps its own copy of these three verbs on purpose: it must never be
// pointed at the live project, and sharing a client with things that are
// would make that one flag away.

export interface Db {
  url: string;
  key: string;
}

function headers(db: Db, extra: Record<string, string> = {}): Record<string, string> {
  return {
    apikey: db.key,
    Authorization: `Bearer ${db.key}`,
    Accept: "application/json",
    ...extra,
  };
}

/** Every row a query returns, in pages of a thousand. */
export async function rows<T>(db: Db, path: string): Promise<T[]> {
  const pageSize = 1000;
  const out: T[] = [];
  for (let offset = 0; ; offset += pageSize) {
    const joiner = path.includes("?") ? "&" : "?";
    const response = await fetch(`${db.url}/rest/v1/${path}${joiner}limit=${pageSize}&offset=${offset}`, {
      headers: headers(db),
    });
    if (!response.ok) throw new Error(`wall: read ${path.split("?")[0]} failed with ${response.status}`);
    const page = (await response.json()) as T[];
    out.push(...page);
    if (page.length < pageSize) return out;
  }
}

/** Inserts rows. Returns the inserted rows when asked to. */
export async function insert<T = unknown>(
  db: Db, table: string, body: unknown[], options: { returning?: boolean; ignoreDuplicates?: boolean } = {},
): Promise<T[]> {
  if (body.length === 0) return [];
  const prefer = [
    options.returning ? "return=representation" : "return=minimal",
    ...(options.ignoreDuplicates ? ["resolution=ignore-duplicates"] : []),
  ].join(",");
  const response = await fetch(`${db.url}/rest/v1/${table}`, {
    method: "POST",
    headers: headers(db, { "Content-Type": "application/json", Prefer: prefer }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`wall: insert into ${table} failed with ${response.status}. ${(await response.text()).slice(0, 400)}`);
  }
  if (!options.returning) return [];
  return (await response.json()) as T[];
}

/** Updates the rows a filter names. The filter is the query string, such as `id=eq.<uuid>`. */
export async function update(db: Db, table: string, filter: string, body: unknown): Promise<void> {
  const response = await fetch(`${db.url}/rest/v1/${table}?${filter}`, {
    method: "PATCH",
    headers: headers(db, { "Content-Type": "application/json", Prefer: "return=minimal" }),
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    throw new Error(`wall: update ${table} failed with ${response.status}. ${(await response.text()).slice(0, 400)}`);
  }
}

/** Calls a database function and returns what it returns. */
export async function rpc<T>(db: Db, name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(`${db.url}/rest/v1/rpc/${name}`, {
    method: "POST",
    headers: headers(db, { "Content-Type": "application/json" }),
    body: JSON.stringify(args),
  });
  if (!response.ok) {
    throw new Error(`wall: ${name} failed with ${response.status}. ${(await response.text()).slice(0, 400)}`);
  }
  return (await response.json()) as T;
}
