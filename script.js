// helpers
const $ = s => document.querySelector(s);
const formatCurrency = n => `₹${Number(n).toLocaleString('en-IN')}`;

// DOM
const micBtn = $('#micBtn');
const micLabel = $('#micLabel');
const clearBtn = $('#clearBtn');
const totalEl = $('#total');
const monthTotalEl = $('#monthTotal');
const topCatEl = $('#topCat');
const countEl = $('#count');
const expenseList = $('#expenseList');
const toast = $('#toast');

// charts
let pieChart, barChart;

// storage
const STORAGE_KEY = "voice-expenses-v3";
let transactions = load() || [];

// Categories
const CATEGORY_MAP = {
  food: ['food', 'pizza', 'restaurant', 'snack', 'cafe'],
  travel: ['uber', 'ola', 'bus', 'train', 'petrol', 'fuel'],
  shopping: ['shopping', 'amazon', 'clothes'],
  bills: ['bill', 'electricity', 'rent'],
  groceries: ['grocery', 'groceries', 'supermarket'],
  health: ['doctor', 'pharmacy', 'medicine'],
  entertainment: ['movie', 'game'],
  other: []
};

// INIT
init();

function init() {
  setupCharts();
  renderAll();
  setupForm();
  setupMic();

  clearBtn.onclick = () => {
    if (confirm("Clear all transactions?")) {
      transactions = [];
      save();
      renderAll();
      toastMsg("Cleared all");
    }
  };
}

// STORAGE
function save() { localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions)); }
function load() { return JSON.parse(localStorage.getItem(STORAGE_KEY)); }

// ADD TRANSACTION
function add(tx) {
  tx.id = crypto.randomUUID();
  transactions.unshift(tx);
  save();
  renderAll();
  toastMsg(`${tx.type === "expense" ? "Spent" : "Received"} ${formatCurrency(tx.amount)}`);
}

// DELETE
function del(id) {
  transactions = transactions.filter(t => t.id !== id);
  save();
  renderAll();
}

// RENDER
function renderAll() {
  renderSummary();
  renderList();
  updateCharts();
}

