<!--
Sync Impact Report:
- Version change: 0.1.0 -> 0.1.1
- Modified principles:
  - II: Clarification gate now includes explicit stop-the-line rule when new ambiguity appears.
  - III: Added explicit definitions for contract tests vs integration tests, and clarified iOS verification evidence.
  - IV: Expanded exception paths to include idempotency/retry and concurrency where applicable.
  - V: DoD now defines “CI green” minimum checks per module and requires quickstart evidence.
- Added sections:
  - Standard Paths & Single-Source Locations (to prevent “where is the truth?” drift)
  - Test Taxonomy (formal definitions)
  - Emergency Fix Protocol (tight exception handling without vibe drift)
  - Data Retention & Auditability minimums
- Removed sections: None
- Templates requiring updates: ✅ .specify/templates/plan-template.md, ✅ .specify/templates/spec-template.md, ✅ .specify/templates/tasks-template.md
-->
# Med Manager v2 Constitution

この文書は、処方薬管理アプリ（web-api + ios-patient + ios-family）における
Spec-Driven Development（SDD）を破綻させないための「憲法」です。
**Spec が唯一の真実（Single Source of Truth）**であり、実装は常に spec/plan/tasks と同期します。

---

## Core Principles

### I. Spec Is the Single Source of Truth (NON-NEGOTIABLE)
- すべての機能詳細は **spec/plan/tasks** に置く（API/UI/DB の詳細は **constitution には書かない**）。
- **コードや実装意図が spec/plan/tasks とズレたら、先に spec を更新してからコードを更新**する。
- 実装差分（仕様の追加・変更・例外分岐・制約増）は **必ず spec/plan/tasks へ折り返してから前に進む**。
- constitution は **原則・ゲート・成果物責務・最低基準**のみを定義する。

### II. Clarification Gate Before Planning (STOP-THE-LINE)
- `[NEEDS CLARIFICATION]` は **0件**になってから `/plan` に進む。
- 進行中に新たな曖昧さが発生した場合、**その場で作業を止め**、`spec -> clarify` に戻る。
- 「推測で埋めて前に進む」ことは禁止（vibe drift の起点）。

### III. Test-First Workflow & Verification Order
- tasks は必ず **tests added -> implementation -> verification** の順で並べる。
- **テスト無しの実装タスクは作らない**（例外は Emergency Fix Protocol に限定）。

#### Web API（最低ライン）
- web-api は最低限 **contract tests** と **integration tests** を必須とする。

#### iOS（最低ライン）
- iOS（ios-patient / ios-family）は最低限 **build verification** と
  **primary user-flow check** を必須とする。
- primary user-flow check は **quickstart.md に手順と期待結果を記載**し、
  DoD で「実施済み」をチェックする（証跡はログ/スクショ/画面録画のいずれか1つを推奨）。

### IV. Exception Paths Are Requirements
以下は「例外」ではなく **要件**であり、該当する場合は **Acceptance Criteria（AC）** と **テスト**に含める：

- Authorization denied（権限なし）
- Not found（存在しない）
- Expired（期限切れ）
- Duplicate（重複）
- Limit exceeded（上限超え）
- Offline / network loss（オフライン・通信断）
- Retry / Idempotency（二重送信・リトライ耐性が必要な箇所）
- Concurrency / Race（同時操作や競合が起きる箇所）

### V. Quickstart + DoD + Change-Request Loop
- すべての feature は **手動でも再現可能な Quickstart** を必須とする
  （seed/login/steps/expected results を含む）。
- **Definition of Done（DoD）は固定**で、満たさない限り feature 完了にしない。
- 変更要求（CR）が出たら、必ず **spec -> clarify -> plan -> tasks -> analyze -> implement** に戻る。

---

## Standard Paths & Single-Source Locations (Anti-Drift)

「どこが真実か」を迷子にしないため、成果物の標準配置を固定する。

### Feature Specs（推奨標準）
- `specs/<feature-id>-<slug>/`
  - `spec.md`
  - `plan.md`
  - `tasks.md`
  - `quickstart.md`
  - （任意）`contracts/`（そのfeature専用の契約がある場合）

> 例：`specs/001-adherence-history/spec.md`

### Contracts（配置ルール）
- 原則：**contracts は “誰が消費するか” で置き場所を統一する**
  - web-api の外部契約（OpenAPI/Schema 等）: `web-api/contracts/` もしくは `specs/.../contracts/`
  - どちらにするかプロジェクトで **1つに統一**し、例外を作らない。

### Single Source（最新版ルール）
- 要件：`spec.md`
- 技術方針・リスク・設計判断：`plan.md`
- 実行可能な作業分割（tests→impl→verify）：`tasks.md`
- 検証導線：`quickstart.md`
- 実装：`code/` と `tests/`（ただし spec と矛盾する場合は spec を更新してから）

---

## Gates & Deliverable Ownership

