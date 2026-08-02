# PDFプレゼンテーション バックエンド要件

## 目的

講師がルームごとにPDFスライドを登録し、ブラウザ上でプレゼンテーションできるようにする。

フロントエンドが管理する現在ページをバックエンドへ保存し、参加者画面や分析機能へリアルタイムに共有できる構造を作る。

PDF表示機能とリアルタイム同期は分離する。通信障害が発生しても、講師側のPDF表示とページ送りは継続できること。

## 現在のフロントエンド実装

- プレゼン画面：`GET /tutor/room/<room_id>/presentation`
- PDF.js：`pdfjs-dist`
- 実装言語：TypeScript
- PDFは現在、講師のブラウザ内だけで読み込む。
- ページ変更時にブラウザイベント `presentation:slide-change` を発行する。
- WebSocket、Socket.IO、PDFアップロードAPIは未接続。

現在のイベント形式：

```json
{
  "presentationId": "room-12",
  "currentPage": 4,
  "totalPages": 18,
  "timestamp": "2026-08-02T10:30:00.000Z"
}
```

バックエンド連携時は、`frontend/presentation/slide-sync.ts` の同期アダプターを差し替える。

## データ構造

```text
User 1 --- N Room 1 --- 0..1 Presentation
                         |
                         N SlideChangeLog（任意）
```

MVPでは、1つのルームに登録できるプレゼンテーションは1つとする。

### `Presentation`（新規）

| 項目 | 型 | 用途 | 必須 |
|---|---|---|---|
| `id` | Integer / PK | プレゼンテーションID | 必須 |
| `room_id` | Integer / FK / unique | 対象ルーム | 必須 |
| `original_filename` | Text | 画面表示用の元ファイル名 | 必須 |
| `storage_key` | Text / unique | 実際の保存先を表す推測困難なキー | 必須 |
| `content_type` | Text | `application/pdf` | 必須 |
| `file_size` | Integer | ファイルサイズ（byte） | 必須 |
| `total_pages` | Integer | PDFの総ページ数 | 必須 |
| `current_page` | Integer | 現在表示中のページ番号 | 必須、初期値1 |
| `status` | String / Enum | `ready`, `presenting`, `ended` | 必須 |
| `created_at` | DateTime | 作成日時 | 必須 |
| `updated_at` | DateTime | 最終更新日時 | 必須 |

制約：

```text
1 <= current_page <= total_pages
total_pages >= 1
file_size > 0
```

### `SlideChangeLog`（任意）

分析で「どのスライドのときにリアクションが多かったか」を扱う場合に追加する。

| 項目 | 型 | 用途 |
|---|---|---|
| `id` | Integer / PK | ログID |
| `presentation_id` | Integer / FK | 対象プレゼンテーション |
| `page` | Integer | 移動後のページ番号 |
| `changed_at` | DateTime | ページ変更時刻 |

すべてのキー入力を保存せず、実際にページ番号が変わった場合だけ記録する。

## Phase 1：PDFアップロードと取得

### `POST /api/room/<room_id>/presentation`

ルームへPDFを登録する。

- ログイン必須。
- 講師アカウントのみ許可する。
- `room.user_id == session["user_id"]` を確認する。
- `multipart/form-data`を使用する。
- フォーム項目名は`file`とする。
- PDFのみ許可する。
- 最大サイズはフロントと同じ50MBとする。
- 同じルームに既存PDFがある場合は置き換える。
- 置き換え時は古い保存ファイルを削除する。
- `current_page`は1、`status`は`ready`で初期化する。

#### 成功レスポンス例

```json
{
  "id": 7,
  "roomId": 12,
  "originalFilename": "network-04.pdf",
  "fileSize": 2458301,
  "totalPages": 18,
  "currentPage": 1,
  "status": "ready",
  "createdAt": "2026-08-02T10:00:00+09:00",
  "updatedAt": "2026-08-02T10:00:00+09:00"
}
```

#### ステータスコード

- 成功：`201`
- 未ログイン：`401`
- 講師ではない：`403`
- 他人のルーム：`404`推奨
- PDF以外、空ファイル、50MB超過、暗号化PDF：`400`
- 保存失敗：`500`

### `GET /api/room/<room_id>/presentation`

講師画面が登録済みプレゼンテーションのメタデータを取得する。

- ログイン必須。
- 講師かつルーム所有者のみ許可する。
- PDF本体ではなくメタデータをJSONで返す。
- 未登録なら`404`を返す。

#### 成功レスポンス例

