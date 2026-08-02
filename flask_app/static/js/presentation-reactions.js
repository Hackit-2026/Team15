(() => {
    const POLL_INTERVAL_MS = 1000;
    const MAX_EMOJIS_PER_POLL = 6;
    const roomId = document.body.dataset.roomId;
    const currentPageElement = document.getElementById("currentPage");
    const canvas = document.getElementById("slideCanvas");
    const viewport = document.getElementById("slideViewport");
    const emojiLayer = document.getElementById("reactionEmojiLayer");
    const destructionLayer = document.getElementById("slideDestructionLayer");
    const crackLayer = document.getElementById("slideCrackLayer");
    const reactionMeter = document.getElementById("reactionMeter");
    const emojiEnabled = document.getElementById("emojiEffectEnabled");
    const crackEnabled = document.getElementById("crackEffectEnabled");
    const destructionEnabled = document.getElementById("destructionEnabled");
    const thresholdInput = document.getElementById("destructionThreshold");
    const connectionStatus = document.getElementById("effectConnectionStatus");
    const settingsToggle = document.getElementById("effectSettingsToggle");
    const settingsPanel = document.getElementById("effectSettingsPanel");
    const settingsMessage = document.getElementById("effectSettingsMessage");
    const previewReactionButton = document.getElementById("previewReaction");
    const previewDestructionButton = document.getElementById("previewDestruction");
    const openProjectionButton = document.getElementById("openProjection");
    const openShareButton = document.getElementById("openPresentationShare");
    const qrToggleButton = document.getElementById("togglePresentationQr");
    const qrOverlay = document.getElementById("presentationQrOverlay");
    const qrCloseButton = document.getElementById("closePresentationQr");
    const qrImage = document.getElementById("presentationQrImage");
    const qrStatus = document.getElementById("presentationQrStatus");
    const qrUrl = document.getElementById("presentationQrUrl");
    const previousSlideButton = document.getElementById("previousSlide");
    const nextSlideButton = document.getElementById("nextSlide");
    const totalPagesElement = document.getElementById("totalPages");
    const selectedFileName = document.getElementById("selectedFileName");
    const uploadPanel = document.querySelector(".pdf-upload-panel");
    const presentationShell = document.getElementById("presentationShell");
    const settingsStorageKey = `team15-presentation-effects:${roomId}`;
    const projectionChannel = "BroadcastChannel" in window
        ? new BroadcastChannel(`team15-presentation:${roomId}`)
        : null;

    if (
        !roomId
        || !currentPageElement
        || !canvas
        || !viewport
        || !emojiLayer
        || !destructionLayer
        || !crackLayer
        || !reactionMeter
        || !settingsToggle
        || !settingsPanel
        || !uploadPanel
        || !presentationShell
        || !qrToggleButton
        || !qrOverlay
        || !qrCloseButton
        || !qrImage
        || !qrStatus
        || !qrUrl
    ) {
        return;
    }

    let lastRoomReactionCount = null;
    let currentSlideReactionCount = 0;
    let currentPage = Number(currentPageElement.textContent) || 1;
    let destructionPlayed = false;
    let polling = false;
    let consecutiveErrors = 0;
    let shatterTimer = null;
    let projectionWindow = null;
    let lastFrameSignature = "";
    let frameCaptureInProgress = false;
    let frameRetryGeneration = 0;

    function updateUploadPanelSize() {
        uploadPanel.classList.toggle("is-compact", !presentationShell.hidden);
    }

    const shellObserver = new MutationObserver(updateUploadPanelSize);
    shellObserver.observe(presentationShell, { attributes: true, attributeFilter: ["hidden"] });
    updateUploadPanelSize();

    function getThreshold() {
        return Math.min(100, Math.max(2, Math.trunc(Number(thresholdInput?.value) || 5)));
    }

    function loadLocalSettings() {
        try {
            const settings = JSON.parse(localStorage.getItem(settingsStorageKey) ?? "null");
            if (!settings || typeof settings !== "object") {
                return;
            }
            if (typeof settings.emojiEffectEnabled === "boolean" && emojiEnabled) {
                emojiEnabled.checked = settings.emojiEffectEnabled;
            }
            if (typeof settings.crackEffectEnabled === "boolean" && crackEnabled) {
                crackEnabled.checked = settings.crackEffectEnabled;
            }
            if (typeof settings.destructionEnabled === "boolean" && destructionEnabled) {
                destructionEnabled.checked = settings.destructionEnabled;
            }
            if (thresholdInput) {
                thresholdInput.value = String(
                    Math.min(100, Math.max(2, Math.trunc(Number(settings.destructionThreshold) || 5))),
                );
            }
        } catch {
            // 壊れたローカル設定は初期値で上書きできるため無視する。
        }
    }

    function saveLocalSettings() {
        const settings = {
            emojiEffectEnabled: Boolean(emojiEnabled?.checked),
            crackEffectEnabled: Boolean(crackEnabled?.checked),
            destructionEnabled: Boolean(destructionEnabled?.checked),
            destructionThreshold: getThreshold(),
        };
        if (thresholdInput) {
            thresholdInput.value = String(settings.destructionThreshold);
        }
        localStorage.setItem(settingsStorageKey, JSON.stringify(settings));
        updateEffectState();
        if (settingsMessage) {
            settingsMessage.textContent = "この端末に演出設定を保存しました";
        }
    }

    function updateEffectState() {
        const threshold = getThreshold();
        const isDestructionEnabled = Boolean(destructionEnabled?.checked);
        const progress = currentSlideReactionCount / threshold;

        reactionMeter.textContent = isDestructionEnabled
            ? `🤔 ${currentSlideReactionCount} / ${threshold}人`
            : `🤔 ${currentSlideReactionCount}人`;
        reactionMeter.classList.toggle(
            "is-threshold-reached",
            isDestructionEnabled && currentSlideReactionCount >= threshold,
        );
        crackLayer.classList.toggle(
            "is-visible",
            isDestructionEnabled && Boolean(crackEnabled?.checked) && progress >= 0.6,
        );
        crackLayer.classList.toggle(
            "is-severe",
            isDestructionEnabled && Boolean(crackEnabled?.checked) && progress >= 0.8,
        );

        if (
            isDestructionEnabled
            && currentSlideReactionCount >= threshold
            && !destructionPlayed
        ) {
            destructionPlayed = true;
            playDestruction();
        }

        projectionChannel?.postMessage({
            type: "effect-state",
            count: currentSlideReactionCount,
            threshold,
            emojiEnabled: Boolean(emojiEnabled?.checked),
            crackEnabled: Boolean(crackEnabled?.checked),
            destructionEnabled: isDestructionEnabled,
        });
    }

    function spawnEmoji() {
        if (!emojiEnabled?.checked) {
            return;
        }
        while (emojiLayer.childElementCount >= 20) {
            emojiLayer.firstElementChild?.remove();
        }
        const emoji = document.createElement("span");
        emoji.className = "reaction-emoji";
        emoji.textContent = "🤔";
        emoji.style.setProperty("--emoji-x", `${8 + Math.random() * 84}%`);
        emoji.style.setProperty("--emoji-drift", `${-55 + Math.random() * 110}px`);
        emoji.style.setProperty("--emoji-scale", `${0.85 + Math.random() * 0.45}`);
        emoji.addEventListener("animationend", () => emoji.remove(), { once: true });
        emojiLayer.append(emoji);
    }

    function playDestruction() {
        if (canvas.width === 0 || destructionLayer.childElementCount > 0) {
            return;
        }
        projectionChannel?.postMessage({ type: "destroy-slide", page: currentPage });
        if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
            canvas.classList.add("is-reduced-destruction");
            window.setTimeout(() => canvas.classList.remove("is-reduced-destruction"), 450);
            return;
        }

        let image;
        try {
            image = canvas.toDataURL("image/png");
        } catch {
            canvas.classList.add("is-reduced-destruction");
            window.setTimeout(() => canvas.classList.remove("is-reduced-destruction"), 450);
            return;
        }

        const canvasBounds = canvas.getBoundingClientRect();
        const viewportBounds = viewport.getBoundingClientRect();
        const surface = document.createElement("div");
        const columns = 6;
        const rows = 4;
        surface.className = "destruction-surface";
        Object.assign(surface.style, {
            left: `${canvasBounds.left - viewportBounds.left}px`,
            top: `${canvasBounds.top - viewportBounds.top}px`,
            width: `${canvasBounds.width}px`,
            height: `${canvasBounds.height}px`,
        });

        for (let row = 0; row < rows; row += 1) {
            for (let column = 0; column < columns; column += 1) {
                const shard = document.createElement("span");
                const width = canvasBounds.width / columns;
                const height = canvasBounds.height / rows;
                shard.className = "slide-shard";
                Object.assign(shard.style, {
                    left: `${column * width}px`,
                    top: `${row * height}px`,
                    width: `${width + 1}px`,
                    height: `${height + 1}px`,
                    backgroundImage: `url(${image})`,
                    backgroundSize: `${canvasBounds.width}px ${canvasBounds.height}px`,
                    backgroundPosition: `${-column * width}px ${-row * height}px`,
                });
                const directionX = (column + 0.5) / columns - 0.5;
                const directionY = (row + 0.5) / rows - 0.5;
                const length = Math.hypot(directionX, directionY) || 1;
                const force = 260 + Math.random() * 260;
                shard.style.setProperty(
                    "--shard-x",
                    `${directionX / length * force + (-45 + Math.random() * 90)}px`,
                );
                shard.style.setProperty(
                    "--shard-y",
                    `${directionY / length * force + (-55 + Math.random() * 110)}px`,
                );
                shard.style.setProperty("--shard-z", `${100 + Math.random() * 330}px`);
                shard.style.setProperty("--shard-rotation", `${-220 + Math.random() * 440}deg`);
                shard.style.setProperty("--shard-rotation-x", `${-150 + Math.random() * 300}deg`);
                shard.style.setProperty("--shard-rotation-y", `${-150 + Math.random() * 300}deg`);
                shard.style.setProperty("--shard-delay", `${Math.random() * 45}ms`);
                surface.append(shard);
            }
        }

        const flash = document.createElement("span");
        flash.className = "explosion-flash";
        const shockwave = document.createElement("span");
        shockwave.className = "explosion-shockwave";
        destructionLayer.append(surface, flash, shockwave);

        const centerX = canvasBounds.left - viewportBounds.left + canvasBounds.width / 2;
        const centerY = canvasBounds.top - viewportBounds.top + canvasBounds.height / 2;
        const debrisColors = ["#fff7cf", "#ffd166", "#ff8c42", "#ef476f", "#dfe7ff"];
        for (let index = 0; index < 42; index += 1) {
            const debris = document.createElement("span");
            const angle = Math.random() * Math.PI * 2;
            const force = 130 + Math.random() * 330;
            const color = debrisColors[index % debrisColors.length];
            debris.className = "explosion-debris";
            debris.style.left = `${centerX}px`;
            debris.style.top = `${centerY}px`;
            debris.style.setProperty("--debris-x", `${Math.cos(angle) * force}px`);
            debris.style.setProperty("--debris-y", `${Math.sin(angle) * force}px`);
            debris.style.setProperty("--debris-size", `${3 + Math.random() * 9}px`);
            debris.style.setProperty("--debris-rotation", `${Math.random() * 720}deg`);
            debris.style.setProperty("--debris-delay", `${Math.random() * 90}ms`);
            debris.style.setProperty("--debris-color", color);
            debris.style.setProperty("--debris-glow", color);
            destructionLayer.append(debris);
        }

        canvas.classList.add("is-shattering");
        viewport.classList.remove("is-exploding");
        void viewport.offsetWidth;
        viewport.classList.add("is-exploding");
        shatterTimer = window.setTimeout(() => {
            destructionLayer.replaceChildren();
            canvas.classList.remove("is-shattering");
            viewport.classList.remove("is-exploding");
            shatterTimer = null;
        }, 2100);
    }

    function resetSlideState() {
        currentSlideReactionCount = 0;
        destructionPlayed = false;
        emojiLayer.replaceChildren();
        destructionLayer.replaceChildren();
        canvas.classList.remove("is-shattering", "is-reduced-destruction");
        viewport.classList.remove("is-exploding");
        if (shatterTimer !== null) {
            window.clearTimeout(shatterTimer);
            shatterTimer = null;
        }
        updateEffectState();
        projectionChannel?.postMessage({ type: "slide-reset", page: currentPage });
    }

    function captureSlideFrame(force = false) {
        if (
            !projectionChannel
            || !projectionWindow
            || projectionWindow.closed
            || canvas.width === 0
            || canvas.height === 0
            || frameCaptureInProgress
        ) {
            return;
        }

        const signature = [
            currentPageElement.textContent,
            totalPagesElement?.textContent,
            selectedFileName?.textContent,
            canvas.width,
            canvas.height,
        ].join(":");
        if (!force && signature === lastFrameSignature) {
            return;
        }

        frameCaptureInProgress = true;
        canvas.toBlob((blob) => {
            frameCaptureInProgress = false;
            if (!blob || !projectionWindow || projectionWindow.closed) {
                return;
            }
            lastFrameSignature = signature;
            projectionChannel.postMessage({
                type: "slide-frame",
                blob,
                currentPage: Number(currentPageElement.textContent) || 1,
                totalPages: Number(totalPagesElement?.textContent) || 0,
                fileName: selectedFileName?.textContent || "",
            });
        }, "image/png");
    }

    function scheduleProjectionFrameRetries() {
        frameRetryGeneration += 1;
        const generation = frameRetryGeneration;
        for (const delay of [180, 500, 1000, 1800]) {
            window.setTimeout(() => {
                if (generation === frameRetryGeneration) {
                    captureSlideFrame(true);
                }
            }, delay);
        }
    }

    async function openProjection() {
        const baseUrl = openProjectionButton?.dataset.projectionUrl;
        if (!baseUrl) {
            return;
        }
        const url = `${baseUrl}?roomId=${encodeURIComponent(roomId)}`;
        const availableWidth = window.screen.availWidth || window.innerWidth;
        const availableHeight = window.screen.availHeight || window.innerHeight;
        const popupWidth = Math.min(availableWidth, Math.max(720, Math.floor(availableWidth * 0.92)));
        const popupHeight = Math.min(availableHeight, Math.max(480, Math.floor(availableHeight * 0.92)));
        const popupLeft = (window.screen.availLeft || 0) + Math.floor((availableWidth - popupWidth) / 2);
        const popupTop = (window.screen.availTop || 0) + Math.floor((availableHeight - popupHeight) / 2);
        projectionWindow = window.open(
            url,
            `team15-projection-${roomId}`,
            [
                "popup=yes",
                `width=${popupWidth}`,
                `height=${popupHeight}`,
                `left=${popupLeft}`,
                `top=${popupTop}`,
            ].join(","),
        );
        if (!projectionWindow) {
            connectionStatus.textContent = "投影画面を開けません。ポップアップを許可してください";
            return;
        }
        projectionWindow.focus();
        connectionStatus.textContent = "別画面と接続中...";

        if ("getScreenDetails" in window && window.screen.isExtended) {
            try {
                const details = await window.getScreenDetails();
                const target = details.screens.find((screen) => screen !== details.currentScreen);
                if (target) {
                    projectionWindow.moveTo(target.availLeft, target.availTop);
                    projectionWindow.resizeTo(target.availWidth, target.availHeight);
                }
            } catch {
                // 権限がないブラウザでは手動移動を使う。
            }
        }
        window.setTimeout(() => captureSlideFrame(true), 350);
    }

    function openShareWindow() {
        const width = Math.min(960, window.screen.availWidth || 960);
        const height = Math.min(720, window.screen.availHeight || 720);
        const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
        const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
        const shareWindow = window.open(
            `/tutor/room/${encodeURIComponent(roomId)}/share`,
            `room-share-${roomId}`,
            `popup=yes,width=${width},height=${height},left=${left},top=${top}`,
        );

        if (!shareWindow) {
            connectionStatus.textContent = "共有画面を開けません。ポップアップを許可してください";
            return;
        }
        shareWindow.focus();
    }

    function setQrOverlay(open) {
        qrOverlay.hidden = !open;
        qrToggleButton.textContent = open ? "QRを閉じる" : "QR表示";
        qrToggleButton.setAttribute("aria-expanded", String(open));
        if (!open) {
            return;
        }

        qrUrl.textContent = `${window.location.origin}/room/${roomId}`;
        if (!qrImage.getAttribute("src")) {
            qrStatus.hidden = false;
            qrImage.hidden = true;
            qrImage.src = `/api/qrcreate/${encodeURIComponent(roomId)}`;
        }
        qrCloseButton.focus();
    }

    qrImage.addEventListener("load", () => {
        qrImage.hidden = false;
        qrStatus.hidden = true;
    });
    qrImage.addEventListener("error", () => {
        qrImage.hidden = true;
        qrStatus.hidden = false;
        qrStatus.textContent = "QRコードを表示できませんでした";
    });

    async function pollReactions() {
        if (polling) {
            return;
        }
        polling = true;
        try {
            const response = await fetch(`/api/reactions/room/${encodeURIComponent(roomId)}`, {
                cache: "no-store",
            });
            const data = await response.json();
            if (!response.ok) {
                throw new Error(data.error ?? "リアクションを取得できません");
            }

            const total = Math.max(0, Number(data.reactionCount) || 0);
            if (lastRoomReactionCount === null || total < lastRoomReactionCount) {
                lastRoomReactionCount = total;
            } else if (total > lastRoomReactionCount) {
                const difference = total - lastRoomReactionCount;
                currentSlideReactionCount += difference;
                for (let index = 0; index < Math.min(difference, MAX_EMOJIS_PER_POLL); index += 1) {
                    spawnEmoji();
                }
                lastRoomReactionCount = total;
                updateEffectState();
                projectionChannel?.postMessage({
                    type: "reaction",
                    amount: difference,
                    count: currentSlideReactionCount,
                    threshold: getThreshold(),
                    emojiEnabled: Boolean(emojiEnabled?.checked),
                });
            }

            consecutiveErrors = 0;
            connectionStatus.textContent = "リアクション同期中（1秒間隔）";
        } catch {
            consecutiveErrors += 1;
            if (consecutiveErrors >= 3) {
                connectionStatus.textContent = "リアクション同期を再接続中...";
            }
        } finally {
            polling = false;
        }
    }

    const pageObserver = new MutationObserver(() => {
        const nextPage = Number(currentPageElement.textContent) || 1;
        if (nextPage !== currentPage) {
            currentPage = nextPage;
            resetSlideState();
            scheduleProjectionFrameRetries();
        }
    });
    pageObserver.observe(currentPageElement, { childList: true, characterData: true, subtree: true });

    openProjectionButton?.addEventListener("click", () => void openProjection());
    openShareButton?.addEventListener("click", openShareWindow);
    qrToggleButton.addEventListener("click", () => setQrOverlay(qrOverlay.hidden));
    qrCloseButton.addEventListener("click", () => setQrOverlay(false));
    qrOverlay.addEventListener("click", (event) => {
        event.stopPropagation();
        if (event.target === qrOverlay) {
            setQrOverlay(false);
        }
    });
    const handleQrKeyboard = (event) => {
        if (qrOverlay.hidden) {
            return;
        }
        event.preventDefault();
        event.stopImmediatePropagation();
        if (event.key === "Escape") {
            setQrOverlay(false);
        }
    };
    document.addEventListener("keydown", handleQrKeyboard, { capture: true });
    window.addEventListener("presentation:slide-change", scheduleProjectionFrameRetries);

    projectionChannel?.addEventListener("message", (event) => {
        const message = event.data;
        if (!message || typeof message !== "object") {
            return;
        }
        if (message.type === "projection-ready") {
            connectionStatus.textContent = "別画面と同期中";
            scheduleProjectionFrameRetries();
            updateEffectState();
        } else if (message.type === "navigate") {
            if (message.direction === "next") {
                nextSlideButton?.click();
            } else if (message.direction === "previous") {
                previousSlideButton?.click();
            }
        } else if (message.type === "projection-closed") {
            projectionWindow = null;
            connectionStatus.textContent = "投影画面との接続を終了しました";
        }
    });

    // presentation.jsにも同じUIの処理があるため、キャプチャ段階で一度だけ開閉する。
    settingsToggle.addEventListener("click", (event) => {
        event.stopImmediatePropagation();
        const willOpen = settingsPanel.hidden;
        settingsPanel.hidden = !willOpen;
        settingsToggle.setAttribute("aria-expanded", String(willOpen));
    }, { capture: true });

    settingsPanel.addEventListener("submit", (event) => {
        event.preventDefault();
        event.stopImmediatePropagation();
        saveLocalSettings();
    }, { capture: true });

    previewReactionButton?.addEventListener("click", () => {
        currentSlideReactionCount += 1;
        spawnEmoji();
        updateEffectState();
    });

    previewDestructionButton?.addEventListener("click", () => {
        playDestruction();
    });

    document.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && !settingsPanel.hidden) {
            settingsPanel.hidden = true;
            settingsToggle.setAttribute("aria-expanded", "false");
        }
    });

    for (const input of [emojiEnabled, crackEnabled, destructionEnabled, thresholdInput]) {
        input?.addEventListener("change", updateEffectState);
    }

    loadLocalSettings();
    updateEffectState();
    const pollTimer = window.setInterval(() => void pollReactions(), POLL_INTERVAL_MS);
    const frameTimer = window.setInterval(() => captureSlideFrame(), 650);
    void pollReactions();
    window.addEventListener("beforeunload", () => {
        window.clearInterval(pollTimer);
        window.clearInterval(frameTimer);
        pageObserver.disconnect();
        shellObserver.disconnect();
        frameRetryGeneration += 1;
        window.removeEventListener("presentation:slide-change", scheduleProjectionFrameRetries);
        document.removeEventListener("keydown", handleQrKeyboard, { capture: true });
        projectionChannel?.close();
    }, { once: true });
})();
