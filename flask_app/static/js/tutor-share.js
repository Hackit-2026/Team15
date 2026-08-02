const roomId = document.body.dataset.roomId;
const shareRoomName = document.getElementById("shareRoomName");
const shareRoomStatus = document.getElementById("shareRoomStatus");
const studentRoomUrl = document.getElementById("studentRoomUrl");
const copyRoomUrl = document.getElementById("copyRoomUrl");
const shareMessage = document.getElementById("shareMessage");
const roomQrCode = document.getElementById("roomQrCode");
const qrCodePlaceholder = document.getElementById("qrCodePlaceholder");

async function loadShareRoom() {
    studentRoomUrl.value = `${window.location.origin}/room/${roomId}`;

    try {
        const meResponse = await fetch("/api/me");
        const meData = await meResponse.json();
        if (!meResponse.ok || !meData.user?.isTutor) {
            window.location.href = "/tutor/login";
            return;
        }

        const response = await fetch(`/api/room/${roomId}`);
        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error ?? "ルーム情報を取得できませんでした");
        }

        shareRoomName.textContent = data.display_name ?? data.name;
        shareRoomStatus.textContent = data.isFinished ? "終了" : "開講中";
        shareRoomStatus.classList.toggle("is-finished", data.isFinished);
        roomQrCode.width = 320;
        roomQrCode.height = 320;
        roomQrCode.src = `/api/qrcreate?url=${encodeURIComponent(studentRoomUrl.value)}`;
        await loadSubjectList();
    } catch (error) {
        shareRoomName.textContent = "ルーム情報を取得できませんでした";
        shareRoomStatus.textContent = "取得失敗";
        shareRoomStatus.classList.add("is-finished");
        shareMessage.textContent = error.message;
    }

    roomQrCode.hidden = true;
    qrCodePlaceholder.hidden = false;
    qrCodePlaceholder.textContent = "QRコードAPIの準備後に表示されます";
}

roomQrCode.addEventListener("load", () => {
    roomQrCode.hidden = false;
    qrCodePlaceholder.hidden = true;
});

roomQrCode.addEventListener("error", () => {
    roomQrCode.hidden = true;
    qrCodePlaceholder.hidden = false;
    qrCodePlaceholder.textContent = "QRコードAPIの準備後に表示されます";
});

copyRoomUrl.addEventListener("click", async () => {
    try {
        await navigator.clipboard.writeText(studentRoomUrl.value);
        shareMessage.textContent = "参加者用URLをコピーしました";
    } catch {
        studentRoomUrl.select();
        shareMessage.textContent = "URLを選択しました。コピーしてください";
    }
});

async function loadSubjectList() {
    try {
        const response = await fetch("/api/rooms", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id: 1 }),
        });
        const rooms = await response.json();

        if (!response.ok) {
            throw new Error(rooms.error ?? "科目一覧を取得できませんでした");
        }

        const subjectList = document.getElementById("subjectList");
        subjectList.innerHTML = rooms.map(room => `<li>${room.name}</li>`).join("");
    } catch (error) {
        const subjectList = document.getElementById("subjectList");
        subjectList.innerHTML = `<li>取得失敗: ${error.message}</li>`;
    }
}

loadShareRoom();