```json
{
  "id": 7,
  "roomId": 12,
  "originalFilename": "network-04.pdf",
  "fileSize": 2458301,
  "totalPages": 18,
  "currentPage": 4,
  "status": "presenting",
  "fileUrl": "/api/presentation/7/file",
  "updatedAt": "2026-08-02T10:30:00+09:00"
}
```

### `GET /api/presentation/<presentation_id>/file`

PDF.jsが登録済みPDFを読み込むためのエンドポイント。

- ログイン必須。
- 講師かつ対象ルームの所有者のみ許可する。
- `Content-Type: application/pdf`を返す。
- `Content-Disposition: inline`を設定する。
- PDF.jsの部分取得に備えてHTTP Rangeリクエストへ対応することを推奨する。
- ファイルの公開URLを発行しない。
- `Cache-Control: private`を設定する。

### `DELETE /api/room/<room_id>/presentation`

登録済みPDFとプレゼンテーション情報を削除する。

- ログイン必須。
- 講師かつルーム所有者のみ許可する。
- DBレコードと保存ファイルの両方を削除する。
- 成功時は`204 No Content`を返す。

## Phase 2：現在ページの保存

### `PATCH /api/presentation/<presentation_id>/current-page`

講師がページを変更したときに現在ページを保存する。

- ログイン必須。
- 講師かつルーム所有者のみ許可する。
- `application/json`を使用する。
- ページ番号が変わった場合だけ更新する。
- 範囲外のページ番号は`400`を返す。
- 通信失敗時も講師側のページ送りを止めない。

#### リクエスト例

```json
{
  "currentPage": 4,
  "totalPages": 18,
  "timestamp": "2026-08-02T10:30:00.000Z"
}
```

`totalPages`は整合性確認用。DBに保存済みの値と異なる場合は`409`を返す。

#### 成功レスポンス例

```json
{
  "presentationId": 7,
  "roomId": 12,
  "currentPage": 4,
  "totalPages": 18,
  "status": "presenting",
  "updatedAt": "2026-08-02T10:30:00+09:00"
}
```

### `POST /api/presentation/<presentation_id>/start`

- `status`を`presenting`へ変更する。
- `current_page`を維持する。
- 講師かつルーム所有者のみ許可する。

### `POST /api/presentation/<presentation_id>/end`

- `status`を`ended`へ変更する。
- 最後に表示していた`current_page`は維持する。
- 講師かつルーム所有者のみ許可する。

## Phase 3：参加者向け状態取得

### `GET /api/room/<room_id>/presentation/state`

参加者が現在のスライド番号を取得する。

- ルームが開講中の場合は未ログインでも取得可能とする。
- PDF本体のURLや保存先は返さない。
- ルーム終了後は`410 Gone`または終了状態を返す。

#### 成功レスポンス例

```json
{
  "presentationId": 7,
  "roomId": 12,
  "currentPage": 4,
  "totalPages": 18,
  "status": "presenting",
  "updatedAt": "2026-08-02T10:30:00+09:00"
}
```

WebSocket導入前は、このAPIを数秒間隔でポーリングする方式でもよい。

## Phase 4：リアルタイム同期

現在のリポジトリにはWebSocket、Socket.IOともに存在しない。

導入する場合は`Flask-SocketIO`を使用し、HTTP APIとは独立して追加する。

### 接続とルーム参加

- 接続時に現在のセッションからユーザーを識別する。
- 講師は所有するルームのチャンネルへ参加する。
- 参加者は開講中ルームのチャンネルへ参加する。
- チャンネル名の例：`room:12`
- クライアントから任意のユーザーIDや所有者IDを信用しない。

### イベント

#### 講師からサーバー

```text
presentation:slide-change
```

```json
{
  "presentationId": 7,
  "roomId": 12,
  "currentPage": 4,
  "totalPages": 18,
  "timestamp": "2026-08-02T10:30:00.000Z"
}
```

サーバーは次を検証する。

- ログイン済みの講師か。
- 対象ルームの所有者か。
- `presentationId`と`roomId`の組み合わせが正しいか。
- ページ番号が範囲内か。

検証後にDBの現在ページを更新し、同じルームの参加者へ配信する。

#### サーバーから参加者

```text
presentation:slide-changed
```

```json
{
  "presentationId": 7,
  "roomId": 12,
  "currentPage": 4,
  "totalPages": 18,
  "timestamp": "2026-08-02T10:30:00.000Z"
}
```

### 再接続

- 再接続後、講師と参加者は対象ルームへ再参加する。
- サーバーはDBに保存された最新の`current_page`を返す。
- 講師側は接続復旧時に現在ページを再送してよい。
- 重複イベントを受信しても状態が壊れないよう、更新処理を冪等にする。

