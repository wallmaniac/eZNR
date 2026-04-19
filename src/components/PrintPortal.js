'use client';

import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

export default function PrintPortal({ children, isPrinting }) {
    const [mounted, setMounted] = useState(false);

    useEffect(() => {
        setMounted(true);
        return () => setMounted(false);
    }, []);

    useEffect(() => {
        if (isPrinting && typeof document !== 'undefined') {
            document.body.classList.add('is-printing-portal');
        } else if (typeof document !== 'undefined') {
            document.body.classList.remove('is-printing-portal');
        }
        return () => {
            if (typeof document !== 'undefined') {
                document.body.classList.remove('is-printing-portal');
            }
        };
    }, [isPrinting]);

    if (!mounted || !isPrinting || typeof document === 'undefined') return null;

    return createPortal(
        <div className="print-portal-root">
            {children}
        </div>,
        document.body
    );
}
