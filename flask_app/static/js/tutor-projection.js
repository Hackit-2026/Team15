(() => {
    const params = new URLSearchParams(window.location.search);
    const roomId = params.get("roomId");
    const stage = document.getElementById("projectionStage");
    const slide = document.getElementById("projectionSlide");
    const projectionCanvas = document.getElementById("projectionCanvas");
    const guide = document.getElementById("projectionGuide");
    const status = document.getElementById("projectionStatus");
    const fullscreenButton = document.getElementById("projectionFullscreen");
    const exitButton = document.getElementById("projectionExit");
    const shareToggleButton = document.getElementById("projectionShareToggle");
    const sharePanel = document.getElementById("projectionSharePanel");
    const shareQr = document.getElementById("projectionShareQr");
    const shareQrStatus = document.getElementById("projectionShareQrStatus");
    const shareUrl = document.getElementById("projectionShareUrl");
    const shareCopyButton = document.getElementById("projectionShareCopy");
    const shareMessage = document.getElementById("projectionShareMessage");
    const pageIndicator = document.getElementById("projectionPage");
    const reactionMeter = document.getElementById("projectionReactionMeter");
    const emojis = document.getElementById("projectionEmojis");
    const cracks = document.getElementById("projectionCracks");
    const destruction = document.getElementById("projectionDestruction");

    if (!roomId || !("BroadcastChannel" in window)) {
        status.textContent = "講師画面と同期できません。対応ブラウザで開いてください。";
        return;
    }

    const channel = new BroadcastChannel(`team15-presentation:${roomId}`);
    let slideUrl = null;
    let pendingSlideUrl = null;
    let currentPage = 1;
    let totalPages = 0;
    let reactionCount = 0;
    let threshold = 5;
    let destructionEnabled = false;
    let crackEnabled = false;
    let destroyed = false;
    let touchStartX = null;
    const participantUrl = `${window.location.origin}/room/${encodeURIComponent(roomId || "")}`;

    function setSharePanel(open) {
        stage.classList.toggle("has-share-panel", open);
        sharePanel.setAttribute("aria-hidden", String(!open));
        shareToggleButton.setAttribute("aria-expanded", String(open));
        shareToggleButton.setAttribute(
            "aria-label",
            open ? "参加用QRコードを閉じる" : "参加用QRコードを表示",
        );
        shareToggleButton.title = open ? "QRコードとURLを閉じる (Q)" : "QRコードとURLを表示 (Q)";

        if (open && !shareQr.getAttribute("src")) {
            shareQrStatus.hidden = false;
            shareQr.hidden = true;
            shareQr.src = `/api/qrcreate/${encodeURIComponent(roomId)}`;
        }
    }

    shareUrl.textContent = participantUrl;
    shareQr.addEventListener("load", () => {
        shareQr.hidden = false;
        shareQrStatus.hidden = true;
    });
    shareQr.addEventListener("error", () => {
        shareQr.hidden = true;
        shareQrStatus.hidden = false;
        shareQrStatus.textContent = "QRコードを表示できませんでした";
    });
    shareToggleButton.addEventListener("click", () => {
        setSharePanel(!stage.classList.contains("has-share-panel"));
    });
    shareCopyButton.addEventListener("click", async () => {
        try {
            await navigator.clipboard.writeText(participantUrl);
            shareMessage.textContent = "参加者用URLをコピーしました";
        } catch {
            shareMessage.textContent = "URLを選択してコピーしてください";
            window.getSelection()?.selectAllChildren(shareUrl);
        }
    });

    function updateReactionState() {
        reactionMeter.textContent = destructionEnabled
            ? `🤔 ${reactionCount} / ${threshold}人`
            : `🤔 ${reactionCount}人`;
        reactionMeter.classList.toggle(
            "is-threshold-reached",
            destructionEnabled && reactionCount >= threshold,
        );
        const progress = reactionCount / threshold;
        cracks.classList.toggle("is-visible", destructionEnabled && crackEnabled && progress >= 0.6);
        cracks.classList.toggle("is-severe", destructionEnabled && crackEnabled && progress >= 0.8);
    }

    function spawnEmoji() {
        while (emojis.childElementCount >= 20) {
            emojis.firstElementChild?.remove();
        }
        const emoji = document.createElement("span");
        emoji.className = "projection-emoji";
        emoji.textContent = "🤔";
        emoji.style.setProperty("--emoji-x", `${8 + Math.random() * 84}%`);
        emoji.style.setProperty("--drift", `${-75 + Math.random() * 150}px`);
        emoji.style.setProperty("--scale", `${0.85 + Math.random() * 0.5}`);
        emoji.addEventListener("animationend", () => emoji.remove(), { once: true });
        emojis.append(emoji);
    }

    function resetEffects() {
        reactionCount = 0;
        destroyed = false;
        emojis.replaceChildren();
        destruction.replaceChildren();
        cracks.classList.remove("is-visible", "is-severe");
        stage.classList.remove("is-exploding");
        slide.hidden = !slideUrl;
        updateReactionState();
    }

    function playExplosion() {
        if (destroyed || !slideUrl || slide.hidden) {
            return;
        }
        destroyed = true;
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            const visibleSlide = stage.classList.contains("has-hires-slide")
                ? projectionCanvas
                : slide;
            visibleSlide.animate([{ opacity: 1 }, { opacity: 0.2 }, { opacity: 1 }], { duration: 450 });
            return;
        }

        const slideBounds = slide.getBoundingClientRect();
        const stageBounds = stage.getBoundingClientRect();
        const surface = document.createElement("div");
        const columns = 6;
        const rows = 4;
        surface.className = "projection-surface";
        Object.assign(surface.style, {
            left: `${slideBounds.left - stageBounds.left}px`,
            top: `${slideBounds.top - stageBounds.top}px`,
            width: `${slideBounds.width}px`,
            height: `${slideBounds.height}px`,
        });

        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const shard = document.createElement("span");
                const width = slideBounds.width / columns;
                const height = slideBounds.height / rows;
                const directionX = (column + 0.5) / columns - 0.5;
                const directionY = (row + 0.5) / rows - 0.5;
                const length = Math.hypot(directionX, directionY) || 1;
                const force = 280 + Math.random() * 260;
                shard.className = "projection-shard";
                Object.assign(shard.style, {
                    left: `${column * width}px`,
                    top: `${row * height}px`,
                    width: `${width + 1}px`,
                    height: `${height + 1}px`,
                    backgroundImage: `url(${slideUrl})`,
                    backgroundSize: `${slideBounds.width}px ${slideBounds.height}px`,
                    backgroundPosition: `${-column * width}px ${-row * height}px`,
                });
                shard.style.setProperty("--x", `${directionX / length * force}px`);
                shard.style.setProperty("--y", `${directionY / length * force}px`);
                shard.style.setProperty("--z", `${100 + Math.random() * 330}px`);
                shard.style.setProperty("--rx", `${-160 + Math.random() * 320}deg`);
                shard.style.setProperty("--ry", `${-160 + Math.random() * 320}deg`);
                shard.style.setProperty("--rz", `${-230 + Math.random() * 460}deg`);
                shard.style.setProperty("--delay", `${Math.random() * 45}ms`);
                surface.append(shard);
            }
        }

        const flash = document.createElement("span");
        flash.className = "projection-flash";
        const shockwave = document.createElement("span");
        shockwave.className = "projection-shockwave";
        destruction.append(surface, flash, shockwave);
        slide.hidden = true;
        stage.classList.remove("is-exploding");
        void stage.offsetWidth;
        stage.classList.add("is-exploding");
        window.setTimeout(() => {
            destruction.replaceChildren();
            stage.classList.remove("is-exploding");
            slide.hidden = false;
        }, 2100);
    }

    function navigate(direction) {
        channel.postMessage({ type: "navigate", direction });
    }

    channel.addEventListener("message", (event) => {
        const message = event.data;
        if (!message || typeof message !== "object") {
            return;
        }
        if (message.type === "slide-frame" && message.blob instanceof Blob) {
            if (pendingSlideUrl) {
                URL.revokeObjectURL(pendingSlideUrl);
            }
            const nextSlideUrl = URL.createObjectURL(message.blob);
            pendingSlideUrl = nextSlideUrl;
            const preloadImage = new Image();
            preloadImage.addEventListener("load", () => {
                if (pendingSlideUrl !== nextSlideUrl) {
                    return;
                }
                const previousSlideUrl = slideUrl;
                slideUrl = nextSlideUrl;
                pendingSlideUrl = null;
                currentPage = Number(message.currentPage) || 1;
                totalPages = Number(message.totalPages) || 0;
                slide.src = nextSlideUrl;
                slide.hidden = false;
                status.textContent = "スライドの準備ができました";
                guide.hidden = true;
                pageIndicator.textContent = `${currentPage} / ${totalPages}`;
                if (previousSlideUrl) {
                    window.requestAnimationFrame(() => URL.revokeObjectURL(previousSlideUrl));
                }
            }, { once: true });
            preloadImage.addEventListener("error", () => {
                if (pendingSlideUrl === nextSlideUrl) {
                    pendingSlideUrl = null;
                    status.textContent = "スライドを再受信しています...";
                }
                URL.revokeObjectURL(nextSlideUrl);
            }, { once: true });
            preloadImage.src = nextSlideUrl;
        } else if (message.type === "effect-state") {
            reactionCount = Math.max(0, Number(message.count) || 0);
            threshold = Math.max(2, Number(message.threshold) || 5);
            destructionEnabled = Boolean(message.destructionEnabled);
            crackEnabled = Boolean(message.crackEnabled);
            updateReactionState();
        } else if (message.type === "reaction") {
            reactionCount = Math.max(reactionCount, Number(message.count) || 0);
            threshold = Math.max(2, Number(message.threshold) || threshold);
            if (message.emojiEnabled !== false) {
                const amount = Math.min(6, Math.max(1, Number(message.amount) || 1));
                for (let index = 0; index < amount; index += 1) {
                    spawnEmoji();
                }
            }
            updateReactionState();
        } else if (message.type === "destroy-slide") {
            playExplosion();
        } else if (message.type === "slide-reset") {
            resetEffects();
        }
    });

    async function toggleProjectionFullscreen() {
        try {
            if (document.fullscreenElement) {
                await document.exitFullscreen();
            } else {
                await stage.requestFullscreen();
                guide.hidden = true;
            }
        } catch {
            status.textContent = "全画面表示を開始できませんでした";
        }
    }

    fullscreenButton.addEventListener("click", () => void toggleProjectionFullscreen());
    document.addEventListener("fullscreenchange", () => {
        const isFullscreen = Boolean(document.fullscreenElement);
        fullscreenButton.setAttribute("aria-label", isFullscreen ? "全画面を終了" : "全画面にする");
        fullscreenButton.title = isFullscreen ? "全画面を終了 (F)" : "全画面にする (F)";
    });

    exitButton.addEventListener("click", () => window.close());
    stage.addEventListener("click", (event) => {
        if (
            event.target instanceof Element
            && event.target.closest("button, .projection-share-panel")
        ) {
            return;
        }
        navigate(event.clientX < window.innerWidth / 2 ? "previous" : "next");
    });
    stage.addEventListener("touchstart", (event) => {
        if (event.target instanceof Element && event.target.closest(".projection-share-panel")) {
            touchStartX = null;
            return;
        }
        touchStartX = event.changedTouches[0]?.clientX ?? null;
    }, { passive: true });
    stage.addEventListener("touchend", (event) => {
        const endX = event.changedTouches[0]?.clientX;
        if (touchStartX === null || endX === undefined || Math.abs(endX - touchStartX) < 50) {
            return;
        }
        navigate(endX < touchStartX ? "next" : "previous");
        touchStartX = null;
    }, { passive: true });
    document.addEventListener("keydown", (event) => {
        if (["ArrowRight", "ArrowDown", "PageDown", "Enter", " "].includes(event.key)) {
            event.preventDefault();
            navigate("next");
        } else if (["ArrowLeft", "ArrowUp", "PageUp", "Backspace"].includes(event.key)) {
            event.preventDefault();
            navigate("previous");
        } else if (event.key.toLowerCase() === "f") {
            void toggleProjectionFullscreen();
        } else if (event.key.toLowerCase() === "q") {
            setSharePanel(!stage.classList.contains("has-share-panel"));
        }
    });

    channel.postMessage({ type: "projection-ready" });
    window.addEventListener("beforeunload", () => {
        channel.postMessage({ type: "projection-closed" });
        channel.close();
        if (slideUrl) {
            URL.revokeObjectURL(slideUrl);
        }
        if (pendingSlideUrl) {
            URL.revokeObjectURL(pendingSlideUrl);
        }
    }, { once: true });
})();