## PDF検証と保存

### 検証

- 拡張子`.pdf`を確認する。
- MIMEタイプ`application/pdf`を確認する。
- ファイル先頭のPDFシグネチャ`%PDF-`も確認する。
- 0 byteを拒否する。
- 50MBを超えるファイルを拒否する。
- 壊れたPDF、暗号化されたPDF、ページ数0のPDFを拒否する。
- サーバー側でも総ページ数を取得する。

Pythonでは`pypdf`などを利用して検証できる。

### 保存

- 元ファイル名を保存パスとして使用しない。
- UUIDなどの推測困難な`storage_key`を生成する。
- MVPではアプリ管理下の非公開ディレクトリへ保存してよい。
- `static`配下には保存しない。
- 本番環境ではAzure Blob Storageなどの非公開ストレージを使用する。
- DB保存とファイル保存の片方だけが成功しないよう、失敗時の後始末を行う。

## ルーム終了時の処理

`POST /api/room_close/<room_id>`または`POST /api/room/<room_id>`でルームを終了した場合：

- 関連する`Presentation.status`を`ended`にする。
- `current_page`は維持する。
- WebSocket利用時はプレゼン終了イベントを参加者へ配信する。
- PDFを即時削除するか、一定期間後に削除するかを設定で決める。

## セキュリティ要件

- PDFアップロード、取得、削除、ページ更新はログイン必須。
- 講師であることを`User.isTutor`で確認する。
- すべての講師用操作でルーム所有者を確認する。
- 他人のルームには存在を隠すため`404`を返すことを推奨する。
- 参加者へPDFファイルURLや保存キーを返さない。
- ファイルパスへユーザー入力を直接連結しない。
- アップロードサイズはFlaskの`MAX_CONTENT_LENGTH`でも制限する。
- エラーレスポンスへ内部ファイルパスを含めない。
- PDFをHTMLとして配信しない。

## インデックスと制約

- `presentations.room_id`にunique制約を付ける。
- `presentations.storage_key`にunique制約を付ける。
- `slide_change_logs.presentation_id`と`changed_at`にインデックスを付ける。
- ページ更新とログ追加は同一トランザクションで行う。

## 実装順序

### Phase 1

1. `Presentation`モデルとマイグレーション
2. PDFアップロードAPI
3. メタデータ取得API
4. 認証付きPDF取得API
5. フロントのローカルPDF読み込みをアップロード方式へ接続

### Phase 2

1. 現在ページ更新API
2. 開始・終了API
3. 参加者向け状態取得API
4. REST同期アダプターをフロントへ追加

### Phase 3

1. Flask-SocketIO導入
2. ルーム参加処理
3. スライド変更イベント
4. 再接続処理
5. 参加者画面との同期

### Phase 4

1. `SlideChangeLog`追加
2. リアクションとスライド番号の関連付け
3. スライド別リアクション集計

## MVP完了条件

- 講師が所有するルームへPDFを登録できる。
- PDF以外、空ファイル、50MB超過を拒否できる。
- 他人のルームへPDFを登録・取得できない。
- PDF.jsが保存済みPDFを表示できる。
- 総ページ数と現在ページを保存できる。
- 1ページ目より前、最終ページより後を保存できない。
- ページ変更時だけ現在ページが更新される。
- 参加者が現在ページを取得できる。
- 通信失敗時も講師側のページ送りが継続する。
- ルーム終了時にプレゼン状態も終了する。
- PDFの保存先が公開されない。

## テスト項目

### APIテスト

- 未ログインでアップロードできない。
- 学生アカウントでアップロードできない。
- 他人のルームへアップロードできない。
- 正常なPDFをアップロードできる。
- PDF以外、空、50MB超過、暗号化PDFを拒否する。
- 既存PDFを安全に置き換えられる。
- 現在ページを正常に更新できる。
- 0ページ、負数、最終ページ超過を拒否する。
- `totalPages`不一致を拒否する。
- ルーム終了後の更新を拒否する。

### リアルタイム同期テスト

- 講師のページ変更が同じルームの参加者だけへ届く。
- 別ルームへイベントが漏れない。
- 学生や他の講師がページ変更イベントを送信できない。
- 切断中も講師のプレゼンテーションが動作する。
- 再接続後に最新ページへ同期できる。
- 同じイベントを複数回処理しても状態が壊れない。

## 今回のバックエンド実装対象外

- PowerPointファイルの直接表示・PDF変換
- PDF内容の自動解析
- スライドごとの画像生成
- 複数PDFの同時プレゼンテーション
- 発表者ノート
- 外部クラウドへの公開リンク発行
