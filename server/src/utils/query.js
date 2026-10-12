const PAGE_SIZE = 1000;

// Supabase returns at most 1000 rows per request. `buildQuery` must return a fresh query
// each call; the pages are fetched until one comes back short or `maxRows` is reached.
export async function fetchAll(buildQuery, maxRows = 20000) {
  const rows = [];

  for (let from = 0; from < maxRows; from += PAGE_SIZE) {
    const { data, error } = await buildQuery().range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...(data || []));
    if (!data || data.length < PAGE_SIZE) break;
  }

  return rows;
}

export function toCsv(headers, rows) {
  const cell = (value) => {
    const text = value === null || value === undefined ? "" : String(value);
    return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };

  return [headers, ...rows].map((row) => row.map(cell).join(",")).join("\r\n");
}
