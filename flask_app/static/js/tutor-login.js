const tutorLoginForm = document.getElementById("tutorLoginForm");
const loginMessage = document.getElementById("loginMessage");

tutorLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.textContent = "";

    const response = await fetch("/api/login", {
        method: "POST",
        body: new FormData(tutorLoginForm),
    });
    const data = await response.json();

    if (!response.ok) {
        loginMessage.textContent = data.error ?? "ログインできませんでした";
        return;
    }

    window.location.href = "/tutor/";
});
