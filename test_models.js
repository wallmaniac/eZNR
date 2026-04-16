const apiKey = process.env.GEMINI_API_KEY || process.env.NEXT_PUBLIC_GEMINI_API_KEY;
fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`)
    .then(res => res.json())
    .then(data => {
        const models = data.models.map(m => m.name);
        console.log("AVAILABLE MODELS:", models.filter(m => m.includes('gemini')));
    })
    .catch(console.error);
