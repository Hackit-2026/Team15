document.addEventListener("DOMContentLoaded", async () => {
  const roomsTitle = document.getElementById("roomsTitle");
  const roomsMessage = document.getElementById("roomsMessage");
  const roomsGrid = document.getElementById("roomsGrid");

  try {
    const meResponse = await fetch("/api/me");
    if (meResponse.ok) {
      const meData = await meResponse.json();
      if (meData.user?.username) {
        roomsTitle.textContent = `${meData.user.username}さんの科目一覧`;
      }
    }
  } catch {
    // ignore username fetch errors for now
  }

  try {
    const response = await fetch("/api/rooms", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ user_id: 1 }),
    });

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || "科目一覧の取得に失敗しました");
    }

    if (!Array.isArray(data) || data.length === 0) {
      roomsMessage.textContent = "科目が見つかりませんでした。";
      return;
    }

    roomsMessage.textContent = "";
    roomsGrid.innerHTML = data
      .map(
        (room) => `
          <div class="card">
            <h2>${room.name}</h2>
            <div class="card-footer">
              <a href="#" class="syllabus-link">授業詳細</a>
            </div>
          </div>
        `,
      )
      .join("");
  } catch (error) {
    roomsMessage.textContent = `科目一覧の取得に失敗しました: ${error.message}`;
  }
});
