const roomId = document.body.dataset.roomId;
const roomName = document.getElementById("roomName");
const roomStatus = document.getElementById("roomStatus");
const openShareWindow = document.getElementById("openShareWindow");
const closeRoomForm = document.getElementById("closeRoomForm");
const closeRoomButton = document.getElementById("closeRoomButton");
const roomMessage = document.getElementById("roomMessage");
const tutorUsername = document.getElementById("tutorUsername");
const logoutLink = document.getElementById("logoutLink");
const accountMenu = document.querySelector(".account-menu");

async function loadTutor() {
    const response = await fetch("/api/");
    const data = await response.json();

    if (!data.user) {
        window.location.href = "/tutor/login";
        return false;
    }

    tutorUsername.textContent = data.user.username;
    return true;
}

async function loadRoom() {
    roomMessage.textContent = "";
    const response = await fetch(`/api/room_setting/${roomId}`);
    const data = await response.json();

    if (!response.ok) {
        roomName.textContent = "ルームが見つかりません";
        roomStatus.textContent = "読み込み失敗";
        roomStatus.classList.add("is-finished");
        roomMessage.textContent = data.error ?? "ルーム情報を取得できませんでした";
        closeRoomButton.disabled = true;
        openShareWindow.disabled = true;
        return;
    }

    roomName.textContent = data.name;
    roomStatus.textContent = data.isFinished ? "終了" : "開講中";
    roomStatus.classList.toggle("is-finished", data.isFinished);
    closeRoomButton.disabled = data.isFinished;
    openShareWindow.disabled = false;
}

openShareWindow.addEventListener("click", () => {
    const width = 960;
    const height = 720;
    const left = Math.max(0, window.screenX + (window.outerWidth - width) / 2);
    const top = Math.max(0, window.screenY + (window.outerHeight - height) / 2);
    const features = `popup=yes,width=${width},height=${height},left=${left},top=${top}`;
    const shareWindow = window.open(
        `/tutor/room/${roomId}/share`,
        `room-share-${roomId}`,
        features,
    );

    if (!shareWindow) {
        roomMessage.textContent = "共有ウィンドウを開けませんでした。ポップアップを許可してください";
        return;
    }

    shareWindow.focus();
});

closeRoomForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    roomMessage.textContent = "";

    const form = new FormData();
    form.append("is_finished", "true");
    const response = await fetch(`/api/room_close/${roomId}`, {
        method: "POST",
        body: form,
    });
    const data = await response.json();

    if (!response.ok) {
        roomMessage.textContent = data.error ?? "講義を終了できませんでした";
        return;
    }

    roomMessage.textContent = "講義を終了しました";
    await loadRoom();
});

logoutLink.addEventListener("click", async (event) => {
    event.preventDefault();
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

loadTutor().then((isLoggedIn) => {
    if (isLoggedIn) {
        loadRoom();
    }
});
