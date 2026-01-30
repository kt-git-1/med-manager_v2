# 000: Domain Policy (MVP共通仕様)

## Overview
- Goal: MVPにおける共通のドメインルール（認証/連携/服用記録/在庫/通知/表示範囲/非機能）を明文化し、各機能仕様の基準とする。
- Users: 患者、家族（代理記録を含む）、システム（自動処理）。
- In Scope:
  - 患者と家族の認証・連携ルール
  - 服用記録（TAKEN/MISSED/RESOLVED）の生成・状態遷移・不変条件
  - 予定時刻の決定（時間帯→時刻）
  - 在庫の減算/補充と警告の基本方針
  - 通知の対象と頻度（MVP範囲）
  - カレンダー表示の範囲（MVP範囲）
  - エラー形式、PII/ログ方針、非機能最小要件
- Out of Scope:
  - 週表示や高度な集計/分析
  - オフラインキュー
  - 未服用時の再通知
  - 取り消し/修正可能な服用記録
- Success Criteria:
  - 主要操作（連携/記録/在庫更新）の95%が3秒以内に完了する。
  - 予定時刻から60分超のMISSED生成が、超過後5分以内に完了する。
  - 連携解除後、家族による患者データ閲覧が100%拒否される。
  - 同一予定に対する重複TAKENが0件で維持される。
- Assumptions:
  - 予定時刻は患者のローカルタイムゾーンに基づく。
  - 低在庫しきい値（MVP既定値）は「3回分の服用相当量」。将来的に設定可能とする。
  - 上限：家族が管理できる患者数は10、患者の薬登録は200まで。超過時は error_code=LIMIT_EXCEEDED

### 用語定義
- TAKEN: 予定された服用に対して「飲んだ」が記録された状態。
- MISSED: 予定時刻から60分超過時に自動生成される未服用記録。
- RESOLVED: MISSEDが生成された後にTAKENが記録され、MISSEDに`resolvedAt`が付与された解消状態（MISSEDは削除しない）。
- 予定: 朝/昼/夜/眠前の時間帯を、患者ごとに家族が具体時刻へ変換したもの。
- 履歴: 服用記録（TAKEN/MISSED/RESOLVED）とその時刻・記録者情報の集合。
- 在庫: 薬剤ごとの現在数量（減算/補充を含む）。

### 状態遷移と不変条件
- 状態遷移:
  - 予定 → TAKEN（患者または家族の記録）
  - 予定 → MISSED（予定時刻から60分超で自動生成）
  - MISSED → RESOLVED（60分超後にTAKENが記録された場合、MISSEDは残し`resolvedAt`付与）
- 不変条件:
  - 服用記録（TAKEN/MISSED/RESOLVED）は修正/取り消し不可。
  - TAKEN記録には必ず`recordedBy`（patient/family）と`recordedByUserId`を保持。
  - MISSED記録では在庫を減算しない。
  - 連携解除後、家族は該当患者の過去を含む全データ閲覧不可（患者データは保持）。

### 認可境界
- 患者本人: 自分の服用記録の作成・閲覧が可能。
- 家族: 連携中の患者に対して、閲覧と代理の服用記録作成が可能。
- 連携解除後: 家族は当該患者の全履歴/在庫/予定/通知対象へのアクセス不可。

## User Stories
### US1: 家族が患者と連携する
- Description: 家族は連携コードを用いて患者と紐づき、以後患者の情報を管理できる。
- Acceptance Criteria (AC):
  - [ ] 有効な連携コードでのみ連携が成功する。
  - [ ] 連携コードはワンタイムで、患者登録後は再利用できない。
  - [ ] 期限切れ/無効なコードはエラーとなる。
  - [ ] 連携解除操作により、家族は過去を含む患者データ閲覧不可となる。
  - [ ] MAX_PATIENTS_PER_FAMILY 超過でエラー
- Notes: 連携解除は家族側UIから実施可能。

### US2: 患者が「飲んだ」を記録する
- Description: 患者は予定に対して服用記録を作成できる。
- Acceptance Criteria (AC):
  - [ ] 患者は予定時刻に対してTAKENを記録できる。
  - [ ] TAKENには`recordedBy=patient`と`recordedByUserId`が保存される。
  - [ ] 同一予定に対する重複TAKENは拒否される。
  - [ ] 服用記録は作成後に修正/取り消し不可。
- Notes: 予定時刻前後の記録許容幅は当日内とする。

