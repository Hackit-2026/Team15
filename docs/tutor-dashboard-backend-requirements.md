# 講師ダッシュボード バックエンド要件

## 目的

`/tutor` の講師トップで、ログイン中の講師が所有する授業、開講中ルーム、最近の講義、リアクション集計を表示する。

フロントエンドは `GET /api/tutor/dashboard` を呼び出す前提で実装済み。

## 用語とデータ構造の変更（重要）

現在の `Room.name` だけでは、「ネットワーク基礎という授業」と「ネットワーク基礎の第3回講義」を区別できない。

今後は次のように分ける。

| 用語 | 意味 | 例 |
|---|---|---|
| `Course`（授業） | 複数回にわたって継続する科目 | ネットワーク基礎 |
| `Room`（講義ルーム） | ある授業の1回分の開講 | ネットワーク基礎・第3回 |
| `Reaction` | 開講中のルームへ送信された反応 | 第3回への「わからない」 |

リレーションは次の構造にする。

```text
User 1 --- N Course 1 --- N Room 1 --- N Reaction
```

- 授業は一度作成したら、次回以降も選択して使用する。
- ルーム作成時に `course_id` と `lecture_number`（第何回か）を必須にする。
- ダッシュボードや集計は授業単位と講義回単位の両方を扱えるようにする。
- 画面表示には `ネットワーク基礎 第3回` のような表示名を使用する。

## 最優先：授業管理API

### `POST /api/courses`

講師が継続して使用する授業を作成する。

- ログイン必須。
- 作成者は必ず `session["user_id"]` にする。
- `name` は必須。
- `total_lectures` は任意。未指定の場合は `null` とする。
  - MVPでは `(user_id, name)` を一意にし、同じ講師の同名授業には `409` を返す。
  - 
- リクエストは `application/json` とする。

#### リクエスト例

```json
{
  "name": "ネットワーク基礎",
  "total_lectures": 15
}
```

#### 成功レスポンス例

```json
{
  "id": 4,
  "name": "ネットワーク基礎",
  "total_lectures": 15,
  "next_lecture_number": 1,
  "created_at": "2026-08-02T09:00:00+09:00"
}
```

### `GET /api/courses`

ルーム作成画面の授業選択肢として使用する。

- ログイン中の講師が所有する授業だけを返す。
- 他の講師の授業を含めない。
- 各授業に `next_lecture_number` を含める。
- `next_lecture_number` は、原則として過去最大の `lecture_number + 1` とする。
- 一度も開講していない授業では `1` を返す。

#### 成功レスポンス例

```json
{
  "courses": [
    {
      "id": 4,
      "name": "ネットワーク基礎",
      "total_lectures": 15,
      "next_lecture_number": 4,
      "active_room": null
    }
  ]
}
```

### `POST /api/courses/<course_id>/rooms`

選択した授業の「第何回」を開講する。

- ログイン必須。
- `course.user_id == session["user_id"]` を必ず確認する。
- `lecture_number` は1以上の整数を必須とする。
- リクエストは `application/json` とする。
- `total_lectures` が設定されている場合、それを超える番号には確認可能な `400` エラーを返す。
- 同じ授業・同じ回の開講履歴が存在しても、補講や再実施のため作成自体は許可する。
- ただし、同じ授業・同じ回の開講中ルームが既にある場合は `409` を返し、二重作成を防ぐ。
- 作成直後のルームは開講中とする。

#### リクエスト例

```json
{
  "lecture_number": 4,
  "title": "TCPとUDP"
}
```

`title` は任意の講義回タイトル。未指定でもよい。

#### 成功レスポンス例

```json
{
  "id": 12,
  "course_id": 4,
  "course_name": "ネットワーク基礎",
  "lecture_number": 4,
  "title": "TCPとUDP",
  "display_name": "ネットワーク基礎 第4回",
  "isFinished": false,
  "started_at": "2026-08-02T09:00:00+09:00"
}
```

#### エラー

