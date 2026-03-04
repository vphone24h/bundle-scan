/**
 * Fetch all rows bypassing Supabase 1000-row default limit via pagination.
 * Use this for any query that might return more than 1000 rows.
 * 
 * @param queryBuilder - A function that returns a Supabase query (without .range())
 * @param pageSize - Number of rows per page (default 1000)
 * @returns Array of all rows
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function fetchAllRows<T>(queryBuilder: () => any, pageSize = 1000): Promise<T[]> {
  const allData: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryBuilder().range(from, from + pageSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    allData.push(...(data as T[]));
    if (data.length < pageSize) break; // last page
    from += pageSize;
  }
  return allData;
}
