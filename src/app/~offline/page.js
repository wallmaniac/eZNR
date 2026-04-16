'use client';

import React from 'react';
import Link from 'next/link';

export default function OfflineFallback() {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh',
      backgroundColor: '#0a0a0a', color: '#f3f4f6', fontFamily: 'system-ui, -apple-system, sans-serif', padding: '2rem', textAlign: 'center'
    }}>
      <div style={{ fontSize: '4rem', marginBottom: '1rem' }}>🦖</div>
      <h1 style={{ margin: '0 0 1rem 0', color: '#00BFA6' }}>Vi ste u Offline Modu</h1>
      <p style={{ maxWidth: '400px', lineHeight: '1.6', color: '#9ca3af', marginBottom: '2rem' }}>
        Vaša internet konekcija je trenutno prekinuta. eZNR aplikacija automatski sprema sve promjene lokalno.
        <br/><br/>
        Budući da ste osvježili stranicu (F5) bez interneta, prikazuje se ovaj sigurni mod.
      </p>
      
      <Link href="/dashboard"
        style={{
          border: '1px solid #00BFA6', color: '#00BFA6', textDecoration: 'none', padding: '0.75rem 1.5rem',
          borderRadius: '0.5rem', fontWeight: 'bold'
        }}
      >
        Pokreni eZNR sa Početka
      </Link>
    </div>
  );
}
