# 001: Adherence History (MVP)

## Overview
- Goal: 患者/家族が「飲んだ」（TAKEN）を記録し、当日の予定/履歴をカレンダーで閲覧できるようにする。
- Users: 患者、家族（代理記録）。
- Depends On:
  - Feature 000: Domain Policy (MVP共通仕様) に従う（TAKEN/MISSED/RESOLVED、連携解除、在庫、通知、TZ等）。
- In Scope (MVP):
  - 患者のTAKEN作成
  - 家族の代理TAKEN作成（recordedBy=family）
  - 当日表示（予定＋履歴）と月カレンダーのマーク表示（当日/月マーク程度）
  - 当日データ取得（予定＋履歴）
  - 履歴の期間指定取得（from/to）
  - cursor/limitによるページング
  - MISSED/RESOLVEDの表示・取得（自動生成ジョブは対象外）
- Out of Scope:
  - MISSED自動生成ジョブの実装（Feature 0xxで実装）
  - 週表示や高度な集計
  - オフラインキュー
  - 服用記録の修正/取り消し

---

## Authentication & Authorization (MVP)
### Authentication
- 家族（ios-family）は Supabase Auth（メール＋パスワード）でログインし、家族トークンでAPIアクセスする。
- 患者（ios-patient）は **連携コードのみ**で利用する。
  - 患者は連携コード入力によりサーバが **Patient Session**（patientSessionToken）を発行する。
  - 以後、ios-patient は patientSessionToken を用いてAPIアクセスする。
  - Patient Session の有効期限（MVP既定）: **30日**
  - 患者がログアウト/端末変更等でセッションを失った場合、再度家族から連携コードを発行してもらう（MVP）。

### Authorization (AuthZ boundary)
- 患者: 自分（patientId）のデータのみ作成/閲覧可能。
- 家族: 連携中の患者（patientId）に対してのみ閲覧/代理記録可能。
- 連携解除後: 解除した家族は **過去を含め**当該患者データへアクセス不可（Feature 000ポリシー）。

---

## Core Data Definitions (MVP)
### Time & Day Boundary (TZ)
- **患者のローカルタイムゾーン**に基づいて予定・当日・from/toを解釈する（Feature 000）。
- 当日（Today）= 患者TZの `00:00:00` 〜 `23:59:59`。
- from/to は患者TZの日付境界で **inclusive**（含む）とする。
- 家族が閲覧する場合も患者TZで解釈する（家族端末TZではない）。

### Dose / Schedule (予定)
- 予定は「時間帯（朝/昼/夜/眠前）」を、患者ごとに家族が設定した具体時刻へ変換したもの。
- 本featureでは「予定が計算可能である」前提で表示/取得/記録する（設定UI自体は別feature可）。

### Adherence History (履歴)
- 履歴は以下のイベントの集合:
  - TAKEN: 飲んだ記録
  - MISSED: 予定時刻から60分超でサーバが自動生成（表示対象）
  - RESOLVED: MISSED生成後にTAKENが作成され、MISSEDに `resolvedAt` が付与された状態（MISSEDは削除しない）

### recordedBy / recordedByUserId (重要)
- TAKENには必ず以下を保存する（Feature 000準拠）:
  - `recordedBy`: `patient | family`
  - `recordedByUserId`:
    - recordedBy=family の場合: **familyUserId（Supabase user id）**
    - recordedBy=patient の場合: **patientId**（患者はログインユーザーを持たないため）
- これにより「誰が押したか」を監査可能とする。

---

## Same Dose Key & Idempotency (MVP固定)
### Same Dose Key（同一予定の定義）
- 「同一予定（same dose）」は以下のキーで定義する:
  - `(patientId, medicationId, scheduledAt)`
  - `scheduledAt` は患者TZで確定した具体時刻（時間帯→時刻変換＋日付）であること。

### Duplicate policy（重複扱い）
- **同一予定**に対するTAKENは **1件のみ**とする。
- 重複リクエストには以下で対応する（Retry/Idempotencyと両立）:
  1) **同一 `Idempotency-Key`**（または `requestId`）で再送された場合:
     - 既存の結果を返す（冪等: 同じレスポンスを返す）
  2) `Idempotency-Key` が異なるが same dose key が一致する場合:
     - `error_code=DUPLICATE` で拒否（409相当）

### Concurrency / Race
- DBユニーク制約（または同等の排他）で same dose key を守る（planで具体化）。