- 未ログイン：`401`
- 他人の授業、または存在しない授業：`404` 推奨
- 不正な回数：`400 {"error": "講義回は1以上の整数で指定してください"}`
- 同一回がすでに開講中：`409 {"error": "この講義回はすでに開講中です"}`

## 最優先：ダッシュボード取得API

### `GET /api/tutor/dashboard`

- ログイン必須。
- `session["user_id"]` のユーザーが所有するルームだけを返す。
- 他ユーザーのルームは絶対に含めない。
- 開講中のルームは `active_rooms` へ全件入れる。
- 最近の授業は `recent_rooms` へ新しい順で最大10件入れる。

#### 成功レスポンス例

```json
{
  "active_rooms": [
    {
      "id": 12,
      "course_id": 4,
      "course_name": "ネットワーク基礎",
      "lecture_number": 4,
      "title": "TCPとUDP",
      "display_name": "ネットワーク基礎 第4回",
      "isFinished": false,
      "started_at": "2026-08-02T09:00:00+09:00",
      "reaction_count": 18,
      "wakaran_count": 18
    }
  ],
  "recent_rooms": [
    {
      "id": 11,
      "course_id": 4,
      "course_name": "ネットワーク基礎",
      "lecture_number": 3,
      "title": "TCP/IP入門",
      "display_name": "ネットワーク基礎 第3回",
      "isFinished": true,
      "started_at": "2026-08-01T13:00:00+09:00",
      "reaction_count": 24,
      "wakaran_count": 24
    }
  ],
  "summary": {
    "active_room_count": 1,
    "total_room_count": 8,
    "total_reaction_count": 126,
    "most_confusing_room": {
      "id": 11,
      "course_id": 4,
      "course_name": "ネットワーク基礎",
      "lecture_number": 3,
      "display_name": "ネットワーク基礎 第3回",
      "wakaran_count": 24,
      "reaction_count": 24
    }
  }
}
```

#### エラー

- 未ログイン：`401 {"error": "ログインしてください"}`
- サーバーエラー：`500 {"error": "講義情報を取得できませんでした"}`

## 既存APIで必要な修正

### `POST /api/room`

現在のフロントが利用中の旧API。移行期間だけ互換性を維持する。

- リクエスト：`multipart/form-data`
- 必須項目：`name`
- 成功：`201`
- レスポンスに少なくとも `id`, `name`, `isFinished` を含める。
- 作成者は必ず `session["user_id"]` にする。
- 新しいフロント完成後は `POST /api/courses/<course_id>/rooms` を使用する。
- 旧APIを残す場合は、ログイン中の講師から同名の `Course` を検索し、なければ作成する。
- 旧APIで作る `Room.lecture_number` は、その授業の `next_lecture_number` を使用する。
- `Room.name` だけに授業名を保存する設計は段階的に廃止する。

### `GET /api/room_setting/<room_id>`

現状は認証と所有者確認がないため、次を追加する。

- `login_required` を適用。
- `room.course.user_id == session["user_id"]` を確認。
- 他人のルームなら `403` または存在を隠すため `404` を返す。

### `POST /api/room_close/<room_id>`

現状は認証と所有者確認がないため、次を追加する。

- `login_required` を適用。
- `room.course.user_id == session["user_id"]` を確認。
- 終了済みルームへの再実行でも状態が壊れないようにする。

## DBに必要な項目

### `Course`（新規）

| 項目 | 型 | 用途 | 優先度 |
|---|---|---|---|
| `id` | Integer / PK | 授業ID | 必須 |
| `name` | Text | 授業名 | 必須 |
| `user_id` | Integer / FK | 所有する講師 | 必須 |
| `total_lectures` | Integer / nullable | 全講義回数 | 推奨 |
| `created_at` | DateTime | 作成日時 | 必須 |
| `updated_at` | DateTime | 更新日時 | 推奨 |

### `Room`

