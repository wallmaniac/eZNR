import React from 'react';
import { useLanguage } from '@/contexts/LanguageContext';

export default function Pagination({ page, perPage, totalPages, totalItems, setPage, setPerPage, prevPage, nextPage, itemLength, onPerPageChangeExtra }) {
    const { t, lang } = useLanguage();

    return (
        <div className="pagination" style={{ padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                {totalItems > 0 ? `${(page - 1) * perPage + 1} - ${Math.min(page * perPage, totalItems)}` : '0'} {lang === 'bs' ? 'od' : 'of'} {totalItems} {lang === 'bs' ? 'zapisa' : 'records'}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button className="pagination-btn" onClick={() => setPage(1)} disabled={page === 1}>«</button>
                <button className="pagination-btn" onClick={() => prevPage()} disabled={page === 1}>‹</button>
                <button className="pagination-btn active">{page}</button>
                <button className="pagination-btn" onClick={() => nextPage()} disabled={page === totalPages || totalPages === 0}>›</button>
                <button className="pagination-btn" onClick={() => setPage(totalPages)} disabled={page === totalPages || totalPages === 0}>»</button>
                <select value={perPage} onChange={(e) => {
                    const newPerPage = Number(e.target.value);
                    setPerPage(newPerPage);
                    if (onPerPageChangeExtra) onPerPageChangeExtra(newPerPage);
                }}
                    style={{ padding: '6px 10px', border: '1px solid var(--border)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem' }}>
                    <option value={10}>10 / str</option>
                    <option value={25}>25 / str</option>
                    <option value={50}>50 / str</option>
                    <option value={100}>100 / str</option>
                </select>
            </div>
        </div>
    );
}
