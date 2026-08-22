// 扔瓶引导（panel.js 的 maybeNudge）的回归测试。node dev/test-nudge.js 直跑，不需要浏览器。
// 它把 chrome API 与 DOM 全 mock 掉，只验那三个条件的组合行为。
// 为什么值得单独留一份：这条提示弹早了（人还没觉得这海里该有他一份）、
// 或者弹给一个已经扔过瓶的人（“海里还没有你的”是假话），两种都比不弹更糟。
const fs = require('fs'), vm = require('vm'), path = require('path');
const EXT = 'G:/claude code/yt-bottle/extension';

function makeCtx() {
  const saved = {};
  const el = () => ({ innerHTML: '', classList: { _s: new Set(),
      add(c){this._s.add(c)}, remove(c){this._s.delete(c)}, contains(c){return this._s.has(c)},
      toggle(c){this._s.has(c)?this._s.delete(c):this._s.add(c)} },
      style: {}, onclick: null, click(){}, scrollIntoView(){}, textContent: '',
      firstElementChild: { textContent: '' }, appendChild(){} });
  const nodes = {};
  const ctx = {
    console,
    Date,
    document: {
      addEventListener(){},
      getElementById(id){ return nodes[id] || (nodes[id] = el()); },
      createElement(){ return el(); },
    },
    chrome: {
      i18n: { getMessage: (k, a) => k + (a ? '[' + a.join(',') + ']' : '') },
      storage: { local: { get:(k,cb)=>cb({}), set:(o,cb)=>{Object.assign(saved,o); cb&&cb();} } },
      runtime: { getManifest: () => ({ version: '0.2.0' }) },
      tabs: { create(){} },
    },
    fetch: () => new Promise(()=>{}),
    setTimeout,
    window: { close(){} },
    _saved: saved, _nodes: nodes,
  };
  vm.createContext(ctx);
  for (const f of ['lib.js', 'panel.js']) {
    vm.runInContext(fs.readFileSync(path.join(EXT, f), 'utf8'), ctx, { filename: f });
  }
  return ctx;
}

function run(name, setup, expectOn) {
  const c = makeCtx();
  setup(c);
  vm.runInContext('maybeNudge()', c);
  const on = c._nodes['nudge'] && c._nodes['nudge'].classList.contains('on');
  const ok = !!on === expectOn;
  console.log((ok ? 'PASS' : 'FAIL') + '  ' + name + '  (弹出=' + !!on + ' 期望=' + expectOn + ')');
  return ok;
}

const DAY = 24*3600*1000;
let all = true;
all &= run('捞满3瓶+一瓶没扔+从没弹过 → 弹',
  c => vm.runInContext('state.fishes=3; state.myBottles=0; state.nudgedAt=0', c), true);
all &= run('只捞了2瓶 → 不弹',
  c => vm.runInContext('state.fishes=2; state.myBottles=0; state.nudgedAt=0', c), false);
all &= run('已经扔过1瓶 → 不弹',
  c => vm.runInContext('state.fishes=9; state.myBottles=1; state.nudgedAt=0', c), false);
all &= run('瓶子数还没问到(null) → 不弹',
  c => vm.runInContext('state.fishes=9; state.myBottles=null; state.nudgedAt=0', c), false);
all &= run('3天前弹过 → 冷却期内不弹',
  c => vm.runInContext('state.fishes=9; state.myBottles=0; state.nudgedAt=Date.now()-3*'+DAY, c), false);
all &= run('8天前弹过 → 冷却已过,再弹',
  c => vm.runInContext('state.fishes=9; state.myBottles=0; state.nudgedAt=Date.now()-8*'+DAY, c), true);

// 同一次 popup 里不重复弹 + 弹了就落盘时间戳 + 评分条让位
const c = makeCtx();
vm.runInContext('state.fishes=5; state.myBottles=0; state.nudgedAt=0; state.rated=false', c);
vm.runInContext('maybeNudge()', c);
const stamped = typeof c._saved.nudgedAt === 'number' && c._saved.nudgedAt > 0;
console.log((stamped?'PASS':'FAIL') + '  弹出后把时间戳落盘 (nudgedAt=' + c._saved.nudgedAt + ')');
c._nodes['nudge'].classList.remove('on');
vm.runInContext('maybeNudge()', c);
const notAgain = !c._nodes['nudge'].classList.contains('on');
console.log((notAgain?'PASS':'FAIL') + '  同一次 popup 里不重复弹');
vm.runInContext('maybeRate()', c);
const rateOff = !c._nodes['rate'] || !c._nodes['rate'].classList.contains('on');
console.log((rateOff?'PASS':'FAIL') + '  扔瓶引导弹了,评分条让位不弹');
// 文案带上真实捞瓶数
const c2 = makeCtx();
vm.runInContext('state.fishes=4; state.myBottles=0; state.nudgedAt=0', c2);
vm.runInContext('maybeNudge()', c2);
const txtOk = c2._nodes['nudge'].innerHTML.indexOf('nudge[4]') === 0;
console.log((txtOk?'PASS':'FAIL') + '  文案填入真实捞瓶数: ' + c2._nodes['nudge'].innerHTML.slice(0,30));
all = all && stamped && notAgain && rateOff && txtOk;
console.log(all ? '\n全部通过' : '\n有失败项');
