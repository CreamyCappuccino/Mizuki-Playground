# 次の瑞希へ — Earth Axial Tilt Lab

## 現在地

**1.2.0-rc.1：Orbit Mechanics Labを実装中。** 離心率、Kepler時間進行、1/r²日射、近日点方向、独立した地軸方向、軌道診断、A/B別軌道、schema 1→2 migrationを追加した。まず `docs/V1.2.md`、`docs/SCIENCE.md`、`docs/EXPERIMENT_STATE.md` を読む。実機Safari gateと公開承認は未完了のまま。


`CreamyCappuccino/Mizuki-Playground/earth-axial-tilt/`。独立した静的フロントエンド。**v0.9の比較・同時再生とv1.0の仕上げを実装。v1.0.0-rc.1はChromium／macOS WebKitの自動検証が成功。** 正式版の実機iPhone確認は未完了。公開はしていない。

最短の復帰は **この文書 → ROADMAP.md → docs/V1.0.md → 変更分野のコード**。確認済みのコード・CI・画像は [検証記録](docs/VERIFICATION-1.0-rc.1.md) を参照し、着手時はさらに最新HEADのCIを確認する。MCP索引は **Mizuki MM410**。メモリは道案内、最新コード・CI・文書が正本。

## 今できること

v0.8の日英・?・公転俯瞰・大文字・Atlas・EBMを保持。A/B別傾斜の比較、共通時計の自転＋公転、比較年グラフ、両画面のFocus、Basic/All、初回の短い案内を追加。CompareとAtlasは後読み込み。package-lockを保存、CIはnpm ci。正式完了とCI合格は最新HEADで確認し、未実施の実機試験を合格にしない。

## 読む入口

| 変更対象 | ファイル |
|---|---|
| 現在できること／起動 | `README.md` |
| 今後と残りの検証 | `ROADMAP.md`、`docs/RELEASE_CHECKLIST.md` |
| 日英の利用者ガイド | `docs/GUIDE.ja.md`、`docs/GUIDE.en.md` |
| 実験の保存・検証 | `src/experiments/state.ts`、`presets.ts`、`src/ui/experimentWorkbench.ts` |
| 共有A状態とUIの連携 | `src/main.ts`、`index.html` |
| 比較B、待機・失敗、差分 | `src/ui/compareLab.ts`、`src/physics/comparison.ts` |
| 時計 | `src/physics/motion.ts`、`src/ui/playback.ts` |
| 描画と二画面・ピッキング | `src/scene/EarthScene.ts` |
| 軌道力学・公転配置・太陽 | `src/physics/orbit.ts`、`src/scene/orbitLayout.ts`、`orbitOverview.ts`、`src/ui/orbitControls.ts` |
| Atlasの後読み込み | `src/ui/lazyAtlas.ts`、`seasonAtlas.ts` |
| 日英辞書・? | `src/ui/i18n.ts`、`messages.ts`、`contextHelp.ts` |
| 表示設定・導入 | `src/ui/releaseControls.ts`、`viewControls.ts`、`src/style.css` |
| 気候・天文の仕様 | `docs/SCIENCE.md` と `src/physics/` |
| 自動検証 | `tests/`、`e2e/`、`scripts/check-docs.mjs`、ルート `.github/workflows/earth-axial-tilt.yml` |

## 特に壊したくない条件

- AとBは**傾きと軌道条件が別**。日付・自転角・地点・気温モデル・蓄熱・視点・凡例は共有。同期解除は未実装で意図的に保留。
- A−Bは日平均系だけ。同じ自転位相でも、傾きが異なれば視太陽時まで同じとは限らない。瞬間差を無説明で追加しない。
- 地点パネルはA。比較中の年間破線はB。一日のグラフはA。AtlasはA対23.44°で、Bとの差ではない。
- Play day＝日付固定、Play year＝自転角固定。Coupled＝共通モデル時計。365平均太陽日で366慣性回転、×1で0.1モデル日／実秒。日付ラップで回転をリセットしない。
- **v0.9で座標系を修正済み。** 太陽方向は `[cosλ,0,-sinλ]`、地球は `Rx(-tilt)*Ry(spin)`、公転中心位置は太陽方向の負×14。公転と東向き自転は+Y回りの順行。過去版の正負をコピーしない。
- v1.2では同じ慣性系で、近日点方向と地軸方向を独立に持つ。地球姿勢は `Ry(axis)*Rx(-tilt)*Ry(spin)`。モデル日80の平均経度を0とし、Kepler方程式から真経度を求める。e=0では近日点方向が結果へ影響してはいけない。
- 傾き・表示方向の修正に合わせ初期カメラも反対側へ移し、夏至付近の初期画面を昼側から見る。緯度別の日射・昼時間・気候方程式は変えていない。
- 一つのWebGLRenderer／sceneを二つのscissor viewportへ描画。Bパスの後は必ずA状態を復元。別々の太陽系を比べる画面であって、同じ軌道に惑星を二つ置いた物理モデルではない。
- Bの熱計算は独立したrequest管理。A=BならAの解を再利用。待機・失敗時に古い温度を新条件の値にしない。
- 言語・画質・Basic/All・Focusは表示だけ。小さい画面で文字を縮めず、並び替えやスクロールを使う。比較時に旧Singleのmargin-top/translateXが復活しないよう確認。
- 解除可能な任意モジュールの読込失敗は、数値機能を壊さず、明示したページ再読み込みで回復する。
- bfcacheに入るpagehideはdisposeしない。通常終了ではRAF・Observer・listener・worker・GL資源を片づける。

## 検証と作業

最初にGitHub最新HEADと対象ファイルSHAを読む。会話添付には古い同名コードが多数ある。repoルート `AGENTS.md` も読む。変更はこのプロジェクト内、他作品を巻き込まない。

`npm ci` → `npm run verify` → `npx playwright install chromium` → `npm run test:e2e`。Mac側エンジン検証は `npm run test:e2e:webkit`。Playwright WebKit ≠ 実機Safari。実機の未確認項目は `docs/RELEASE_CHECKLIST.md` に残す。

CIの同じhead_shaを確認。Chromiumの画像基準を変更するときはactual/diffを読んでから更新し、自動で毎回基準を上書きしない。WebGLのスクリーンショットを、DOMだけの代替画像と混同しない。

完了後のMac pullは潮さんから許可済み。GitHub Lite target=`mizuki-playground`。status→clean/非分岐→pull(confirm_pull=true)→status。dirtyを消さない。公開・新repo作成は別承認。

## 文書とメモリ

README＝今できること、START_HERE＝復帰入口、ROADMAP＝未来、SCIENCE＝数式、V0.x/V1.x＝変更履歴。関連する文書をコードと同時更新する。Mizuki MM410は短い索引として更新し、版ごとの長文を無限に追記しない。

## v1.2の引き継ぎ注意

リンクは科学条件を保存し、描画画像・キャッシュ済み温度・言語・画質・再生状態を保存しない。URLとJSONは同じvalidatorを通し、原子的に適用する。未知のschema versionや不正値は既存状態を維持。optional Compareの読み込みが遅い時は新しい操作が優先する。Heat storageのFast/Slowプリセットは順番に比較する二実験で、A/Bの熱容量を別々にした機能ではない。

state schemaは2。schema 1は新しい軌道値を持たないEarth Classicとしてmigrationする。thermal worker、年グラフ、日グラフ、instant Solar、Atlas、比較、EBMは必ず同じorbit forcingを参照し、古い軌道条件の温度を再利用しない。検証チェックポイントは `docs/VERIFICATION-1.2-rc.1.md`。最終HEADの合否はCIで確認する。