### US3: 家族が代理で「飲んだ」を記録する
- Description: 家族は連携中の患者に代わって服用記録を作成できる。
- Acceptance Criteria (AC):
  - [ ] 家族は連携中の患者に対してTAKENを記録できる。
  - [ ] TAKENには`recordedBy=family`と`recordedByUserId`が保存される。
  - [ ] 連携解除後は記録/閲覧ともに拒否される。
- Notes: 代理記録の可否は患者単独でも否定しない（MVPは常に許可）。

### US4: 未服用の自動生成と解消
- Description: 予定時刻から60分超で未服用記録が生成され、後からTAKENが入ると解消扱いになる。
- Acceptance Criteria (AC):
  - [ ] 予定時刻から60分超でMISSEDが自動生成される。
  - [ ] MISSED生成後にTAKENが記録された場合、MISSEDは残し`resolvedAt`が付与される。
  - [ ] MISSEDは在庫減算を行わない。
- Notes: MISSEDの再通知はMVPでは行わない。

### US5: 在庫の自動減算と手動補充
- Description: 服用に応じて在庫が減り、家族が補充できる。
- Acceptance Criteria (AC):
  - [ ] TAKEN時のみ在庫が減算される。
  - [ ] 家族は在庫を手動で増やせる。
  - [ ] 在庫がしきい値未満の薬は警告表示され、一覧上部に表示される。
- Notes: しきい値の設定は将来拡張。MVPは既定値を使用。

### US6: 通知とカレンダー表示
- Description: 患者に対して予定時刻に通知し、当日・月表示で記録状況を把握できる。
- Acceptance Criteria (AC):
  - [ ] 患者にのみ予定時刻で1回通知される。
  - [ ] 通知タップで該当の「飲んだ」導線に遷移できる。
  - [ ] カレンダーは当日（日表示）と月カレンダーのマーク表示のみ提供する。
- Notes: 週表示や高度な集計は対象外。

## Exception Paths (REQUIRED)
該当するものは必ず AC とテストに含める。
- [x] Authorization denied (権限なし)
- [x] Not found (存在しない)
- [x] Expired (期限切れ)
- [x] Duplicate (重複)
- [x] Limit exceeded (上限超え)
- [x] Offline / network loss (通信断)
- [x] Retry / Idempotency (二重送信・リトライ耐性)
- [x] Concurrency / Race (競合)

## Data & PII
- Entities involved: 家族ユーザー、患者、連携コード、服用予定、服用記録、在庫、通知、カレンダーマーク。
- PII fields (if any): 家族メールアドレス、患者表示名、端末通知トークン、連携コード（機密）。
- Redaction rule (logs/exports): PIIはログ出力禁止。必要時は部分マスキング（例: メールはローカル部のみ保持、トークン/コードは完全マスク）。
- Data retention / deletion (feature-specific): 連携解除は閲覧権限を剥奪するが、患者データ自体は保持する。

## Non-Functional Minimums (feature-specific additions)
- Logging/Monitoring: 連携/記録/在庫更新/権限制御のイベントは監査可能な粒度で記録し、PIIは含めない。
- Security (AuthZ boundary): 認可境界に従い、患者/家族/未連携は必ず分離する。
- Input validation: 予定時刻、在庫数、連携コードの形式/有効期限を検証する。
- Error handling (error codes/messages): 安定した`error_code`とユーザー向け`message`を必須とし、失敗理由を区別できること。
- Performance targets (if any): 各feature specで測定可能な性能目標を必ず定義する。未定義の場合は「主要操作の95%が3秒以内完了」を最低基準とする。

## Contracts (if applicable)
- API / event contract summary: 連携、服用記録、在庫更新、未服用自動生成の各イベントが追跡可能であること。
- Error format summary: `error_code`（安定した識別子）と`message`（ユーザー向け文言）を返す。
- Pagination (cursor/limit etc): 履歴/在庫一覧は将来拡張を想定し、順序とページング方針を明示可能であること。
- AuthZ rules: 認可境界に準拠。連携解除後は過去データも含めてアクセス不可。

## Quickstart Requirements
この feature の quickstart.md に必ず含めること：
- seed/setup: 家族ユーザー、患者、薬、予定、在庫の最小セットを用意する。
- login: 家族ログインと患者の連携コード利用の導線を示す。
- steps: 連携 → 予定確認 → TAKEN記録 → MISSED自動生成 → 在庫補充 の順で確認できる。
- expected results: 連携可否、記録作成、未服用生成/解消、在庫警告の表示が確認できる。
- evidence (log/screenshot/screen recording if needed): 権限エラーとMISSED/RESOLVED状態が確認できる証跡。

## Open Questions
- None.
