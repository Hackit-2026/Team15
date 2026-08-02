const roomCreator = document.getElementById("roomCreator");
const roomCreatorForm = document.getElementById("roomCreatorForm");
const roomNameInput = document.getElementById("roomName");
const roomCreatorMessage = document.getElementById("roomCreatorMessage");
const mobileRoomCreatorLayer = document.getElementById("mobileRoomCreatorLayer");
const mobileRoomCreatorBackdrop = document.getElementById("mobileRoomCreatorBackdrop");
const mobileRoomCreatorForm = document.getElementById("mobileRoomCreatorForm");
const mobileRoomNameInput = document.getElementById("mobileRoomName");
const mobileRoomCreatorMessage = document.getElementById("mobileRoomCreatorMessage");
const mobileRoomCreatorToggle = document.getElementById("mobileRoomCreatorToggle");
const headerTutorUsername = document.getElementById("headerTutorUsername");
const dashboardTutorUsername = document.getElementById("dashboardTutorUsername");
const logoutLink = document.getElementById("logoutLink");
const dashboardMessage = document.getElementById("dashboardMessage");
const dashboardLoading = document.getElementById("dashboardLoading");
const dashboardUnavailable = document.getElementById("dashboardUnavailable");
const dashboardUnavailableMessage = document.getElementById("dashboardUnavailableMessage");
const retryDashboardButton = document.getElementById("retryDashboardButton");
const activeRoomList = document.getElementById("activeRoomList");
const noActiveRoom = document.getElementById("noActiveRoom");
const recentRoomTable = document.getElementById("recentRoomTable");
const recentRoomList = document.getElementById("recentRoomList");
const recentRoomEmpty = document.getElementById("recentRoomEmpty");
const activeRoomCount = document.getElementById("activeRoomCount");
const totalReactionCount = document.getElementById("totalReactionCount");
const mostConfusingRoomName = document.getElementById("mostConfusingRoomName");
const mostConfusingRoomCount = document.getElementById("mostConfusingRoomCount");
const activeRoomTemplate = document.getElementById("activeRoomTemplate");
const recentRoomRowTemplate = document.getElementById("recentRoomRowTemplate");
const headerCreateButton = document.querySelector(".header-create-button");
const headerCreateButtonLabel = headerCreateButton.querySelector(".header-create-button__label");
const accountMenu = document.querySelector(".account-menu");
const mobileViewport = window.matchMedia("(max-width: 800px)");

function setDesktopRoomCreatorOpen(isOpen, shouldFocus = true) {
    roomCreator.classList.toggle("is-open", isOpen);
    roomCreator.setAttribute("aria-hidden", String(!isOpen));
    roomCreator.inert = !isOpen;
    document.body.classList.toggle("is-desktop-room-creator-open", isOpen);
    headerCreateButton.setAttribute("aria-expanded", String(isOpen));
    headerCreateButton.setAttribute("aria-label", isOpen ? "ルーム作成を閉じる" : "ルームを作成");
    headerCreateButtonLabel.textContent = isOpen ? "閉じる" : "ルームを作成";
    if (isOpen && shouldFocus) {
        window.setTimeout(() => roomNameInput.focus(), 180);
    }
}

function setMobileRoomCreatorOpen(isOpen, shouldFocus = true) {
    mobileRoomCreatorLayer.classList.toggle("is-open", isOpen);
    mobileRoomCreatorLayer.setAttribute("aria-hidden", String(!isOpen));
    mobileRoomCreatorLayer.inert = !isOpen;
    document.body.classList.toggle("is-mobile-room-creator-open", isOpen);
    mobileRoomCreatorToggle.setAttribute("aria-expanded", String(isOpen));
    mobileRoomCreatorToggle.setAttribute(
        "aria-label",
        isOpen ? "ルーム作成を閉じる" : "ルームを作成",
    );
    if (isOpen && shouldFocus) {
        window.setTimeout(() => mobileRoomNameInput.focus(), 280);
    }
}

function openRoomCreator(shouldFocus = true) {
    if (mobileViewport.matches) {
        setMobileRoomCreatorOpen(true, shouldFocus);
        return;
    }
    setDesktopRoomCreatorOpen(true, shouldFocus);
}

function showDashboardState(state, message = "") {
    dashboardLoading.hidden = state !== "loading";
    activeRoomList.hidden = state !== "active";
    noActiveRoom.hidden = state !== "empty";
    dashboardUnavailable.hidden = state !== "error";
    dashboardUnavailableMessage.textContent = message;
}

function formatDate(value) {
    if (!value) {
        return "日時未登録";
    }

    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
        return "日時未登録";
    }

    return new Intl.DateTimeFormat("ja-JP", {
        year: "numeric",
        month: "short",
        day: "numeric",
    }).format(date);
}

async function copyRoomUrl(roomId) {
    const url = `${window.location.origin}/room/${roomId}`;

    try {
        await navigator.clipboard.writeText(url);
        dashboardMessage.textContent = "参加者用URLをコピーしました";
    } catch {
        dashboardMessage.textContent = `参加者用URL: ${url}`;
    }
}

function renderActiveRooms(rooms) {
    activeRoomList.replaceChildren();

    rooms.forEach((room) => {
        const card = activeRoomTemplate.content.firstElementChild.cloneNode(true);
        card.querySelector(".js-room-name").textContent = room.name;
        card.querySelector(".js-room-id").textContent = room.id;
        card.querySelector(".js-reaction-count").textContent = room.reaction_count ?? 0;

        const copyButton = card.querySelector(".js-copy-room-url");
        copyButton.addEventListener("click", () => copyRoomUrl(room.id));

        const manageLink = card.querySelector(".js-manage-room");
        manageLink.href = `/tutor/room/${room.id}`;
        activeRoomList.append(card);
    });
}