---

## User Stories

### US1: 患者が「飲んだ」を記録する
- Description: 患者は自分の予定に対してTAKENを記録できる。
- Acceptance Criteria (AC):
  - [ ] 患者は当日予定に対してTAKENを作成できる（patientSessionTokenで認証）。
  - [ ] TAKENには `recordedBy=patient` と `recordedByUserId=patientId` が保存される。
  - [ ] 同一予定（(patientId, medicationId, scheduledAt)）に対する重複TAKENは拒否される（DUPLICATE）。
  - [ ] `Idempotency-Key` により再送時は冪等に処理され、同じ結果が返る。
  - [ ] 服用記録は作成後に修正/取り消し不可。
- Notes:
  - 予定時刻の算出は患者ごとの設定に従う（Feature 000ポリシー）。
  - 患者TZの日付境界で当日を判定する。

### US2: 家族が代理で「飲んだ」を記録する
- Description: 家族は連携中の患者に代わってTAKENを記録できる。
- Acceptance Criteria (AC):
  - [ ] 家族は連携中の患者に対してTAKENを作成できる（family tokenで認証）。
  - [ ] TAKENには `recordedBy=family` と `recordedByUserId=familyUserId` が保存される。
  - [ ] 同一予定に対する重複TAKENは拒否される（DUPLICATE）／再送は冪等。
  - [ ] 連携解除後は記録/閲覧ともに拒否される（過去含む）。
- Notes:
  - 代理記録はMVPでは常に許可とする（患者側での拒否設定は将来）。

### US3: 当日予定/履歴をカレンダーで閲覧する
- Description: 患者/家族は当日表示と月マークで予定/履歴を確認できる。
- Acceptance Criteria (AC):
  - [ ] 当日表示に、予定と履歴（TAKEN/MISSED/RESOLVED）が表示される。
  - [ ] 当日表示のソート順は、原則「scheduledAt昇順」（時系列）とする。
  - [ ] 月カレンダーには当日履歴の有無がマーク表示される（存在すればマーク）。
  - [ ] 患者は自分のみ、家族は連携中の患者のみ閲覧できる。
  - [ ] 連携解除後は家族の閲覧は拒否される（過去含む）。
- Notes:
  - 週表示や高度な集計は対象外。
  - 月マークは「その日に1件でも履歴があるか」のみ（MVP）。

### US4: 履歴を期間指定で取得する
- Description: 利用者は期間（from/to）を指定して履歴を取得できる。
- Acceptance Criteria (AC):
  - [ ] from/to を指定して履歴（TAKEN/MISSED/RESOLVED）を取得できる（患者TZの日付境界でinclusive）。
  - [ ] cursor/limit でページングできる。
  - [ ] 認可境界に反するアクセスは拒否される。
  - [ ] limit は既定 50、最大 200。200超は `LIMIT_EXCEEDED` とする。
  - [ ] cursor が不正/期限切れ/解釈不能な場合は `INVALID_CURSOR` とする。
- Notes:
  - from/to は日付境界で「含む」とする。
  - from > to は `INVALID_ARGUMENT`。

---

## Exception Paths (REQUIRED)
該当するものは必ず AC とテストに含める（Feature 000準拠）。
- [x] Authorization denied (権限なし)
- [x] Not found (存在しない)（patientId/medicationId/doseKey等）
- [x] Expired (期限切れ)（patientSessionTokenの期限切れ、連携コードの期限切れ等）
- [x] Duplicate (重複)（same dose keyの重複TAKEN）
- [x] Limit exceeded (上限超え)（limit>200 等）
- [x] Offline / network loss (通信断)（クライアント側エラーとして表示・再試行導線）
- [x] Retry / Idempotency (二重送信・リトライ耐性)（Idempotency-Key/再送）
- [x] Concurrency / Race (競合)（同時記録で重複しない）

---

## Data & PII
- Entities involved:
  - 家族ユーザー、患者、連携コード、服用予定（dose/schedule）、服用履歴（TAKEN/MISSED/RESOLVED）、カレンダーマーク
- PII fields (if any):
  - 家族メールアドレス、患者表示名、端末通知トークン、連携コード（機密）、patientSessionToken（機密）
- Redaction rule (logs/exports):
  - PII/機密（トークン/コード）はログ出力禁止。
  - 必要時は部分マスキング（例: メールはローカル部のみ、トークン/コードは完全マスク）。
