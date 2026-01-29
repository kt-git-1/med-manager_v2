# Summary
- 何を変更したか（1〜3行）

## Spec / Plan / Tasks / Quickstart
- Spec: <!-- link or path --> (例: specs/001-adherence-history/spec.md)
- Plan: <!-- link or path -->
- Tasks: <!-- link or path -->
- Quickstart: <!-- link or path -->

## Gate Checklist (Constitution)
### Clarification / Sync
- [ ] `[NEEDS CLARIFICATION]` は 0（未解決なし）
- [ ] code と spec/plan/tasks の差分は **spec側へ折り返し済み**（差分がないなら「差分なし」と明記）
- [ ] 変更要求（CR）が絡む場合、`spec -> clarify -> plan -> tasks -> analyze -> implement` の順に更新済み

### Tests (Web API)
- [ ] Contract tests を追加/更新（入出力・エラー形式・認可・ページング等）
- [ ] Integration tests を追加/更新（主要ユースケース：作成→取得、権限境界など）
- [ ] web-api の CI が green（lint/typecheck/tests）

### Verification (iOS)
- [ ] ios-patient build が通る
- [ ] ios-family build が通る
- [ ] primary user-flow を Quickstart 手順で確認した（証跡：ログ/スクショ/画面録画のいずれか）
  - Evidence: <!-- link / note -->

### Non-Functional Minimums (if applicable)
- [ ] PII を spec で特定し、ログ/保護方針を明記（必要な変更がある場合）
- [ ] 入力検証・エラーコード/メッセージが仕様通り
- [ ] 重要操作のログ/追跡（必要な変更がある場合）

## /speckit.analyze
- [ ] 実行した
- Findings: <!-- 重大指摘があればここに要約 + 対応 -->

## Notes
- 影響範囲、注意点、ロールバック手順など

## Emergency Fix (only if used)
- [ ] これは緊急対応（停止/重大障害/重大セキュリティ）である
- [ ] 24h以内に spec/plan/tasks とテストと quickstart を追補するタスクを作成した
  - Follow-up task: <!-- link -->