function renderRecentRooms(rooms) {
    recentRoomList.replaceChildren();
    recentRoomTable.hidden = rooms.length === 0;
    recentRoomEmpty.hidden = rooms.length !== 0;

    rooms.forEach((room) => {
        const row = recentRoomRowTemplate.content.firstElementChild.cloneNode(true);
        row.querySelector(".js-room-name").textContent = room.name;
        row.querySelector(".js-reaction-count").textContent = room.reaction_count ?? 0;
        row.querySelector(".js-created-at").textContent = formatDate(room.created_at);

        const status = row.querySelector(".js-room-status");
        status.textContent = room.isFinished ? "終了" : "開講中";
        status.classList.toggle("is-finished", room.isFinished);

        const manageLink = row.querySelector(".js-manage-room");
        manageLink.href = `/tutor/room/${room.id}`;
        recentRoomList.append(row);
    });
}

function renderOverview(summary, activeRooms) {
    const mostConfusing = summary.most_confusing_room;
    activeRoomCount.textContent = summary.active_room_count ?? activeRooms.length;
    totalReactionCount.textContent = summary.total_reaction_count ?? 0;

    if (mostConfusing) {
        mostConfusingRoomName.textContent = mostConfusing.name;
        mostConfusingRoomCount.textContent = `${mostConfusing.wakaran_count ?? mostConfusing.reaction_count ?? 0}件の反応`;
        return;
    }

    mostConfusingRoomName.textContent = "データなし";
    mostConfusingRoomCount.textContent = "—件の反応";
}

function renderDashboard(data) {
    const activeRooms = Array.isArray(data.active_rooms) ? data.active_rooms : [];
    const recentRooms = Array.isArray(data.recent_rooms) ? data.recent_rooms : [];
    const summary = data.summary ?? {};

    renderOverview(summary, activeRooms);
    renderRecentRooms(recentRooms);

    if (activeRooms.length > 0) {
        renderActiveRooms(activeRooms);
        showDashboardState("active");
        return;
    }

    showDashboardState("empty");
    openRoomCreator(false);
}

async function loadTutor() {
    try {
        const response = await fetch("/api/me");
        const data = await response.json();

        if (!response.ok || !data.user?.isTutor) {
            if (data.user && !data.user.isTutor) {
                await fetch("/api/logout", { method: "POST" });
            }
            window.location.href = "/tutor/login";
            return false;
        }

        headerTutorUsername.textContent = data.user.username;
        dashboardTutorUsername.textContent = data.user.username;
        return true;
    } catch {
        dashboardMessage.textContent = "ログイン情報を確認できませんでした";
        return false;
    }
}

async function loadDashboard() {
    dashboardMessage.textContent = "";
    retryDashboardButton.hidden = true;
    showDashboardState("error", "講義一覧APIは現在準備中です。ルーム作成は利用できます。");
}

headerCreateButton.addEventListener("click", () => {
    setDesktopRoomCreatorOpen(!roomCreator.classList.contains("is-open"));
});

mobileRoomCreatorToggle.addEventListener("click", () => {
    setMobileRoomCreatorOpen(!mobileRoomCreatorLayer.classList.contains("is-open"));
});

mobileRoomCreatorBackdrop.addEventListener("click", () => {
    setMobileRoomCreatorOpen(false);
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        accountMenu.removeAttribute("open");
        if (roomCreator.classList.contains("is-open")) {
            setDesktopRoomCreatorOpen(false);
        }
        if (mobileRoomCreatorLayer.classList.contains("is-open")) {
            setMobileRoomCreatorOpen(false);
        }
    }
});

document.addEventListener("click", (event) => {
    if (!accountMenu.contains(event.target)) {
        accountMenu.removeAttribute("open");
    }
});

async function submitRoomCreator(event, form, messageElement) {
    event.preventDefault();
    messageElement.textContent = "";

    const submitButton = form.querySelector("button[type='submit']");
    submitButton.disabled = true;

    try {
        const response = await fetch("/api/room", {
            method: "POST",
            body: new FormData(form),
        });
        const data = await response.json();

        if (response.status === 401) {
            window.location.href = "/tutor/login";
            return;
        }

        if (!response.ok) {
            messageElement.textContent = data.error ?? "ルームを作成できませんでした";
            return;
        }

        window.location.href = `/tutor/room/${data.id}`;
    } catch {
        messageElement.textContent = "通信に失敗しました。再度お試しください";
    } finally {
        submitButton.disabled = false;
    }
}

roomCreatorForm.addEventListener("submit", (event) => {
    submitRoomCreator(event, roomCreatorForm, roomCreatorMessage);
});

mobileRoomCreatorForm.addEventListener("submit", (event) => {
    submitRoomCreator(event, mobileRoomCreatorForm, mobileRoomCreatorMessage);
});

mobileViewport.addEventListener("change", () => {
    roomCreatorForm.reset();
    mobileRoomCreatorForm.reset();
    roomCreatorMessage.textContent = "";
    mobileRoomCreatorMessage.textContent = "";
    setDesktopRoomCreatorOpen(false, false);
    setMobileRoomCreatorOpen(false, false);
});

retryDashboardButton.addEventListener("click", loadDashboard);

logoutLink.addEventListener("click", async (event) => {
    event.preventDefault();
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/tutor/login";
});

loadTutor().then((isLoggedIn) => {
    if (isLoggedIn) {
        loadDashboard();
    }
});

setDesktopRoomCreatorOpen(false, false);
setMobileRoomCreatorOpen(false, false);
