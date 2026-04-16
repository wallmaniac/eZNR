import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `Ti si stručnjak za zaštitu na radu u Bosni i Hercegovini (FBiH). Tvoj zadatak je da na osnovu naziva radnog mjesta i opisa poslova (ukoliko je dostupan) izradiš nacrt tabele Opasnosti i štetnosti (Procjena rizika) u skladu s metodologijom 5x5.
Za svaku prepoznatu opasnost ili štetnost definiši tipičnu Vjerovatnoću (1-5), Posljedicu (1-5) i predložene mjere zaštite na radu.
Fokusiraj se na realne, specifične opasnosti za to radno mjesto. Generiši između 8 i 15 najvažnijih opasnosti.`;

const hazardSchema = {
    type: SchemaType.OBJECT,
    properties: {
        items: {
            type: SchemaType.ARRAY,
            description: "Lista opasnosti i štetnosti za radno mjesto",
            items: {
                type: SchemaType.OBJECT,
                properties: {
                    opisOpasnosti: { type: SchemaType.STRING, description: "Konkretan opis opasnosti ili štetnosti" },
                    vjerovatnoca: { type: SchemaType.INTEGER, description: "Vjerovatnoća 1-5" },
                    posljedica: { type: SchemaType.INTEGER, description: "Posljedica 1-5" },
                    postojeceMjere: { type: SchemaType.STRING, description: "Standardne postojeće mjere (ako ih obično ima na ovom poslu)" },
                    predlozeneMjere: { type: SchemaType.STRING, description: "Predložene dodatne mjere prevencije" },
                    vjerovatnocaNakon: { type: SchemaType.INTEGER, description: "Očekivana vjerovatnoća nakon primjene mjera (1-5)" },
                    posljedlicaNakon: { type: SchemaType.INTEGER, description: "Očekivana posljedica nakon primjene mjera (1-5)" }
                },
                required: ["opisOpasnosti", "vjerovatnoca", "posljedica", "postojeceMjere", "predlozeneMjere", "vjerovatnocaNakon", "posljedlicaNakon"]
            }
        }
    },
    required: ["items"]
};

export async function POST(req) {
    if (!process.env.GEMINI_API_KEY) {
        return new Response(JSON.stringify({ error: 'GEMINI_API_KEY is not configured on the server.' }), { status: 500 });
    }

    try {
        const body = await req.json();
        const { jobTitle, companyName, industry } = body;

        let prompt = `Kreiraj procjenu rizika za radno mjesto: "${jobTitle}".\n`;
        if (companyName) prompt += `Kompanija: ${companyName}\n`;
        if (industry) prompt += `Djelatnost: ${industry}\n`;

        const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: hazardSchema,
            }
        });

        const result = await model.generateContent(prompt);
        const text = result.response.text();
        const jsonResponse = JSON.parse(text);

        return new Response(JSON.stringify(jsonResponse), {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
        });

    } catch (error) {
        console.error('API /api/risk-ai error:', error);
        return new Response(JSON.stringify({ error: error.message }), { status: 500 });
    }
}
