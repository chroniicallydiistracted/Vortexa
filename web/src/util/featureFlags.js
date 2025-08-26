export async function getRuntimeFlags() {
    try {
        const r = await fetch('/api/flags');
        if (!r.ok)
            throw new Error('flags not ok');
        const data = await r.json();
        return { enable3d: !!data.enable3d };
    }
    catch {
        return { enable3d: false };
    }
}
