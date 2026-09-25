# Earth Axial Tilt Lab — Roadmap

[復帰入口](START_HERE.md) · [現在の機能](README.md) · [v0.8時点の元計画](docs/PLAN-v0.8.md)

## v0.9 — 実装済み、最終検証は同一HEADのCIを参照

- Dual Earth：A/Bの個別傾斜、0/45/90°比較プリセット。
- 日付・地点・自転位相・モデル・蓄熱・視点・凡例を共有し、A/B/A−Bを表示。
- 一つのGPU contextによる横並び／縦並び表示。両世界の公転俯瞰とFocus。
- 共通時計によるCoupled motion。独立したPlay day/Play yearは維持。
- 比較向け日英ガイドと、Bの計算待ち・失敗・再試行。

同期解除は必要になった時の追加候補として保留。瞬間日射のA−Bも未追加。比較条件が分からなくなる機能より、傾きだけ変える実験を優先した。

## v1.0 — 1.0.0-rc.1

### 実装・自動確認を進めた項目

- Basic/All表示、初回の短い導入、現在のモード表示、日英の整合。
- Compare/Atlasの後読み込み、Three.js core/renderer分割。
- 実際に生成したpackage-lockの保存とnpm ci。
- RAF/worker/observer/listenerの終了処理。単一GPU資源の共有。
- ドキュメントの内部リンク、翻訳キー、HTML ID検査。
- Chromium回帰、macOS WebKitエンジン検証、限定した静的UIの画像基準。
- READMEの現在形への再構成、旧説明の履歴化、日英ガイド・科学仕様・引き継ぎ更新。

### 正式版への残りのゲート

**実機iPhoneのSafariによる確認は未実施。** macOS WebKitやChromiumの端末エミュレーションを、その代わりの合格証拠にしない。チェック項目は [RELEASE_CHECKLIST](docs/RELEASE_CHECKLIST.md)。結果を記録して問題を直した後、正式1.0への判定を行う。

公開URLへのdeploymentは未実施で、潮さんの明示GO待ち。RCから正式版への番号変更と、公開は別操作。

### この版に混ぜなかった任意項目

動的な雲、新しい大気・海流・氷モデル、派手な常時Sunアニメーション、物理モデルの都市実測へのfit。既存の太陽表現を維持し、安定性・理解しやすさ・負荷を優先。

## v1.x — 再検討する候補

別惑星（Mars/Uranusなど）、離心率、近日点と季節の位置関係、歳差、Milankovitch型実験。地球用の一年や熱収支係数を別惑星へ無説明で流用しない。

気候の次段階は海陸の熱容量差・氷アルベド・標高など。表示用の雲と計算に使う雲を区別する。実験状態のURL共有、観測プリセットも候補。

## 運用

計画を完了事実と混同しない。変更時はSTART_HERE、README、SCIENCE、GUIDE、版別記録の影響範囲だけ更新する。実装と同じHEADのCI、手動観察、未確認事項を区別する。