- Data retention / deletion (feature-specific):
  - 連携解除は閲覧権限を剥奪するが、患者データ自体は保持する（Feature 000）。

---

## Non-Functional Minimums (feature-specific additions)
- Logging/Monitoring:
  - TAKEN作成/取得、認可拒否、DUPLICATE、INVALID_CURSOR を監査可能な粒度で記録（PIIなし）。
  - リクエストID（またはtrace/request id）を必須で付与/伝播。
- Security (AuthZ boundary):
  - 患者は自分のみ、家族は連携中の患者のみ。連携解除後は過去含めアクセス不可。
- Input validation:
  - doseKey（patientId/medicationId/scheduledAt）、from/to、cursor/limit、Idempotency-Key の形式と範囲を検証する。
- Error handling:
  - 安定した `error_code` とユーザー向け `message` を必須とし、失敗理由を区別できること。
- Performance:
  - 当日取得/履歴取得は95%が3秒以内に完了する。

---

## Contracts (API Draft / MVP)
> 具体のHTTPパス・スキーマは plan で確定するが、MVPの契約要件はここで固定する。

### 1) TAKEN作成
- Input（例）:
  - targetPatientId（家族代理の場合）
  - medicationId
  - scheduledAt（患者TZで確定した日時）
  - Idempotency-Key（推奨必須）
- Output:
  - adherenceEventId
  - status=TAKEN
  - recordedBy / recordedByUserId
  - createdAt
- Errors:
  - AUTHORIZATION_DENIED
  - NOT_FOUND
  - DUPLICATE
  - INVALID_ARGUMENT
  - EXPIRED（patientSession期限切れ等）

### 2) 当日取得（予定＋履歴）
- Input:
  - targetPatientId（家族の場合）
  - date（任意。省略時は患者TZの当日）
- Output:
  - doses[]（当日予定、scheduledAt、medication summary等）
  - events[]（TAKEN/MISSED/RESOLVED、timestamp/scheduledAt、recordedBy等）
  - ソート: doses/events は scheduledAt昇順（時系列）
- Errors:
  - AUTHORIZATION_DENIED
  - NOT_FOUND
  - INVALID_ARGUMENT
  - EXPIRED

### 3) 履歴取得（from/to + ページング）
- Input:
  - targetPatientId（家族の場合）
  - from（患者TZの日付）
  - to（患者TZの日付）
  - limit（既定50、最大200）
  - cursor（opaque）
- Output:
  - events[]（TAKEN/MISSED/RESOLVED）
  - nextCursor（次ページがある場合）
  - ソート: eventTime降順（新しい順）※cursorはこの順序に基づく
- Validation / Errors:
  - LIMIT_EXCEEDED（limit>200）
  - INVALID_CURSOR（cursor解釈不能/不正/期限切れ）
  - INVALID_ARGUMENT（from>to、範囲不正）
  - AUTHORIZATION_DENIED / NOT_FOUND / EXPIRED

### Error format (Fixed)
- すべてのエラーは以下を返す:
  - `error_code`（安定した識別子）
  - `message`（ユーザー向け文言）
  - （任意）`details`（開発者向け、PIIなし）

---

## Quickstart Requirements
この feature の quickstart.md に必ず含めること：
- seed/setup:
  - 家族ユーザー、患者、薬、当日予定、履歴（TAKEN/MISSED/RESOLVED）の最小セットを用意する。
- login:
  - 家族ログイン（メール＋パスワード）
  - 患者は連携コード入力により patientSessionToken を取得し利用できる状態を用意する
- steps:
  - 家族ログイン → 患者選択 → 当日表示（予定＋履歴）
  - 患者として「飲んだ」（TAKEN） → 当日表示に反映（recordedBy=patient）
  - 家族代理で「飲んだ」（TAKEN） → 当日表示に反映（recordedBy=family）
  - 履歴取得（from/to + cursor/limit）でページング確認
  - 連携解除後に家族の閲覧/記録が拒否されることを確認
- expected results:
  - TAKEN作成、重複拒否、冪等再送、当日表示、履歴取得、認可拒否、INVALID_CURSOR/ LIMIT_EXCEEDED が確認できる
- evidence:
  - 連携解除後のアクセス拒否、MISSED/RESOLVED表示、DUPLICATE/INVALID_CURSOR のログ or スクショ

---

## Open Questions
- None.
