Feature 001: 服用記録（TAKEN）登録 → 当日予定/履歴をカレンダーで閲覧（患者/家族）を spec 化して。
出力先は specs/001-adherence-history/spec.md。
Feature 000（specs/000-domain-policy/spec.md）のポリシーに従うこと。

スコープ（MVP）：
- 患者：UIから「飲んだ」を簡単に記録できる（TAKEN作成）
- 家族：代理で「飲んだ」を記録できる（TAKEN作成、recordedBy=family）
- 患者/家族：当日予定/履歴をカレンダーで閲覧できる（当日表示＋月マーク程度）
- web-api：当日データ取得API（予定＋履歴）を提供
- web-api：履歴を期間指定（from/to）で取得できる
- web-api：cursor/limit によるページングを提供
- 未服用（MISSED）はサーバージョブが作成する（本featureでは「表示・取得」が対象。ジョブ自体の実装はFeature 0xxに切ってもよいが、表示要件はここで定義する）

必ず含める内容（constitution＋テンプレ準拠）：
- User Stories と AC（テスト可能な文言）
  - 正常系（TAKEN作成、当日表示）
  - 例外系（認可NG/存在しない患者/期限切れ連携/重複/上限/通信断/冪等性/競合）
- データ定義：
  - 予定（時間帯→時刻は患者ごとに家族設定）
  - 履歴（TAKEN/MISSED/RESOLVED、recordedBy、timestamp など）
- 認可境界：
  - 患者は自分のみ
  - 家族は連携中の患者のみ。連携解除後は過去含め閲覧不可
- Contracts（API入出力・エラー形式・ページング・AuthZ）
- PII/ログ方針
- Non-Functional（入力検証、観測性、性能ターゲットの最低限）
- Quickstart Requirements（seed/login/操作/期待結果）
  - 家族ログイン→患者選択→当日表示
  - 患者は連携コードで連携済みとして利用→「飲んだ」→反映
  - 家族代理で「飲んだ」→反映

不明点は [NEEDS CLARIFICATION] に列挙してよい（ただし /plan 前に0にする）。
