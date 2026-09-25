# 次の瑞希へ — Earth Axial Tilt Lab

## まずここだけ（v0.8）

場所は `CreamyCappuccino/Mizuki-Playground/earth-axial-tilt/`。独立した静的フロントエンドで、repo全体をworkspaceにはしていない。

**v0.8 = 日本語/English切替 +「？」解説 + 太陽中心の公転俯瞰 + 引き継ぎ資料整理。**
v0.7の4K昼夜画像・Focus・画質、v0.6の季節マップ、v0.5の熱収支モデルは維持。今回、既存の8つの `src/physics/` ファイルは変更していない。

最初の目的は「地球を0〜90°に傾け、季節・日射・昼時間・推定気温の関係を触って発見する」。機能数より、分かることと操作の対応を重視する。

## 最短で読む順番

1. このページ：現在地、守る条件、ファイルの入口。
2. `ROADMAP.md`：v0.9 Compare Lab、Coupled motion、v1.0の完成条件、その先の候補。
3. `docs/V0.8.md`：直近の変更と確認項目。以前の全会話を読む必要はない。
4. `docs/GUIDE.ja.md`：利用者の操作と、何を読み取るか。
5. 変更する分野のファイルだけ（下表）。物理を変更するときだけ `docs/SCIENCE.md` を精読。

READMEの過去版節と `docs/V0.4.md`〜`V0.7.md` は履歴。旧版の未実装記述を現在の制限として引用しない。v0.7で外部画像URL依存を解消、v0.8で公転俯瞰を実装している。

## 変更箇所ごとの入口

| 対象 | 最初に読むファイル |
|---|---|
| 画面と共有状態、再計算の条件 | `src/main.ts`、`index.html` |
| 日英の言葉と日付、表示更新 | `src/ui/i18n.ts`、`messages.ts`、`chart.ts` |
| 「？」の内容・hoverとclick | `src/ui/contextHelp.ts`（意味→操作→観察→限界） |
| 3D、座標、クリック、視点切替 | `src/scene/EarthScene.ts` |
| 公転配置と太陽の見た目 | `src/scene/orbitLayout.ts`、`orbitOverview.ts` |
| 画質・Focus・ヘッダー実測レイアウト | `src/ui/viewControls.ts`、`src/scene/visualQuality.ts`、`src/style.css` |
| 年間／一日グラフ | `src/ui/chart.ts`、`dayChart.ts`、`chartLayout.ts`、`chartScrubber.ts` |
| 全緯度の季節マップ | `src/ui/seasonAtlas.ts`、`src/physics/atlas.ts` |
| 太陽の幾何と自転 | `src/physics/solar.ts`、`geometry.ts`、`diurnal.ts` |
| 推定気温 | `src/physics/energyBalance.ts`、`temperatureModel.ts`、`climate.worker.ts`、`src/ui/thermalClient.ts` |
| テスト | `tests/`（数値・不変条件）と `e2e/`（実ブラウザ） |
| CI | repo rootの `.github/workflows/earth-axial-tilt.yml` |

## 壊したくない条件

- 表示言語、画質、Focus、視点モードは表示設定。気温・日射の条件、地点、日付、自転角を勝手に変えない。
- 言語選択はlocalStorageを優先。未設定なら日本語ブラウザだけja、それ以外en。ストレージが使えなくても操作可能。DOMは`lang`も更新。
- 翻訳は固定キーの辞書とテンプレート。DOMを監視して後から推測翻訳する方式ではない。内部の都市ID・モデルIDは翻訳しない。
- 長い日本語、Large、390px幅を確認する。文字を小さくして押し込まない。ヘッダーと公転バーは実測高で配置。
- `Play day`は日付を固定して自転。`Play year`は自転角を固定して公転位相を動かす。v0.8では両方同時再生ではない。**Coupled motionはv0.9の計画で、既存2モードの意味を変えず第三のモードとして追加する。**
- 物理のSun方向は `[cos(lambda), 0, sin(lambda)]`。公転俯瞰の地球中心はその **負方向×14**。軸は宇宙空間で固定し、`Rx(tilt)*Ry(spin)`を維持する。
- 地球中心表示のカメラは公転切替から戻せる。`View location`は公転表示を抜けて地球を拡大。地理座標ピッキングの逆変換を壊さない。
- 公転表示の距離・地球サイズ・太陽サイズは説明用。日射の強度を表示距離で再計算しない。太陽の模様は静的な装飾。
- 気温は日平均相当の緯度帯モデルで、最高気温や観測点に合わせた予報ではない。比較相手も同じモデル・同じ蓄熱条件の23.44°。
- Workerの古い返信で新条件の気温を上書きしない。計算待ち／失敗時は古い気温を新条件の結果として見せない。
- UI全体の「?」は解説するだけで状態を変えない。Escは一番上のダイアログを閉じ、Focusまで一緒に解除しない。

## 作業手順と権限

作業開始時はGitHubの最新tree/HEADを読む。会話に残った同名ファイルには過去版が混ざりやすいので、変更対象はSHAも確認する。repo全体の規則はroot `AGENTS.md`。

ローカル確認：project directoryで `npm install` → `npm run typecheck` → `npm test` → `npm run build` → `npx playwright install chromium` → `npm run test:e2e`。

GitHub Actionsの**対象コードと同じhead_sha**がsuccessかを確認。テスト名だけ・スクリーンショット保存だけで成功としない。この環境ではnpm/network/WebGLが使えない場合がある。UIだけの代替確認と、本物の依存関係で実行したCIを区別して報告する。

潮さんから、完了後のMacへのpullは許可済み。GitHub Liteのtargetは **`mizuki-playground`**。status確認→clean/非分岐を確認→`pull_local_repository(confirm_pull=true)`→status再確認。dirtyを破壊して進めない。公開サイトのdeployや新repo作成は別の境界で、自動実施しない。

## 今回の資料点検で整理したこと

各版のREADME・科学説明・変更履歴・画像の出典は既に残っていた。一方、現状への入口と操作ガイドがなく、過去版の制限と現在の機能が混ざりやすかった。`START_HERE.md`を入口、`ROADMAP.md`を未来の正本、操作をGUIDE、最新変更をV0.8、科学の仕様をSCIENCEへ分離した。

## 残っている候補（未着手を完成と混同しない）

**v0.9 / v1.0の計画は `ROADMAP.md` を正本とする。** 近い順ではDual Earth、Coupled motion、比較ガイド、実機Safari、packaging/performance、1.0向けUI整理・回帰テスト。さらに先は雲、海陸／氷のフィードバック、離心率・歳差、別惑星など。

日英化・解説・公転俯瞰はv0.8で実装済み。ROADMAP上の未実装項目と混同しない。

## この文書の更新

次の版で「まずここだけ」と残作業を更新し、直近のV0.xへリンクする。大きな優先順位や版計画を変えた場合は `ROADMAP.md` も同時更新する。検証runと正確なcommitはGitHubの履歴／CIと各リリースの報告を正本にし、古い会話の番号だけに依存しない。
