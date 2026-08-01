const roomCreator = document.getElementById("roomCreator");
const roomCreatorToggle = document.getElementById("roomCreatorToggle");
const roomCreatorForm = document.getElementById("roomCreatorForm");
const roomCreatorCancel = document.getElementById("roomCreatorCancel");
const roomNameInput = document.getElementById("roomName");
const roomCreatorMessage = document.getElementById("roomCreatorMessage");
const tutorUsername = document.getElementById("tutorUsername");
const logoutLink = document.getElementById("logoutLink");

async function loadTutor() {
    const response = await fetch("/api/");
    const data = await response.json();

    if (!data.user) {
        window.location.href = "/tutor/login";
        return;
    }

    tutorUsername.textContent = data.user.username;
}

function setRoomCreatorOpen(isOpen) {
    roomCreator.classList.toggle("is-open", isOpen);
    roomCreatorToggle.setAttribute("aria-expanded", String(isOpen));

    if (isOpen) {
        roomNameInput.focus();
    }
}

roomCreatorToggle.addEventListener("click", () => {
    setRoomCreatorOpen(!roomCreator.classList.contains("is-open"));
});

roomCreatorCancel.addEventListener("click", () => {
    roomCreatorForm.reset();
    roomCreatorMessage.textContent = "";
    setRoomCreatorOpen(false);
});

roomCreatorForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    roomCreatorMessage.textContent = "";
    const response = await fetch("/api/room", {
        method: "POST",
        body: new FormData(roomCreatorForm),
    });
    const data = await response.json();

    if (response.status === 401) {
        window.location.href = "/tutor/login";
        return;
    }

    if (!response.ok) {
        roomCreatorMessage.textContent = data.error ?? "ルームを作成できませんでした";
        return;
    }

    window.location.href = `/tutor/room/${data.id}`;
});

logoutLink.addEventListener("click", async (event) => {
    event.preventDefault();
    await fetch("/api/logout", { method: "POST" });
    window.location.href = "/tutor/login";
});

loadTutor();
