(() => {
    const originalFetch = window.fetch.bind(window);
    const endpointPattern = /^\/api\/presentation\/([^/]+)\/effect-settings\/?$/;
    const defaults = {
        emojiEffectEnabled: true,
        crackEffectEnabled: false,
        destructionEnabled: false,
        destructionThreshold: 5,
    };

    function normalize(value) {
        const data = value && typeof value === "object" ? value : {};
        const threshold = Number(data.destructionThreshold);
        return {
            emojiEffectEnabled: typeof data.emojiEffectEnabled === "boolean"
                ? data.emojiEffectEnabled
                : defaults.emojiEffectEnabled,
            crackEffectEnabled: typeof data.crackEffectEnabled === "boolean"
                ? data.crackEffectEnabled
                : defaults.crackEffectEnabled,
            destructionEnabled: typeof data.destructionEnabled === "boolean"
                ? data.destructionEnabled
                : defaults.destructionEnabled,
            destructionThreshold: Number.isFinite(threshold)
                ? Math.min(100, Math.max(2, Math.trunc(threshold)))
                : defaults.destructionThreshold,
        };
    }

    function jsonResponse(settings) {
        return new Response(JSON.stringify(settings), {
            status: 200,
            headers: { "Content-Type": "application/json" },
        });
    }

    window.fetch = async (input, init = {}) => {
        const requestUrl = typeof input === "string" || input instanceof URL
            ? new URL(input, window.location.href)
            : new URL(input.url, window.location.href);
        const match = requestUrl.origin === window.location.origin
            ? requestUrl.pathname.match(endpointPattern)
            : null;

        if (!match) {
            return originalFetch(input, init);
        }

        const presentationId = decodeURIComponent(match[1]);
        const storageKey = `team15-presentation-effects:${presentationId}`;
        const method = String(init.method || (input instanceof Request ? input.method : "GET")).toUpperCase();

        if (method === "GET") {
            try {
                return jsonResponse(normalize(JSON.parse(localStorage.getItem(storageKey) || "null")));
            } catch {
                return jsonResponse({ ...defaults });
            }
        }

        if (method === "PATCH") {
            try {
                const settings = normalize(JSON.parse(String(init.body || "{}")));
                localStorage.setItem(storageKey, JSON.stringify(settings));
                return jsonResponse(settings);
            } catch {
                return jsonResponse({ ...defaults });
            }
        }

        return originalFetch(input, init);
    };
})();
