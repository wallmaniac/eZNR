'use client';
import { useState, useMemo } from 'react';

/**
 * useSortedList — reusable sort hook for data tables.
 * 
 * Usage:
 *   const { sorted, toggleSort, sortIcon } = useSortedList(filteredItems, 'naziv');
 *   // In JSX header: <th style={{cursor:'pointer'}} onClick={() => toggleSort('naziv')}>{sortIcon('naziv')} Naziv</th>
 *   // In tbody: sort.sorted.map(item => ...)
 */
export function useSortedList(data, defaultField = null, defaultDir = 'asc') {
    const [sortField, setSortField] = useState(defaultField);
    const [sortDir, setSortDir] = useState(defaultDir);

    const sorted = useMemo(() => {
        if (!sortField || !data) return data || [];
        return [...data].sort((a, b) => {
            const av = (a[sortField] ?? '').toString().toLowerCase();
            const bv = (b[sortField] ?? '').toString().toLowerCase();
            // Numeric-aware compare
            const numA = parseFloat(av), numB = parseFloat(bv);
            let cmp;
            if (!isNaN(numA) && !isNaN(numB)) {
                cmp = numA - numB;
            } else {
                cmp = av.localeCompare(bv, 'hr', { sensitivity: 'base' });
            }
            return sortDir === 'asc' ? cmp : -cmp;
        });
    }, [data, sortField, sortDir]);

    const toggleSort = (field) => {
        if (sortField === field) {
            setSortDir(d => d === 'asc' ? 'desc' : 'asc');
        } else {
            setSortField(field);
            setSortDir('asc');
        }
    };

    // Returns a sort indicator string for the given field
    const sortIcon = (field) => {
        if (sortField !== field) return '';
        return sortDir === 'asc' ? ' ↑' : ' ↓';
    };

    // Inline style for sortable TH
    const thStyle = (field) => ({
        cursor: 'pointer',
        userSelect: 'none',
        whiteSpace: 'nowrap',
        color: sortField === field ? 'var(--primary)' : undefined,
        transition: 'color 0.15s',
    });

    return { sorted, toggleSort, sortIcon, thStyle, sortField, sortDir };
}
