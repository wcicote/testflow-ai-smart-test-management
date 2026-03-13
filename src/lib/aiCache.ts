/**
 * AI Response Cache
 * Caches AI-generated responses in localStorage with TTL to avoid
 * redundant API calls for the same input requirements.
 */

const CACHE_PREFIX = 'testflow_ai_cache_';
const DEFAULT_TTL_MS = 1000 * 60 * 60; // 1 hour

interface CacheEntry<T> {
    data: T;
    timestamp: number;
    ttl: number;
}

function generateKey(type: string, input: string): string {
    // Simple hash: normalize whitespace + lowercase for consistency
    const normalized = input.trim().toLowerCase().replace(/\s+/g, ' ');
    let hash = 0;
    for (let i = 0; i < normalized.length; i++) {
        const char = normalized.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash |= 0; // Convert to 32bit integer
    }
    return `${CACHE_PREFIX}${type}_${Math.abs(hash)}`;
}

export function getCachedResponse<T>(type: string, input: string): T | null {
    try {
        const key = generateKey(type, input);
        const raw = localStorage.getItem(key);
        if (!raw) return null;

        const entry: CacheEntry<T> = JSON.parse(raw);
        const now = Date.now();

        if (now - entry.timestamp > entry.ttl) {
            localStorage.removeItem(key);
            return null;
        }

        return entry.data;
    } catch {
        return null;
    }
}

export function setCachedResponse<T>(type: string, input: string, data: T, ttlMs: number = DEFAULT_TTL_MS): void {
    try {
        const key = generateKey(type, input);
        const entry: CacheEntry<T> = {
            data,
            timestamp: Date.now(),
            ttl: ttlMs,
        };
        localStorage.setItem(key, JSON.stringify(entry));
    } catch {
        // localStorage full or unavailable — silently fail
    }
}

export function clearAICache(): void {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(CACHE_PREFIX)) {
            keysToRemove.push(key);
        }
    }
    keysToRemove.forEach(k => localStorage.removeItem(k));
}

/**
 * Wrapper for Gemini API calls with built-in caching.
 * If a cached response exists for the same (type + prompt), returns it immediately.
 * Otherwise, calls the API, caches the result, and returns it.
 */
export async function callGeminiWithCache<T>(
    type: string,
    cacheKey: string,
    prompt: string,
    options?: {
        ttlMs?: number;
        jsonMode?: boolean;
    }
): Promise<T> {
    // Check cache first
    const cached = getCachedResponse<T>(type, cacheKey);
    if (cached) {
        console.log(`[AI Cache] HIT for type="${type}"`);
        return cached;
    }

    console.log(`[AI Cache] MISS for type="${type}", calling API...`);

    const geminiKey = import.meta.env.VITE_GEMINI_API_KEY;
    if (!geminiKey) {
        throw new Error('A variável VITE_GEMINI_API_KEY não foi configurada.');
    }

    const body: any = {
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
    };

    if (options?.jsonMode) {
        body.generationConfig = { responseMimeType: 'application/json' };
    }

    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Erro na API Gemini (${response.status}): ${errorBody}`);
    }

    const result = await response.json();
    const content = result.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!content) {
        throw new Error('A IA não retornou conteúdo.');
    }

    // Parse JSON response
    const cleanContent = content.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
    const data = JSON.parse(cleanContent) as T;

    // Cache the result
    setCachedResponse(type, cacheKey, data, options?.ttlMs);

    return data;
}
