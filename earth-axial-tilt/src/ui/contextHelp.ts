import { getLanguage, t, onLanguageChange } from './i18n';
type Bilingual = readonly [
    string,
    string
];
interface Help {
    title: Bilingual;
    meaning: Bilingual;
    experiment: Bilingual;
    observe: Bilingual;
    limit: Bilingual;
}
export const HELP: Readonly<Record<string, Help>> = {
    dual: {
        title: ['Compare Lab', '比較ラボ'],
        meaning: ['A and B share the date, rotational phase, location, model and heat storage. Only obliquity differs.', 'A・B は日付、自転角、地点、モデル、蓄熱を共有し、傾きだけが違います。'],
        experiment: ['Choose 23.44° / 90°, then Daylight and June. Try the same experiment in Orbit overview.', '23.44° / 90° を選び、「昼の長さ」と6月にします。公転俯瞰でも同じ実験を見てみましょう。'],
        observe: ['Read A, B and A minus B. In annual graphs the dashed curve becomes B; both 3D views use identical colour scales.', 'A、B、A−Bを読みます。年間グラフの破線はBになり、二つの地球は同じ色スケールを使います。'],
        limit: ['These are separate hypothetical worlds, not planets sharing an orbit. Time/location synchronization is intentionally always on.', '二つは別々の仮想世界です。同じ軌道上の二惑星ではありません。比較の条件を揃えるため、時間と地点の同期は常に有効です。'],
    },
    coupled: {
        title: ['Coupled motion', '自転と公転の同時再生'],
        meaning: ['Advance one shared model clock. A 365-mean-solar-day circular year contains 366 prograde rotations relative to space.', '一つのモデル時計で進めます。365平均太陽日の円軌道の一年には、宇宙空間に対する順行の自転が366回含まれます。'],
        experiment: ['Choose Orbit overview, then Coupled motion. At x1 a model day takes ten seconds; use Play year for a faster tour of seasons.', '公転俯瞰で同時再生を選びます。×1でモデルの一日が10秒。季節を素早く一周するには「一年を再生」を使います。'],
        observe: ['The surface spins and the planet travels, but the axis does not chase the Sun. Speed changes preserve the spin/orbit ratio.', '地表が自転し、地球も移動しますが、軸は太陽を追いかけません。速度を変えても自転と公転の比率は保ちます。'],
        limit: ['This is mean model time, not a civil calendar. At nonzero tilt apparent solar time is nonuniform; polar meridians can be undefined. No hourly temperature model is added.', '平均的なモデル時刻で、標準時のカレンダーではありません。傾きがあると視太陽時の進みは一様でなく、極では未定義になることもあります。毎時の気温モデルは追加していません。'],
    },
    tilt: {
        title: ['Axial tilt', '地軸の傾き'],
        meaning: ['The angle between the rotation axis and the normal to the orbital plane.', '公転面に垂直な方向から、自転軸がどれだけ傾いているかです。'],
        experiment: ['Choose Earth, 45°, then 90°. Keep the date near June solstice and select Daylight.', '日付を夏至付近にして「昼の長さ」を表示し、現在の地球 → 45° → 90° と変えてみましょう。'],
        observe: ['Watch the north/south daylight zones and the annual curve, then inspect the same settings in Season atlas.', '北と南の昼の長さと年間カーブを見ます。季節マップなら全緯度の変化を一枚で比べられます。'],
        limit: ['Changing tilt does not change the orbit radius. Temperature is a separate simplified model.', '傾きを変えても公転の半径は変わりません。気温は別の簡易モデルで計算します。'],
    },
    year: {
        title: ['Day of year', '一年の中の日付'],
        meaning: ['Move along a repeating 365-day circular orbit to inspect the seasons.', '365日の円軌道の中で位置を変え、季節を観察します。'],
        experiment: ['Select Orbit overview, then Play year. Compare the four season buttons.', '「公転を俯瞰」に切り替え「一年を再生」。四季のボタンでも位置を比べてみましょう。'],
        observe: ['Earth moves around the Sun while the rotation axis keeps the same direction in space.', '地球が太陽の周りを動いても、自転軸の向きは宇宙空間で同じ方向を保ちます。'],
        limit: ['Dates are model phases, not exact astronomical calendar dates. Year playback holds rotational phase fixed.', '日付はモデル上の位置で、実際の天文暦とはずれます。一年の再生では自転角を固定しています。'],
    },
    rotation: {
        title: ['Earth rotation', '地球の自転'],
        meaning: ['Spin the surface around its tilted axis without changing the seasonal date.', '季節の日付を変えずに、傾いた軸の周りで地表を回転させます。'],
        experiment: ['Choose Taipei → Sun now → Noon here → Day, then Play day.', '台北 → 今の日射 → この地点を正午に → 一日のグラフ → 一日を再生。'],
        observe: ['Instantaneous sunlight and the day/night boundary change; daily means stay the same.', '瞬間の日射や昼夜が変わります。一方、日平均の日射と気温は同じままです。'],
        limit: ['Solar time is Sun-based, not time-zone time. Undefined polar meridians are explicitly labelled.', '太陽時は標準時ではなく太陽基準の時刻です。極などで一意に決まらない場合は「未定義」と表示します。'],
    },
    layers: {
        title: ['Surface layers', '地表の情報レイヤー'],
        meaning: ['Earth shows geography. Sun now is instantaneous light; Daily solar and Daylight summarize one day.', '「現在の地球」は地形、「今の日射」は瞬間、「日平均の日射」と「昼の長さ」は一日全体の情報です。'],
        experiment: ['With a fixed date, switch Sun now → Daily solar and start Play day.', '同じ日付で「今の日射」→「日平均の日射」と切り替え、一日を再生してみましょう。'],
        observe: ['The instantaneous map moves through the day, but the daily-average latitude bands do not.', '瞬間のマップは自転とともに変わりますが、日平均の緯度帯は変化しません。'],
        limit: ['TOA means above the atmosphere. These are not measured ground-level sunlight or live weather maps.', 'TOAは大気上端です。地上で観測した日射量や現在の天気のマップではありません。'],
    },
    heat: {
        title: ['Heat storage', '熱のためやすさ'],
        meaning: ['A greater heat capacity slows the seasonal temperature response.', '熱容量が大きいほど、季節に対する気温の応答が遅くなります。'],
        experiment: ['Select Thermal EBM and an annual temperature graph. Change Fast → Mixed → Slow.', '熱収支モデルと一年の気温グラフを選び、速い応答 → 中間 → 遅い応答と変えます。'],
        observe: ['Compare the height and timing of the warm-season peak while sunlight stays unchanged.', '日射は同じまま、暖かい季節の山の高さや時期がどう変わるかを見ます。'],
        limit: ['Equivalent water depth is a heat-capacity measure, not the actual local ocean depth. It applies globally.', '水深相当は熱容量の単位で、地点の実際の海の深さではありません。地球全体に適用します。'],
    },
    temperature: {
        title: ['Temperature model', '気温の計算方式'],
        meaning: ['Thermal EBM balances sunlight, radiation, heat storage and exchange between latitude bands.', '熱収支モデルは日射・放射・蓄熱・緯度帯間の熱交換を計算します。'],
        experiment: ['Keep one latitude and compare Thermal EBM with the earlier Illustrative model.', '一つの緯度で、熱収支モデルと以前の簡易モデルを切り替えて比較します。'],
        observe: ['Use curve shape and seasonal differences for intuition, not local forecast accuracy.', '地域の予報精度ではなく、カーブの形や季節差がどう生まれるかを観察します。'],
        limit: ['These are daily-mean-style estimates, not daily highs/lows. No station calibration, clouds or ice feedback.', '日平均相当の推定で、最高・最低気温ではありません。観測点への校正、雲や氷のフィードバックはありません。'],
    },
    chart: {
        title: ['Explore the graph', 'グラフを触って調べる'],
        meaning: ['Year shows seasonal patterns; Day shows a frozen-date solar cycle.', '「一年」は季節の変化、「一日」は日付を固定した日射の変化です。'],
        experiment: ['Click a peak on Year, or choose noon on Day. Arrow keys work too.', '一年の山をクリックしたり、一日の正午を選んでみましょう。矢印キーも使えます。'],
        observe: ['Selection moves the date or rotation on the globe and pauses playback. Dashed curves are labelled references.', '地球側の日付や自転角も選択に連動し、再生は止まります。破線は凡例に示された比較の基準です。'],
        limit: ['The temperature curve is a series of daily estimates, not the hottest and coldest hours of each day.', '気温カーブは日平均相当の値の並びで、各日の最高・最低気温ではありません。'],
    },
    atlas: {
        title: ['Season atlas', '季節マップ'],
        meaning: ['A full year runs left to right; latitude runs north to south from top to bottom.', '横は左から右へ一年、縦は上が北で下が南です。'],
        experiment: ['Choose Daylight and compare 0°, Earth and 90°. Then try Difference from 23.44°.', '「昼の長さ」で0°・現在の地球・90°を比較。その後「23.44°との差」も試します。'],
        observe: ['Find polar day/night zones; click a patch to select its day and latitude on Earth.', '白夜・極夜の領域を探します。気になる場所をクリックすると、地球の日付と緯度も変わります。'],
        limit: ['The dashed line is the subsolar latitude, not the hottest location. Read the changing temperature colour scale.', '破線は太陽直下点の緯度で、最も暑い場所ではありません。気温の色域は設定に応じて変わるので凡例も見てください。'],
    },
    compare: {
        title: ['Compare Earth', '現在の地球との比較'],
        meaning: ['Use exactly the same model and heat storage at 23.44° as a reference.', '同じモデルと蓄熱設定を使い、傾き23.44°を基準に比較します。'],
        experiment: ['Enable Compare Earth, change the tilt, then look at the gap between the curves.', '「現在の地球と比較」をオンにして傾きを変え、二本のカーブの間隔を見ます。'],
        observe: ['The difference isolates the effect of tilt in this model. At 23.44° the two results coincide.', 'このモデルの中で、傾きだけの違いを比較できます。23.44°同士なら一致します。'],
        limit: ['The reference is another model run, not observed climate normals.', '基準も計算結果であり、観測された気候平年値ではありません。'],
    },
    view: {
        title: ['Camera and orbit', '視点と公転'],
        meaning: ['Earth close-up examines local effects. Orbit overview puts the Sun at the centre.', '地球の拡大表示は地点の観察、公転の俯瞰は太陽を中心にした関係の観察に使います。'],
        experiment: ['Switch to Orbit overview, press Fit orbit, choose 90° and step through the seasons.', '公転の俯瞰に切り替え「公転全体を収める」を押し、90°で季節の位置を切り替えます。'],
        observe: ['The illuminated side always faces the Sun. The north-axis direction stays fixed as Earth travels.', '明るい側は常に太陽へ向きます。公転しても北側の軸は同じ方向を保ちます。'],
        limit: ['Planet size, Sun size and orbit distance are intentionally not to scale. Camera controls never change the climate.', '地球・太陽の大きさと距離は意図的に実寸比にしていません。視点操作で気候の値は変わりません。'],
    },
    guides: {
        title: ['Science guides', '科学ガイド'],
        meaning: ['Axis and tilt arc describe orientation. The gold marker is where the Sun is directly overhead.', '地軸と角度の弧は向きを示します。金色の点は太陽が真上に来る場所です。'],
        experiment: ['Change tilt and date. Watch the gold point relative to the equator and the north/south axis.', '傾きと日付を変え、赤道・地軸に対して金色の点がどう動くかを見ます。'],
        observe: ['The day–night boundary stays perpendicular to incoming sunlight.', '昼夜の境界は、入ってくる太陽光の方向に対して垂直に保たれます。'],
        limit: ['The geometric day boundary omits atmospheric refraction and the finite width of the solar disk.', '幾何学的な境界です。大気の屈折や太陽の見かけの大きさは省略しています。'],
    },
    quality: {
        title: ['Quality and focus', '画質と広い表示'],
        meaning: ['Quality changes drawing resolution. Focus hides panels without changing the experiment.', '画質は描画の解像度、広い表示はパネルの表示だけを変えます。実験条件は維持します。'],
        experiment: ['Try Eco on a phone, or High on a desktop; toggle Focus view while Play day runs.', 'スマホでは省電力、PCでは高画質を試せます。一日を再生したまま地球を広く表示してみましょう。'],
        observe: ['The view changes but the scientific values remain identical.', '見た目が変わっても、科学の数値は同じです。'],
        limit: ['Night lights are fixed artwork, not a prediction of settlement on a tilted Earth.', '夜景は固定の画像で、傾いた地球の都市分布を予測するものではありません。'],
    },
};
const pick = (value: Bilingual) => value[getLanguage() === 'ja' ? 1 : 0];
export function bindContextHelp(): () => void {
    const events = new AbortController();
    const dialog = document.getElementById('context-help') as HTMLDialogElement;
    const title = document.getElementById('help-title')!;
    const body = document.getElementById('help-body')!;
    const close = document.getElementById('help-close')!;
    const tip = document.createElement('div');
    tip.id = 'help-tooltip';
    tip.className = 'help-tooltip';
    tip.setAttribute('role', 'tooltip');
    tip.hidden = true;
    document.body.append(tip);
    let active = '', owner: HTMLButtonElement | null = null, timer = 0;
    const hide = () => { clearTimeout(timer); tip.hidden = true; owner?.removeAttribute('aria-describedby'); };
    const render = () => {
        if (!HELP[active])
            return;
        const h = HELP[active];
        title.textContent = pick(h.title);
        body.replaceChildren();
        for (const [heading, value] of [['', h.meaning], [t('Try this'), h.experiment], [t('Look for'), h.observe], [t('Keep in mind'), h.limit]] as const) {
            if (heading) {
                const label = document.createElement('h3');
                label.textContent = heading;
                body.append(label);
            }
            const p = document.createElement('p');
            p.textContent = pick(value);
            body.append(p);
        }
    };
    const buttons: HTMLButtonElement[] = [];
    document.querySelectorAll<HTMLElement>('[data-help]').forEach(anchor => {
        const key = anchor.dataset.help!;
        if (!HELP[key])
            return;
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'help-button';
        button.textContent = '?';
        button.dataset.helpTopic = key;
        button.setAttribute('aria-haspopup', 'dialog');
        button.setAttribute('aria-controls', 'context-help');
        // Sibling controls, never nested inside a label/button/link.
        anchor.insertAdjacentElement('afterend', button);
        buttons.push(button);
        const preview = () => {
            hide();
            if (dialog.open)
                return;
            owner = button;
            timer = window.setTimeout(() => {
                const parent = document.querySelector('dialog[open]') ?? document.body;
                parent.append(tip);
                tip.textContent = `${pick(HELP[key].title)} — ${pick(HELP[key].meaning)}`;
                tip.hidden = false;
                button.setAttribute('aria-describedby', tip.id);
                const b = button.getBoundingClientRect(), w = Math.min(340, window.innerWidth - 24);
                tip.style.width = `${w}px`;
                tip.style.left = `${Math.max(12, Math.min(b.left, window.innerWidth - w - 12))}px`;
                const height = tip.getBoundingClientRect().height;
                tip.style.top = `${Math.max(12, Math.min(b.bottom + 8, window.innerHeight - height - 12))}px`;
            }, 350);
        };
        button.addEventListener('pointerenter', e => { if (e.pointerType === 'mouse')
            preview(); }, { signal: events.signal });
        button.addEventListener('focus', preview, { signal: events.signal });
        button.addEventListener('pointerleave', () => { clearTimeout(timer); timer = window.setTimeout(hide, 150); }, { signal: events.signal });
        button.addEventListener('blur', hide, { signal: events.signal });
        button.addEventListener('click', event => { event.preventDefault(); event.stopPropagation(); hide(); owner = button; active = key; render(); dialog.showModal(); }, { signal: events.signal });
    });
    tip.addEventListener('pointerenter', () => clearTimeout(timer), { signal: events.signal });
    tip.addEventListener('pointerleave', hide, { signal: events.signal });
    close.addEventListener('click', () => dialog.close(), { signal: events.signal });
    dialog.addEventListener('close', () => { hide(); owner?.focus({ preventScroll: true }); }, { signal: events.signal });
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !tip.hidden) {
        hide();
        e.preventDefault();
    } }, { signal: events.signal, capture: true });
    window.addEventListener('scroll', hide, { signal: events.signal, capture: true });
    window.addEventListener('resize', hide, { signal: events.signal });
    const localize = () => { buttons.forEach(b => b.setAttribute('aria-label', `${t('How to explore')}: ${pick(HELP[b.dataset.helpTopic!].title)}`)); if (dialog.open)
        render(); hide(); };
    const unsubscribe = onLanguageChange(localize);
    localize();
    return () => { hide(); events.abort(); unsubscribe(); tip.remove(); buttons.forEach(button => button.remove()); };
}