function renderSummary() {
  const spent = transactions
    .filter(t => t.type === "expense")
    .reduce((s, t) => s + t.amount, 0);

  totalEl.textContent = formatCurrency(spent);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${now.getMonth()+1}`;

  const monthSpent = transactions
    .filter(t => t.type === "expense")
    .filter(t => {
      const d = new Date(t.date);
      return `${d.getFullYear()}-${d.getMonth()+1}` === monthKey;
    })
    .reduce((s,t)=>s+t.amount,0);

  monthTotalEl.textContent = formatCurrency(monthSpent);

  // top category
  const catSum = {};
  transactions.filter(t=>t.type==="expense").forEach(t=>{
    catSum[t.category] = (catSum[t.category]||0) + t.amount;
  });

  const sorted = Object.entries(catSum).sort((a,b)=>b[1]-a[1]);
  topCatEl.textContent = sorted.length ?
    `${capitalize(sorted[0][0])} (${formatCurrency(sorted[0][1])})`
    : "—";

  countEl.textContent = transactions.length;
}

function renderList() {
  expenseList.innerHTML = "";

  if (transactions.length === 0) {
    expenseList.innerHTML = `<li style="padding:10px;color:gray;">No transactions yet</li>`;
    return;
  }

  transactions.forEach(t => {
    const li = document.createElement("li");
    li.className = "exp-item";

    li.innerHTML = `
      <div class="exp-left">
        <div class="exp-cat">${capitalize(t.category)}
          <span style="font-size:12px;color:gray;margin-left:6px;">
            ${new Date(t.date).toLocaleString()}
          </span>
        </div>
        <div>${t.note || ""}</div>
      </div>

      <div class="exp-right" style="display:flex;align-items:center;gap:8px;">
        <span class="type-badge ${t.type==="income"?"type-income":"type-expense"}">
          ${capitalize(t.type)}
        </span>
        <div class="exp-amt">${t.type==="expense"?"- ":"+ "}${formatCurrency(t.amount)}</div>
        <button class="del-btn" onclick="del('${t.id}')">Delete</button>
      </div>
    `;

    expenseList.appendChild(li);
  });
}

// CHARTS
function setupCharts() {
  const pieCtx = $("#pieChart").getContext("2d");
  const barCtx = $("#barChart").getContext("2d");

  pieChart = new Chart(pieCtx, {
    type: "pie",
    data: { labels: [], datasets: [{ data: [] }] },
    options: { responsive: true }
  });

  barChart = new Chart(barCtx, {
    type: "bar",
    data: { labels: [], datasets: [{ data: [] }] },
    options: { responsive: true }
  });
}

function updateCharts() {
  const sums = {};
  transactions.filter(t=>t.type==="expense").forEach(t=>{
    sums[t.category] = (sums[t.category]||0) + t.amount;
  });

  pieChart.data.labels = Object.keys(sums).map(capitalize);
  pieChart.data.datasets[0].data = Object.values(sums);
  pieChart.update();

  const months = lastNMonths(6);
  const arr = months.map(m => {
    const [y, mo] = m.split("-").map(Number);
    return transactions.filter(t=>{
      const d=new Date(t.date);
      return t.type==="expense" &&
             d.getFullYear()===y &&
             d.getMonth()+1===mo;
    }).reduce((s,t)=>s+t.amount,0);
  });

  barChart.data.labels = months.map(m=>{
    const [y,mo]=m.split("-");
    return `${monthName(mo-1)} ${String(y).slice(2)}`;
  });
  barChart.data.datasets[0].data = arr;
  barChart.update();
}

// FORM
function setupForm() {
  $("#manualForm").addEventListener("submit", e=>{
    e.preventDefault();

    const amount = Number($("#mAmount").value);
    const type = $("#mType").value;
    const category = $("#mCategory").value || "other";
    const date = $("#mDate").value ? new Date($("#mDate").value) : new Date();
    const note = $("#mNote").value;

    add({ amount, type, category, date:date.toISOString(), note });

    e.target.reset();
  });
}

// MIC SPEECH
function setupMic() {
  const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;

  if (!SpeechRec) {
    micLabel.textContent = "Mic not supported";
    micBtn.disabled = true;
    return;
  }

  const rec = new SpeechRec();
  rec.lang = "en-IN";

  let listening = false;

  micBtn.onclick = () => {
    if (!listening) rec.start();
    else rec.stop();
  };

  rec.onstart = () => {
    listening = true;
    micBtn.classList.add("listening");
    micLabel.textContent = "Listening...";
  };

  rec.onend = () => {
    listening = false;
    micBtn.classList.remove("listening");
    micLabel.textContent = "Start Listening";
  };

  rec.onresult = e => {
    const text = e.results[0][0].transcript.toLowerCase();
    toastMsg("Heard: " + text);

    const parsed = parseSpeech(text);
    if (!parsed.amount) return toastMsg("Couldn't detect amount");

    add(parsed);
  };
}

// Parse Speech
function parseSpeech(text) {
  let amount = null;
  const match = text.match(/([0-9]+(?:[.,][0-9]+)?)/);
  if (match) amount = Number(match[1]);

  let type = /got|received|credited/.test(text) ? "income" : "expense";

  let category = "other";
  for (let [cat, keys] of Object.entries(CATEGORY_MAP)) {
    if (keys.some(k => text.includes(k))) {
      category = cat;
      break;
    }
  }

  let date = new Date();
  if (text.includes("yesterday")) date.setDate(date.getDate()-1);

  return { amount, category, type, date:date.toISOString(), note:text };
}

// UTIL
function toastMsg(msg) {
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 2500);
}

function lastNMonths(n) {
  const a = [];
  const now = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    a.push(`${d.getFullYear()}-${d.getMonth()+1}`);
  }
  return a;
}

const monthName = i => ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][i];
const capitalize = s => s.charAt(0).toUpperCase()+s.slice(1);