| 項目 | 型 | 用途 | 優先度 |
|---|---|---|---|
| `course_id` | Integer / FK | どの授業の講義か | 必須 |
| `lecture_number` | Integer | 第何回の講義か | 必須 |
| `title` | Text / nullable | 各回の題名 | 任意 |
| `started_at` | DateTime | 開講日時、最近の講義の並び替え | 必須 |
| `finished_at` | DateTime / nullable | 講義終了日時と授業時間の集計 | 推奨 |

既存の `Room.user_id` は移行中は残してもよいが、最終的な所有者判定は `Room -> Course -> User` で一貫させる。二重に保持する場合は不整合を起こさないこと。

### マイグレーション方針

1. `courses` テーブルを追加する。
2. `rooms` に nullable の `course_id`, `lecture_number`, `title`, `started_at`, `finished_at` を追加する。
3. 既存の各 `Room` から、同じ `user_id` と `name` を持つ `Course` を作成する。
4. 既存ルームを作成日時順に並べ、授業ごとに `lecture_number` を1から採番する。現行DBには作成日時がないため、既存データは `Room.id` 順を作成順の代用にする。
5. データ移行後に `course_id` と `lecture_number` を必須へ変更する。

開発中にDBを作り直せる場合は、段階的マイグレーションではなく新スキーマで再作成してもよい。

### `Reaction`

| 項目 | 型 | 用途 | 優先度 |
|---|---|---|---|
| `created_at` | DateTime | 時系列と本日分の集計 | 必須 |

2026-08-02更新（学生側の仕様変更にあわせて修正）

学生側のボタンを「分からん」1つに絞ったため、`reaction_type` は不要になった。
リアクションはすべて「わからない」なので、種類別の集計という概念自体が無くなり、
`wakaran_count` は `reaction_count` と常に同じ値になる。
種類別集計を復活させたい場合は、先に学生画面へボタンを戻す必要がある。

`user_id`（nullable）はバックエンド側で対応済み。未ログインの学生も押せるため、
匿名の押下では `null` が入る。

残っているのは `created_at` だけで、これが無いと「何分の時点で押されたか」が
分からず、時系列グラフが作れない。

## 集計ルール

### 開講中の講義

```text
Room.course.user_id == session["user_id"]
AND Room.isFinished == false
```

1件に限定せず、該当するルームをすべて返す。

### 最近の授業

```text
Room.course.user_id == session["user_id"]
ORDER BY Room.started_at DESC
LIMIT 10
```

### 最も「わからない」が多かった講義

講師が所有する終了済みルームを対象に、リアクション件数が最も多いルームを返す。

学生側のボタンが「分からん」1つだけなので、リアクション総数がそのまま
「わからない」の件数になる。`wakaran_count` と `reaction_count` には同じ値を入れてよい。
フロントの `main.js` は `wakaran_count ?? reaction_count` の順に読むため、
どちらか一方だけを返しても表示は成立する。

## 今後の改善候補

- 授業ごとに講義タイトルや予定日を事前登録する。
- 第1回から最終回までの講義計画を一括作成する。
- 授業単位で全講義の「わからない率」を比較する。
- 参加者数を保存し、単純な件数ではなく「わからない率」を計算する。
- 実施日や期間を指定した集計を追加する。
- リアクションの時系列グラフ用APIを追加する。
- ダッシュボード応答のキャッシュを検討する。

## 完了条件

- 未ログインの `GET /api/tutor/dashboard` が `401` を返す。
- 講師が授業を作成し、その授業を次回以降も選択できる。
- ルーム作成時に第何回の講義かを指定できる。
- 他人の授業IDを指定してルームを作成できない。
- 同一授業・同一講義回の開講中ルームを二重作成できない。
- 終了済みの同じ講義回を補講として再度開講できる。
- 他ユーザーのルームがレスポンスに含まれない。
- 開講中ルームがある場合、`active_rooms` の先頭データがフロント最上部に表示される。
- 開講中ルームがない場合、`active_rooms` は空配列になる。
- ルームごとの集計値は、そのルームに紐づく `Reaction` だけを対象にする。
- 講師以外が他人のルーム管理・終了をできない。
