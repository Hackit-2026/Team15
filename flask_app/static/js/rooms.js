const roomsMessage = document.getElementById("roomsMessage");
const roomsLoading = document.getElementById("roomsLoading");
const roomsGrid = document.getElementById("roomsGrid");
const roomsEmpty = document.getElementById("roomsEmpty");
const tutorUsername = document.getElementById("tutorUsername");
const logoutLink = document.getElementById("logoutLink");
const accountMenu = document.querySelector(".account-menu");
const filterButtons = [...document.querySelectorAll("[data-filter]")];

const totalRoomCount = document.getElementById("totalRoomCount");
const totalReactionCount = document.getElementById("totalReactionCount");
const averageReactionCount = document.getElementById("averageReactionCount");
const mostConfusingRoomName = document.getElementById("mostConfusingRoomName");
const mostConfusingRoomCount = document.getElementById("mostConfusingRoomCount");

let rooms = [];
let currentFilter = "all";

function createRoomCard(room, maximumReactionCount, rank) {
    const card = document.createElement("article");
    card.className = "analytics-room-card";
    card.dataset.status = room.isFinished ? "finished" : "active";

    const title = document.createElement("div");
    title.className = "analytics-room-card__title";
    const status = document.createElement("span");
    status.className = `room-status${room.isFinished ? " is-finished" : ""}`;
    status.textContent = room.isFinished ? "終了" : "開講中";
    const heading = document.createElement("h3");
    heading.textContent = `${rank}位  ${room.name}`;
    title.append(status, heading);

    const stat = document.createElement("div");
    stat.className = "reaction-stat";
    const number = document.createElement("div");
    number.className = "reaction-stat__number";
    const label = document.createElement("span");
    label.textContent = "わからん";
    const value = document.createElement("strong");
    value.textContent = `${room.reactionCount}件`;
    number.append(label, value);
    const bar = document.createElement("div");
    bar.className = "reaction-bar";
    const barValue = document.createElement("span");
    const ratio = maximumReactionCount > 0
        ? Math.max(4, (room.reactionCount / maximumReactionCount) * 100)
        : 0;
    barValue.style.setProperty("--reaction-width", `${ratio}%`);
    bar.append(barValue);
    stat.append(number, bar);

    const link = document.createElement("a");
    link.className = "analytics-room-card__link";
    link.href = `/tutor/room/${encodeURIComponent(room.id)}/detail`;
    link.textContent = "詳細へ →";

    card.append(title, stat, link);
    return card;
}

function updateEmptyState() {
    const visibleCount = roomsGrid.querySelectorAll(".analytics-room-card:not([hidden])").length;
    roomsEmpty.hidden = visibleCount > 0;
}

function applyFilter(filter) {
    currentFilter = filter;
    filterButtons.forEach((button) => {
        button.classList.toggle("is-active", button.dataset.filter === filter);
    });
    roomsGrid.querySelectorAll(".analytics-room-card").forEach((card) => {
        card.hidden = filter !== "all" && card.dataset.status !== filter;
    });
    updateEmptyState();
}

function renderStatistics() {
    const totalReactions = rooms.reduce((total, room) => total + room.reactionCount, 0);
    const mostConfusing = rooms[0] ?? null;
    totalRoomCount.textContent = String(rooms.length);
    totalReactionCount.textContent = String(totalReactions);
    averageReactionCount.textContent = rooms.length > 0
        ? (totalReactions / rooms.length).toFixed(1)
        : "0";
    mostConfusingRoomName.textContent = mostConfusing?.reactionCount > 0
        ? mostConfusing.name
        : "まだデータがありません";
    mostConfusingRoomCount.textContent = `${mostConfusing?.reactionCount ?? 0}件の反応`;
}

function renderRooms() {
    const maximumReactionCount = rooms[0]?.reactionCount ?? 0;
    roomsGrid.replaceChildren(
        ...rooms.map((room, index) => createRoomCard(room, maximumReactionCount, index + 1)),
    );
    roomsLoading.hidden = true;
    roomsGrid.hidden = rooms.length === 0;
    applyFilter(currentFilter);
    renderStatistics();
}

async function loadReactionCount(roomId) {
    try {
        const response = await fetch(`/api/reactions/room/${encodeURIComponent(roomId)}`);
        const data = await response.json();
        return response.ok ? Number(data.reactionCount) || 0 : 0;
    } catch {
        return 0;
    }
}

async function loadRooms() {
    roomsMessage.textContent = "";
    roomsLoading.hidden = false;
    roomsGrid.hidden = true;
    roomsEmpty.hidden = true;

    try {
        const meResponse = await fetch("/api/me");
        const meData = await meResponse.json();
        if (!meResponse.ok || !meData.user?.isTutor) {
            window.location.href = "/tutor/login";
            return;
        }
        tutorUsername.textContent = meData.user.username;

        const roomsResponse = await fetch(
            `/api/rooms?user_id=${encodeURIComponent(meData.user.id)}`,
        );
        const roomData = await roomsResponse.json();
        if (!roomsResponse.ok || !Array.isArray(roomData)) {
            throw new Error(roomData.error ?? "講義一覧を取得できませんでした");
        }

        rooms = await Promise.all(roomData.map(async (room) => ({
            ...room,
            reactionCount: await loadReactionCount(room.id),
        })));
        rooms.sort((a, b) => b.reactionCount - a.reactionCount || Number(b.id) - Number(a.id));
        renderRooms();
    } catch (error) {
        roomsLoading.hidden = true;
        roomsMessage.textContent = error.message ?? "統計データを取得できませんでした";
    }
}

filterButtons.forEach((button) => {
    button.addEventListener("click", () => applyFilter(button.dataset.filter));
});

logoutLink.addEventListener("click", async () => {
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/tutor/login";
});

document.addEventListener("click", (event) => {
    if (!accountMenu.contains(event.target)) {
        accountMenu.removeAttribute("open");
    }
});

document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
        accountMenu.removeAttribute("open");
    }
});

void loadRooms();
