export async function apiGenerateSistematizacija(data) {
    try {
        const res = await fetch('/api/generate-sistematizacija', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });
        const result = await res.json();
        if (!result.success || !result.sistematizacija) throw new Error(result.error || 'Nepoznata greška pri generiranju.');
        return { data: result.sistematizacija };
    } catch (err) {
        console.error('Failed to generate systematization:', err);
        return { error: err.message };
    }
}

export async function apiParseSistematizacija(documentText, workplaceName) {
    try {
        const res = await fetch('/api/parse-sistematizacija', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ documentText, workplaceName }),
        });
        const result = await res.json();
        if (!result.success || !result.sistematizacija) throw new Error(result.error || 'Neuspjelo parsiranje dokumenta.');
        return { data: result.sistematizacija };
    } catch (err) {
        console.error('Failed to parse systematization:', err);
        return { error: err.message };
    }
}
