const authStage = document.getElementById("authStage");
const loginFace = document.getElementById("loginFace");
const registerFace = document.getElementById("registerFace");
const tutorLoginForm = document.getElementById("tutorLoginForm");
const tutorRegisterForm = document.getElementById("tutorRegisterForm");
const loginMessage = document.getElementById("loginMessage");
const registerMessage = document.getElementById("registerMessage");
const loginUsername = document.getElementById("loginUsername");

function setFormBusy(form, isBusy) {
    form.querySelector("button[type='submit']").disabled = isBusy;
}

function setAuthMode(mode, shouldFocus = true) {
    const isRegister = mode === "register";
    authStage.classList.toggle("is-register", isRegister);
    loginFace.setAttribute("aria-hidden", String(isRegister));
    registerFace.setAttribute("aria-hidden", String(!isRegister));
    loginFace.inert = isRegister;
    registerFace.inert = !isRegister;

    const baseUrl = window.location.pathname + window.location.search;
    window.history.replaceState(null, "", isRegister ? `${baseUrl}#register` : baseUrl);

    if (shouldFocus) {
        window.setTimeout(() => {
            const target = isRegister
                ? document.getElementById("registerUsername")
                : loginUsername;
            target.focus();
        }, 360);
    }
}

document.getElementById("showRegisterButton").addEventListener("click", () => setAuthMode("register"));
document.getElementById("showRegisterMobileButton").addEventListener("click", () => setAuthMode("register"));
document.getElementById("showLoginButton").addEventListener("click", () => setAuthMode("login"));
document.getElementById("showLoginMobileButton").addEventListener("click", () => setAuthMode("login"));

tutorLoginForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    loginMessage.textContent = "";
    loginMessage.classList.remove("is-success");
    setFormBusy(tutorLoginForm, true);

    try {
        const response = await fetch("/api/login", {
            method: "POST",
            body: new FormData(tutorLoginForm),
        });
        const data = await response.json();

        if (!response.ok) {
            loginMessage.textContent = data.error ?? "ログインできませんでした";
            return;
        }

        const meResponse = await fetch("/api/me");
        const meData = await meResponse.json();
        if (!meResponse.ok || !meData.user?.isTutor) {
            await fetch("/api/logout", { method: "POST" });
            loginMessage.textContent = "講師アカウントでログインしてください";
            return;
        }

        window.location.href = "/tutor/";
    } catch {
        loginMessage.textContent = "通信に失敗しました。時間をおいて再度お試しください";
    } finally {
        setFormBusy(tutorLoginForm, false);
    }
});

tutorRegisterForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    registerMessage.textContent = "";
    registerMessage.classList.remove("is-success");

    const password = document.getElementById("registerPassword").value;
    const passwordConfirm = document.getElementById("registerPasswordConfirm").value;

    if (password !== passwordConfirm) {
        registerMessage.textContent = "確認用パスワードが一致しません";
        return;
    }

    setFormBusy(tutorRegisterForm, true);

    try {
        const response = await fetch("/api/register/tutor", {
            method: "POST",
            body: new FormData(tutorRegisterForm),
        });
        const data = await response.json();

        if (!response.ok) {
            registerMessage.textContent = data.error ?? "アカウントを作成できませんでした";
            return;
        }

        loginUsername.value = data.username;
        tutorRegisterForm.reset();
        setAuthMode("login", false);
        loginMessage.textContent = "アカウントを作成しました。パスワードを入力してください";
        loginMessage.classList.add("is-success");
        window.setTimeout(() => document.getElementById("loginPassword").focus(), 360);
    } catch {
        registerMessage.textContent = "通信に失敗しました。時間をおいて再度お試しください";
    } finally {
        setFormBusy(tutorRegisterForm, false);
    }
});

setAuthMode(window.location.hash === "#register" ? "register" : "login", false);
