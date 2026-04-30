import { useState, useMemo } from 'react';

export function usePagination(data, initialPerPage = 10) {
    const [page, setPage] = useState(1);
    const [perPage, setPerPage] = useState(initialPerPage);

    const totalPages = Math.max(1, Math.ceil((data?.length || 0) / perPage));

    // Ensure page is within bounds
    if (page > totalPages && totalPages > 0) {
        setPage(totalPages);
    }

    const pagedData = useMemo(() => {
        if (!data) return [];
        const startIndex = (page - 1) * perPage;
        return data.slice(startIndex, startIndex + perPage);
    }, [data, page, perPage]);

    const goToPage = (p) => {
        if (p >= 1 && p <= totalPages) {
            setPage(p);
        }
    };

    const nextPage = () => goToPage(page + 1);
    const prevPage = () => goToPage(page - 1);

    return {
        page,
        perPage,
        setPage: goToPage,
        setPerPage: (size) => {
            setPerPage(size);
            setPage(1); // Reset to first page when page size changes
        },
        totalPages,
        pagedData,
        nextPage,
        prevPage,
        totalItems: data?.length || 0,
    };
}
