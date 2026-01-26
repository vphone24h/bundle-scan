import { useState, useMemo, useCallback } from 'react';

export interface PaginationState {
  currentPage: number;
  pageSize: number;
}

export interface UsePaginationOptions {
  defaultPageSize?: number;
  storageKey?: string;
}

export interface UsePaginationReturn<T> {
  // Current page data
  paginatedData: T[];
  
  // Pagination state
  currentPage: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  
  // Navigation functions
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
  goToFirstPage: () => void;
  goToLastPage: () => void;
  goToNextPage: () => void;
  goToPreviousPage: () => void;
  
  // Display info
  startIndex: number;
  endIndex: number;
}

const PAGE_SIZE_OPTIONS = [10, 15, 25, 50, 100];
const DEFAULT_PAGE_SIZE = 15;

export function usePagination<T>(
  data: T[],
  options: UsePaginationOptions = {}
): UsePaginationReturn<T> {
  const { defaultPageSize = DEFAULT_PAGE_SIZE, storageKey } = options;

  // Try to restore from localStorage if storageKey provided
  const getInitialState = (): PaginationState => {
    if (storageKey) {
      try {
        const stored = localStorage.getItem(`pagination_${storageKey}`);
        if (stored) {
          const parsed = JSON.parse(stored);
          return {
            currentPage: 1, // Always start on page 1 when loading
            pageSize: parsed.pageSize || defaultPageSize,
          };
        }
      } catch {
        // Ignore localStorage errors
      }
    }
    return { currentPage: 1, pageSize: defaultPageSize };
  };

  const [state, setState] = useState<PaginationState>(getInitialState);

  // Calculate derived values
  const totalItems = data.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / state.pageSize));
  
  // Ensure currentPage is valid
  const currentPage = Math.min(Math.max(1, state.currentPage), totalPages);
  
  const startIndex = (currentPage - 1) * state.pageSize;
  const endIndex = Math.min(startIndex + state.pageSize, totalItems);

  // Get paginated data
  const paginatedData = useMemo(() => {
    return data.slice(startIndex, endIndex);
  }, [data, startIndex, endIndex]);

  // Save to localStorage
  const saveToStorage = useCallback((newState: PaginationState) => {
    if (storageKey) {
      try {
        localStorage.setItem(`pagination_${storageKey}`, JSON.stringify(newState));
      } catch {
        // Ignore localStorage errors
      }
    }
  }, [storageKey]);

  // Navigation functions
  const setPage = useCallback((page: number) => {
    const validPage = Math.min(Math.max(1, page), totalPages);
    setState(prev => {
      const newState = { ...prev, currentPage: validPage };
      saveToStorage(newState);
      return newState;
    });
  }, [totalPages, saveToStorage]);

  const setPageSize = useCallback((size: number) => {
    setState(prev => {
      const newState = { currentPage: 1, pageSize: size };
      saveToStorage(newState);
      return newState;
    });
  }, [saveToStorage]);

  const goToFirstPage = useCallback(() => setPage(1), [setPage]);
  const goToLastPage = useCallback(() => setPage(totalPages), [setPage, totalPages]);
  const goToNextPage = useCallback(() => setPage(currentPage + 1), [setPage, currentPage]);
  const goToPreviousPage = useCallback(() => setPage(currentPage - 1), [setPage, currentPage]);

  return {
    paginatedData,
    currentPage,
    pageSize: state.pageSize,
    totalItems,
    totalPages,
    setPage,
    setPageSize,
    goToFirstPage,
    goToLastPage,
    goToNextPage,
    goToPreviousPage,
    startIndex: startIndex + 1, // 1-indexed for display
    endIndex,
  };
}

export { PAGE_SIZE_OPTIONS };