### Gates (hard checks)
- [ ] **Clarification Gate**: `[NEEDS CLARIFICATION] = 0` でない限り `/plan` へ進まない。
- [ ] **Plan Gate**: data-model / contracts / test strategy / risks / quickstart outline が明文化されている。
- [ ] **Tasks Gate**: tests-first ordering と verification steps が明示され、ファイルパスが書かれている。
- [ ] **Implementation Gate**: 実装開始前に spec/plan/tasks と実装意図が一致している（diff があれば spec 側へ折り返す）。
- [ ] **DoD Gate**: DoD をすべて満たすまで feature を完了にしない。

### Deliverable Ownership
- **spec.md**: Requirements / AC / exception paths / edge cases / non-functional minimums（feature固有）
- **plan.md**: Technical approach / data-model & contracts changes / test strategy mapping / risks
- **tasks.md**: tests→implementation→verification の順序 / 明示的 file paths / done condition
- **contracts/**: API 契約（入力/出力/認可/エラー/ページング）
- **quickstart.md**: 手動再現手順（seed/login/steps/expected results）
- **code/tests**: spec を実装し、正常系と例外系をテストで証明する

---

## Test Taxonomy (Definitions)

### Contract Tests（定義）
以下を **形式として固定**し、破壊的変更を検知するテスト：
- 入出力スキーマ（成功レスポンス、エラー形式）
- 認可（誰が呼べるか、境界）
- ページング（cursor/limit 等）
- バリデーション（必須、形式、範囲、未知フィールド拒否）
- 安定した error code / message

### Integration Tests（定義）
DB/ストレージ等の依存を含む主要ユースケースを通すテスト：
- 例：作成→取得、ページング、権限境界、状態遷移、期限切れの扱い など

### Verification（定義）
- Quickstart.md に基づく **手動検証**（iOS は primary flow を必ず含む）
- 可能ならログ/スクショ/画面録画で **証跡**を残す

---

## Definition of Done (Fixed)

- [ ] `[NEEDS CLARIFICATION]` が 0
- [ ] `/speckit.analyze` の指摘（重大）が 0、または全対応済み
- [ ] **CI が green**
  - web-api: lint / typecheck / tests（最低限）
  - iOS: build（最低限） +（可能なら）主要テスト
- [ ] Quickstart.md が存在し、手順通りに実行して期待結果が得られた
- [ ] 実装差分があれば spec/plan/tasks に反映され同期している
- [ ] 正常系だけでなく、該当する例外系が AC とテストで担保されている

---

## Non-Functional Minimums

### Baselines (apply to web-api and iOS)
- [ ] **Logging/Monitoring**: 主要アクション/エラーの構造化ログ、request/trace ID を追跡可能にする
- [ ] **Security**: AuthZ を強制、least privilege、secrets はログに出さない
- [ ] **PII**: spec で PII を特定し、マスキング/保護（保存・通信）方針を定義する
- [ ] **Input Validation**: 必須/形式/範囲/未知入力の拒否（境界で実施）
- [ ] **Error Handling**: 安定した error code/message、クライアントへ生スタックトレースを出さない
- [ ] **Performance**: feature-specific targets（latency/startup/flow time）は spec に書く

### Data Retention & Deletion（最低ライン）
- [ ] データ保持期間・削除方針（ユーザー削除、共有解除含む）を spec に明記する
- [ ] バックアップ/復元時の扱い（削除反映の粒度）を必要に応じて plan に記載する

### Auditability（最低ライン）
- [ ] 重要操作（作成/削除/共有/解除/認可失敗/通知送信）を追跡可能にする
- [ ] 監査が必要な場合、誰が・いつ・何をしたかを最小限記録できる設計にする

---

## Emergency Fix Protocol (Controlled Exceptions)

緊急対応は認めるが、vibe drift を防ぐため **例外手順**を固定する。

- 緊急対応で先にコードを直すことは許容する（停止・障害・重大セキュリティのみ）
- ただし **24時間以内**に以下を必ず完了する：
  - spec/plan/tasks への差分反映
  - 必要なテストの追加（少なくとも再発防止の最小テスト）
  - quickstart の更新（再現と確認手順）
  - analyze を実施し重大指摘を潰す
- 緊急対応の PR には “Emergency Fix” ラベルを付け、後追いタスクをブロック扱いにする

---

## Governance
- この constitution はローカルな好みより優先し、すべての feature に適用される。
- 改訂は **diff + version bump + ratification note** を必須とする。
- Versioning policy:
  - **MAJOR**: 破壊的なガバナンス変更
  - **MINOR**: 原則/セクションの追加
  - **PATCH**: 明確化・文言調整・例外手順の微修正
- レビューは各 Gate で行い、違反があれば **進行をブロック**する。

**Version**: 0.1.1 | **Ratified**: 2026-01-29 | **Last Amended**: 2026-01-29
