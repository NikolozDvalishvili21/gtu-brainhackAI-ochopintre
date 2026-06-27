import { useState, useEffect, useCallback, useRef } from "react";

const BASE = "https://interior-materials-api.onrender.com";

export type MaterialSource = "nova" | "domino";

export interface Material {
  id: string;
  source: MaterialSource;
  category: string;
  sku: string;
  name: string;
  url: string;
  image: string;
  price: number;
  old_price: number | null;
  currency: string;
  unit: string;
  dimensions: string | null;
  discount: string | null;
  price_raw: string;
  scraped_at: string;
}

export interface CategoryInfo {
  source: string;
  category: string;
  count: number;
}

interface MaterialsResponse {
  total: number;
  limit: number;
  offset: number;
  items: Material[];
}

export interface UseMaterialsOptions {
  source?: MaterialSource;
  category?: string;
  q?: string;
  min_price?: number;
  max_price?: number;
  limit?: number;
}

export function useMaterials(opts: UseMaterialsOptions = {}) {
  const [items, setItems] = useState<Material[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const LIMIT = opts.limit ?? 24;

  const buildUrl = useCallback(
    (off: number) => {
      const p = new URLSearchParams();
      if (opts.source) p.set("source", opts.source);
      if (opts.category) p.set("category", opts.category);
      if (opts.q) p.set("q", opts.q);
      if (opts.min_price != null) p.set("min_price", String(opts.min_price));
      if (opts.max_price != null) p.set("max_price", String(opts.max_price));
      p.set("limit", String(LIMIT));
      p.set("offset", String(off));
      return `${BASE}/materials?${p}`;
    },
    [opts.source, opts.category, opts.q, opts.min_price, opts.max_price, LIMIT],
  );

  // Fresh fetch when filters change
  useEffect(() => {
    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setLoading(true);
    setError(null);
    setOffset(0);

    fetch(buildUrl(0), { signal: ctrl.signal })
      .then((r) => r.json() as Promise<MaterialsResponse>)
      .then((data) => {
        setItems(data.items);
        setTotal(data.total);
        setOffset(LIMIT);
        setHasMore(LIMIT < data.total);
      })
      .catch((e) => {
        if (e.name !== "AbortError") setError(e.message);
      })
      .finally(() => setLoading(false));

    return () => ctrl.abort();
  }, [buildUrl]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore) return;
    setLoadingMore(true);
    try {
      const res = await fetch(buildUrl(offset));
      const data: MaterialsResponse = await res.json();
      setItems((prev) => [...prev, ...data.items]);
      setOffset((prev) => prev + LIMIT);
      setHasMore(offset + LIMIT < data.total);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoadingMore(false);
    }
  }, [buildUrl, offset, hasMore, loadingMore, LIMIT]);

  return { items, total, loading, loadingMore, error, hasMore, loadMore };
}

export function useCategories() {
  const [categories, setCategories] = useState<CategoryInfo[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    fetch(`${BASE}/categories`)
      .then((r) => r.json())
      .then(setCategories)
      .finally(() => setLoading(false));
  }, []);

  return { categories, loading };
}
