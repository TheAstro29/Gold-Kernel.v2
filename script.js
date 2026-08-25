const SCRIPT_URL = "https://script.google.com/macros/s/AKfycby5ON_vODh0U8_fxGkSK4mQBOuRgk3t-enau3DsDoJsWn2INepoc8AOB5dmkgrQiRrz_A/exec";
let db = [];
let charts = {};
let currentReportFilter = "all";

// 🟢 เริ่มต้นระบบ
window.onload = async () => {
  await loadData();
  initCharts();
  setupInstallPrompt();
  document.getElementById("splash").style.opacity = "0";
  setTimeout(() => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("main-content").style.display = "block";
    updateDashboard();
    // ตั้งจุดฐาน (root) ของประวัติเบราว์เซอร์ไว้ที่หน้า dashboard หลังโหลดแอปเสร็จ — กด back จากจุดนี้ = ออกจากแอปตามปกติ
    try { history.replaceState({ __gknav: true, view: "dashboard" }, ""); } catch (e) {}
  }, 800);
};

// ============================================================
// เชื่อมปุ่ม Back ของระบบ (มือถือ/เบราว์เซอร์) เข้ากับการสลับหน้า Dashboard/รายงาน
// หลักการ: ทุกครั้งที่กด switchView() ให้บันทึกไว้ใน browser history (pushState) ด้วย
// แล้วดักฟัง popstate (ตอนกด back) เพื่อสั่งกลับไปหน้าที่บันทึกไว้ แทนที่จะปิดแอปไปเลย
// หมายเหตุ: รอบนี้ครอบคลุมเฉพาะหน้าหลัก (dashboard/report) ยังไม่รวมหน้าต่าง modal ย่อยๆ
// ============================================================
let _navRestoringGK = false;

window.addEventListener("popstate", (e) => {
  const s = e.state;
  if (!s || !s.__gknav) return;
  _navRestoringGK = true;
  switchView(s.view || "dashboard", { fromPopstate: true });
  _navRestoringGK = false;
});

// ============================================================
// 📲 ติดตั้งแอปลงหน้าจอโฮม (Add to Home Screen) — รองรับทั้ง Android/Chrome และ iOS/Safari
// ============================================================
let deferredInstallPrompt = null;

function isIos() {
  return /iphone|ipad|ipod/i.test(navigator.userAgent) ||
    (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1); // iPadOS ใหม่ๆ ปลอมตัวเป็น Mac
}

function isStandaloneDisplay() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

function setupInstallPrompt() {
  const btn = document.getElementById("installAppBtn");
  const btnText = document.getElementById("installAppBtnText");
  if (!btn) return;

  // ถ้าเปิดแอปในโหมด standalone อยู่แล้ว (ติดตั้งไปแล้ว) ไม่ต้องโชว์ปุ่ม
  if (isStandaloneDisplay()) return;

  if (isIos()) {
    // iOS Safari ไม่รองรับ beforeinstallprompt เลย ต้องแนะนำขั้นตอนด้วยมือ (Share → Add to Home Screen)
    btn.style.display = "";
    if (btnText) btnText.textContent = "วิธีติดตั้ง (iPhone/iPad)";
    return;
  }

  // Android/Chrome/Edge ฯลฯ: รอ event นี้ก่อนถึงจะโชว์ปุ่ม (เบราว์เซอร์เป็นคนตัดสินใจว่าติดตั้งได้เมื่อไหร่)
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredInstallPrompt = e;
    btn.style.display = "";
    if (btnText) btnText.textContent = "ติดตั้งแอป";
  });

  window.addEventListener("appinstalled", () => {
    btn.style.display = "none";
    deferredInstallPrompt = null;
  });
}

async function handleInstallClick() {
  if (isIos()) {
    await Swal.fire({
      title: "วิธีติดตั้งลงหน้าจอโฮม (iPhone/iPad)",
      html:
        '<div style="text-align:left; font-size:14px; line-height:1.8;">' +
        "1. แตะปุ่ม <b>แชร์</b> (ไอคอนสี่เหลี่ยมมีลูกศรชี้ขึ้น) แถบด้านล่างของ Safari<br>" +
        '2. เลื่อนหาแล้วแตะ <b>"เพิ่มไปที่หน้าจอโฮม"</b> (Add to Home Screen)<br>' +
        '3. แตะ <b>"เพิ่ม"</b> ที่มุมขวาบน' +
        "</div>",
      confirmButtonText: "เข้าใจแล้ว",
    });
    return;
  }
  if (!deferredInstallPrompt) {
    Swal.fire(
      "ยังติดตั้งไม่ได้ตอนนี้",
      'เบราว์เซอร์นี้ยังไม่พร้อมให้ติดตั้ง ลองรีเฟรชหน้าใหม่แล้วลองอีกครั้ง หรือใช้เมนู "เพิ่มไปยังหน้าจอโฮม" ของเบราว์เซอร์เอง',
      "info",
    );
    return;
  }
  deferredInstallPrompt.prompt();
  await deferredInstallPrompt.userChoice;
  deferredInstallPrompt = null;
  document.getElementById("installAppBtn").style.display = "none";
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("sw.js").catch(() => {
      /* ไม่ critical — แค่ทำให้ติดตั้งเป็น PWA ได้ ถ้าลงทะเบียนไม่สำเร็จก็แค่ไม่มีปุ่มติดตั้ง แอปยังใช้งานปกติ */
    });
  });
}

async function loadData() {
  try {
    const res = await fetch(SCRIPT_URL + "?action=load");
    db = await res.json();
    updateCustomerDatalist();
  } catch (e) {
    console.error("Data Load Error", e);
  }
}

function updateCustomerDatalist() {
  const list = [...new Set(db.map((i) => i.customer))];
  document.getElementById("customerList").innerHTML = list
    .map((c) => `<option value="${c}">`)
    .join("");
}

// 🚛 ฟังก์ชันเปิด-ปิด ช่องพิมพ์รถ
function toggleTruckInput() {
  const isChecked = document.getElementById("enableTruck").checked;
  document.getElementById("truckSection").style.display = isChecked
    ? "block"
    : "none";
}

// 📊 ระบบกราฟ
function initCharts() {
  const opt = {
    responsive: true,
    plugins: { legend: { display: false } },
    scales: { y: { beginAtZero: true } },
  };
  charts.quality = new Chart(document.getElementById("qualityChart"), {
    type: "doughnut",
    data: {
      labels: ["สด (>17.5%)", "แห้ง (≤17.5%)", "แตก", "รา"],
      datasets: [
        {
          data: [0, 0, 0, 0],
          backgroundColor: ["#00b894", "#fdcb6e", "#e17055", "#2d3436"],
          borderWidth: 0,
          hoverOffset: 4,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "right",
          labels: { font: { family: "Sarabun", size: 11 }, boxWidth: 12 },
        },
      },
      cutout: "70%",
    },
  });
  charts.weight = new Chart(document.getElementById("weightChart"), {
    type: "bar",
    data: {
      labels: [],
      datasets: [
        {
          label: "ตัน",
          data: [],
          backgroundColor: "#4834d4",
          borderRadius: 5,
        },
      ],
    },
    options: opt,
  });
  charts.money = new Chart(document.getElementById("amountChart"), {
    type: "line",
    data: {
      labels: [],
      datasets: [
        {
          label: "บาท",
          data: [],
          borderColor: "#ff6b6b",
          fill: true,
          backgroundColor: "rgba(255, 107, 107, 0.1)",
          tension: 0.3,
        },
      ],
    },
    options: opt,
  });
}

function updateDashboard() {
  const groups = {};
  db.forEach((item) => {
    const d = new Date((item.date || "").replace(" ", "T"));
    if (isNaN(d)) return;
    const key = `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, "0")}`;
    if (!groups[key]) groups[key] = { weight: 0, amount: 0 };
    groups[key].weight += parseFloat(item.weight || 0);
    groups[key].amount +=
      parseFloat(item.weight || 0) * parseFloat(item.price || 0);
  });

  const labels = Object.keys(groups).sort();
  if (charts.weight) {
    charts.weight.data.labels = labels;
    charts.weight.data.datasets[0].data = labels.map((k) =>
      groups[k].weight.toFixed(2),
    );
    charts.weight.update();
  }

  if (charts.money) {
    charts.money.data.labels = labels;
    charts.money.data.datasets[0].data = labels.map((k) => groups[k].amount);
    charts.money.update();
  }

  const now = new Date().toLocaleDateString("en-CA");
  const todayData = db.filter((i) => (i.date || "").includes(now));
  if (document.getElementById("stat-day-count"))
    document.getElementById("stat-day-count").innerText = todayData.length;
  if (document.getElementById("stat-day-avg"))
    document.getElementById("stat-day-avg").innerText =
      todayData.length > 0
        ? (
          todayData.reduce((s, i) => s + parseFloat(i.moist || 0), 0) /
          todayData.length
        ).toFixed(1)
        : "0";
  if (document.getElementById("stat-total-count"))
    document.getElementById("stat-total-count").innerText = db.length;

  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);
  const weekData = db.filter((i) => {
    let d = new Date((i.date || "").replace(" ", "T"));
    return !isNaN(d) && d >= weekAgo;
  });
  if (document.getElementById("stat-week-count"))
    document.getElementById("stat-week-count").innerText = weekData.length;

  // ✅ วิธีแก้บั๊กกราฟโดนัทไม่ขึ้น: สั่งให้หน่วงเวลา 0.1 วินาที รอให้หน้าจอโหลดเสร็จก่อนค่อยวาด
  if (typeof updateDoughnutChart === "function") {
    setTimeout(() => {
      updateDoughnutChart();
    }, 100);
  }
}

// ฟังก์ชันคำนวณกราฟโดนัท (อัปเดตเกณฑ์ความชื้น 17.5%)
function updateDoughnutChart() {
  if (!charts.quality || !document.getElementById("doughnutFilter")) return;

  const filter = document.getElementById("doughnutFilter").value;
  const now = new Date();
  let freshWt = 0,
    dryWt = 0,
    brokenWt = 0,
    moldedWt = 0;

  db.forEach((i) => {
    let d = new Date((i.date || "").replace(" ", "T"));
    if (isNaN(d)) return;

    let include = false;
    if (filter === "all") include = true;
    else if (filter === "day") {
      if (d.toLocaleDateString() === now.toLocaleDateString()) include = true;
    } else if (filter === "week") {
      if ((now - d) / (1000 * 60 * 60 * 24) <= 7) include = true;
    } else if (filter === "year") {
      if (d.getFullYear() === now.getFullYear()) include = true;
    }

    if (include) {
      let w = parseFloat(i.weight || 0);
      let m = parseFloat(i.moist || 0);

      // เกณฑ์: ชื้น > 17.5 = สด / ชื้น <= 17.5 = แห้ง
      if (m > 17.5) freshWt += w;
      else dryWt += w;
      if (i.isBroken === "ใช่") brokenWt += w;
      if (i.isMolded === "ใช่") moldedWt += w;
    }
  });

  // อัปเดตข้อมูลลงกราฟ (แปลงเป็น Number ป้องกัน Error)
  charts.quality.data.datasets[0].data = [
    Number(freshWt.toFixed(2)),
    Number(dryWt.toFixed(2)),
    Number(brokenWt.toFixed(2)),
    Number(moldedWt.toFixed(2)),
  ];
  charts.quality.update();
}

// 📄 ระบบรายงาน (Report)

// เก็บช่วงวันที่แบบ "กำหนดเอง" (Date object) — มีค่าเฉพาะตอนกดปุ่ม "ใช้ช่วงนี้" แล้วเท่านั้น
let customRangeStart = null;
let customRangeEnd = null;

function setReportFilter(days) {
  currentReportFilter = days;
  document.querySelectorAll("#filterButtonGroup button").forEach((btn) => {
    if (btn.getAttribute("onclick").includes(`'${days}'`)) {
      btn.style.background = "var(--pink)";
      btn.style.color = "white";
    } else {
      btn.style.background = "white";
      btn.style.color = "#666";
    }
  });

  const customRow = document.getElementById("customRangeRow");
  if (customRow) customRow.style.display = days === "custom" ? "flex" : "none";

  // ออกจากโหมด "กำหนดเอง" ให้ล้างช่วงวันที่เดิมทิ้ง กันเผลอเอาช่วงเก่ามาใช้ต่อตอนกลับมากดใหม่
  if (days !== "custom") {
    customRangeStart = null;
    customRangeEnd = null;
  }

  renderDocumentList();
}

// กดปุ่ม "ใช้ช่วงนี้" หลังเลือกวันที่เริ่มต้น-สิ้นสุดในโหมด "กำหนดเอง"
function applyCustomRange() {
  const startVal = document.getElementById("mReportStartDate").value;
  const endVal = document.getElementById("mReportEndDate").value;

  if (!startVal || !endVal) {
    Swal.fire("กรุณาเลือกวันที่", "เลือกทั้งวันที่เริ่มต้นและสิ้นสุดก่อนกดใช้ช่วงนี้", "warning");
    return;
  }

  const start = new Date(startVal + "T00:00:00");
  const end = new Date(endVal + "T23:59:59");

  if (isNaN(start.getTime()) || isNaN(end.getTime()) || start > end) {
    Swal.fire("ช่วงวันที่ไม่ถูกต้อง", "วันที่เริ่มต้นต้องมาก่อน (หรือวันเดียวกับ) วันที่สิ้นสุด", "warning");
    return;
  }

  customRangeStart = start;
  customRangeEnd = end;
  renderDocumentList();
}

// ตรวจว่าวันที่ d อยู่ในช่วงตัวกรองรายงานปัจจุบันหรือไม่ (ใช้ร่วมกันทั้งตารางรายการ/Ranking/รายงานภาพรวม
// เพื่อไม่ให้ตรรกะการกรองช่วงเวลาซ้ำซ้อนกระจายอยู่หลายจุดเหมือนโค้ดเดิม)
function isDateInReportRange(d) {
  if (currentReportFilter === "all") return true;
  if (isNaN(d.getTime())) return false;

  if (currentReportFilter === "custom") {
    // ยังไม่ได้กด "ใช้ช่วงนี้" ให้ผ่านหมดไปก่อน (กันตารางว่างเปล่าตั้งแต่ตอนเพิ่งกดปุ่ม "กำหนดเอง")
    if (!customRangeStart || !customRangeEnd) return true;
    return d >= customRangeStart && d <= customRangeEnd;
  }

  const now = new Date();

  // "1" = วันนี้ตามปฏิทินจริง (00:00-23:59 ของวันนี้) ไม่ใช่ย้อนหลัง 24 ชม.แบบหมุนตามเวลาปัจจุบัน
  // เพราะลูกค้าอยากดูยอดของ "วันนี้" ล้วนๆ เช่น เปิดดูตอนเช้าไม่อยากให้ดึงยอดของเมื่อวานตอนดึกติดมาด้วย
  if (currentReportFilter === "1") {
    return d.toDateString() === now.toDateString();
  }

  const diff = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
  return diff <= parseInt(currentReportFilter);
}

// ข้อความหัวข้อช่วงเวลาสำหรับแสดงในรายงาน (Ranking / สรุปภาพรวม)
function getReportFilterLabel() {
  const labels = { "1": "วันนี้", "3": "3 วันล่าสุด", "7": "สัปดาห์นี้", "30": "เดือนนี้", "365": "ปีนี้", all: "ทั้งหมด" };
  if (currentReportFilter === "custom") {
    if (customRangeStart && customRangeEnd) {
      const opt = { day: "2-digit", month: "2-digit", year: "2-digit" };
      return `${customRangeStart.toLocaleDateString("th-TH", opt)} - ${customRangeEnd.toLocaleDateString("th-TH", opt)}`;
    }
    return "กำหนดเอง";
  }
  return labels[currentReportFilter] || "ทั้งหมด";
}

let currentDisplayLimit = 50; // กำหนดตัวแปรสำหรับจำกัดแถว (แบ่งหน้า)

function triggerSearch() {
  Swal.fire({
    title: "กำลังค้นหา...",
    text: "โปรดรอสักครู่",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  // หน่วงเวลาให้แอปได้พักหายใจ แล้วค่อยดึงข้อมูล
  setTimeout(() => {
    currentDisplayLimit = 50; // รีเซ็ตการดูข้อมูลให้เริ่มที่ 50 รายการแรกใหม่
    renderDocumentList();
    Swal.close();
  }, 300);
}

function loadMore() {
  currentDisplayLimit += 50; // เพิ่มการแสดงผลทีละ 50 รายการ
  renderDocumentList();
}

function renderDocumentList() {
  const s = document
    .getElementById("searchCustomer")
    .value.toLowerCase()
    .trim();
  const tbody = document.getElementById("documentListBody");

  // 1. กรองและจำ Index ดั้งเดิม (แก้ปัญหา O(N^2) ไม่ให้ค้าง)
  let filtered = db
    .map((item, idx) => ({ item: item, originalIndex: idx }))
    .filter((obj) => {
      const i = obj.item;
      const matchesSearch = (i.customer || "")
        .toString()
        .toLowerCase()
        .includes(s);
      if (currentReportFilter === "all") return matchesSearch;

      let d = new Date((i.date || "").replace(" ", "T"));
      if (isNaN(d)) return matchesSearch;
      return matchesSearch && isDateInReportRange(d);
    });

  // 2. จัดการกล่องสรุปข้อมูล (Summary Card)
  const summaryCard = document.getElementById("customerSummary");
  if (s !== "" && filtered.length > 0) {
    summaryCard.style.display = "block";
    document.getElementById("summaryNameDisplay").innerText = s;
    document.getElementById("summaryCountDisplay").innerText = filtered.length;
    const avgM = (
      filtered.reduce((sum, obj) => sum + parseFloat(obj.item.moist || 0), 0) /
      filtered.length
    ).toFixed(1);
    document.getElementById("summaryMaxMoistDisplay").innerText = avgM + "%";
    const maxP = Math.max(
      ...filtered.map((obj) => parseFloat(obj.item.price || 0)),
    );
    document.getElementById("summaryMaxPriceDisplay").innerText =
      "฿" + maxP.toLocaleString();
  } else {
    summaryCard.style.display = "none";
  }

  // 3. ระบบแบ่งหน้า (Pagination)
  let displayData = filtered.slice().reverse(); // เรียงใหม่ไปเก่า
  let paginatedData = displayData.slice(0, currentDisplayLimit); // ตัดข้อมูลตาม Limit (ทีละ 50)

  if (paginatedData.length === 0) {
    tbody.innerHTML =
      '<tr><td colspan="6" style="text-align:center; padding:30px; color:#999;">ไม่พบข้อมูล</td></tr>';
    return;
  }

  // 4. สร้าง HTML ทีละแถว (ทำงานแค่ 50 รอบ ไม่ใช่พันรอบ!)
  // 4. สร้าง HTML ทีละแถว (แก้ไขปิด Loop และเพิ่มข้อมูลให้ครบ)
  let html = "";
  paginatedData.forEach((obj) => {
    let i = obj.item;
    let realIndex = obj.originalIndex;
    let d = new Date((i.date || "").replace(" ", "T"));
    let dStr = isNaN(d)
      ? (i.date || "").split("T")[0]
      : d.toLocaleDateString("th-TH", {
        day: "2-digit",
        month: "2-digit",
      });

    html += `
    <tr>
      <td style="padding:12px 8px; color:#718096;">${dStr}</td>
      <td style="padding:12px 8px;">
          <b style="color:#2d3748; font-size:13px;">${i.customer || "-"}</b><br>
          <div style="display:flex; flex-direction:column; gap:2px; margin-top:4px;">
              <span style="font-size:10px; background:#fff5f7; color:var(--pink); padding:1px 6px; border-radius:4px; width:fit-content; border:1px solid #ffe4e6;">
                  ✨ ${i.type || "สด"}
              </span>
              <span style="font-size:10px; color:#718096; display:flex; align-items:center; gap:3px;">
                  🚛 ${i.truck && i.truck !== "-" ? i.truck : "ไม่ระบุทะเบียน"}
              </span>
          </div>
      </td>
      <td style="padding:12px 8px; text-align:right; font-weight:bold;">${parseFloat(i.weight || 0).toFixed(2)}</td>
      <td style="padding:12px 8px; text-align:center;">${i.moist || 0}%</td>
      <td style="padding:12px 8px; text-align:right; color:#38a169;">${parseFloat(i.price || 0).toLocaleString()}</td>
      <td style="padding:12px 8px; text-align:center;">
          <div style="display:flex; gap:5px; justify-content:center;">
              <button onclick="printDocument(${realIndex})" style="border:none; background:#ebf8ff; color:#3182ce; padding:5px; border-radius:5px; cursor:pointer;">🖨️</button>
              <button onclick="editItem(${realIndex})" style="border:none; background:#f0fff4; color:#38a169; padding:5px; border-radius:5px; cursor:pointer;">✏️</button>
              <button onclick="deleteItem(${realIndex})" style="border:none; background:#fff5f5; color:#e53e3e; padding:5px; border-radius:5px; cursor:pointer;">🗑️</button>
          </div>
      </td>
    </tr>`;
  });

  // 5. โค้ดสร้างปุ่มโหลดข้อมูลเพิ่ม
  if (displayData.length > currentDisplayLimit) {
    let remaining = displayData.length - currentDisplayLimit;
    html += `<tr>
                    <td colspan="6" style="text-align:center; padding:20px; background: #fafcff;">
                        <button onclick="loadMore()" style="background: white; color: var(--blue); border: 1px solid var(--blue); padding: 8px 24px; border-radius: 20px; font-weight: bold; cursor: pointer; box-shadow: 0 2px 4px rgba(72,52,212,0.1); transition: 0.2s;">
                            ⬇️ โหลดข้อมูลเก่าเพิ่ม (${remaining} รายการ)
                        </button>
                    </td>
                </tr>`;
  }

  // คืนค่า HTML ออกสู่หน้าจอทีเดียวจบ
  tbody.innerHTML = html;
}

// 💾 บันทึกข้อมูล แบบสมบูรณ์ (รองรับทั้งบันทึกใหม่/บันทึกย้อนหลัง และแก้ไขรายการเดิม)
async function saveData() {
  // 1. ดึงค่าจากหน้าจอ
  const cust = document.getElementById("mCustomer").value;
  const weight = document.getElementById("mWeight").value;
  const moistValue = document.getElementById("mMoist").value;
  const price = document.getElementById("mPrice").value;
  const channel = document.getElementById("mChannel") ? document.getElementById("mChannel").value : "หน้าบ้าน";
  const dateInputValue = document.getElementById("mDate").value;

  // ตรวจสอบสถานะทะเบียนรถ
  const truck = document.getElementById("enableTruck").checked
    ? document.getElementById("mTruck").value
    : "-";

  // 2. ตรวจสอบข้อมูลเบื้องต้น
  if (!cust || !weight || (channel !== "โอนตั๋ว" && !price)) {
    Swal.fire("กรอกข้อมูลไม่ครบ!", "กรุณาระบุชื่อและข้อมูลให้เรียบร้อย", "warning");
    return;
  }

  // ตรวจสอบวันที่/เวลาที่เลือก (รองรับบันทึกย้อนหลัง) — ถ้าไม่ได้เลือกไว้เลยให้ใช้เวลาปัจจุบัน
  const chosenDate = dateInputValue ? new Date(dateInputValue) : new Date();
  if (isNaN(chosenDate.getTime())) {
    Swal.fire("วันที่ไม่ถูกต้อง!", "กรุณาเลือกวันที่/เวลาให้ถูกต้อง", "warning");
    return;
  }

  // เก็บสถานะโหมดแก้ไขไว้ก่อนที่ closeEntryModal() จะรีเซ็ต editingIndex กลับเป็น null
  const isEditing = editingIndex !== null;
  const targetIndex = editingIndex;
  const originalDate = isEditing ? db[targetIndex].date : null;

  // 3. ปิดหน้าต่างกรอกข้อมูลทันที (เพื่อให้ Popup แจ้งเตือนไม่โดนทับ)
  closeEntryModal();

  // 4. แสดง Loading
  Swal.fire({
    title: isEditing ? "กำลังบันทึกการแก้ไข..." : "กำลังบันทึก...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  // 🤖 ระบบ Auto: คำนวณ สด/แห้ง จากเกณฑ์ 17.5%
  const moist = parseFloat(moistValue || 0);
  let autoType = moist === 0 ? "ไม่ระบุ" : (moist < 17.5 ? "แห้ง" : "สด");

  // 5. เตรียมข้อมูลส่งไปที่ Sheet
  const payload = {
    action: isEditing ? "update" : "save",
    type: autoType,
    truck: truck,
    customer: cust,
    weight: weight,
    moist: moist,
    price: price || 0,
    channel: channel,
    isBroken: document.getElementById("mBroken").checked ? "ใช่" : "ไม่ใช่",
    isMolded: document.getElementById("mMolded").checked ? "ใช่" : "ไม่ใช่",
    date: chosenDate.toISOString(),
  };
  if (isEditing) payload.originalDate = originalDate;

  try {
    // 6. ส่งข้อมูลไปที่ Google Apps Script แล้วอ่านผลลัพธ์กลับมาตรวจสอบ (กันข้อมูลหน้าจอกับชีตไม่ตรงกัน)
    const res = await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: {
        "Content-Type": "text/plain;charset=utf-8",
      },
    });
    const text = await res.text();

    if (isEditing) {
      if (text.indexOf("Updated") === 0) {
        db[targetIndex] = payload;
        updateDashboard();
        renderDocumentList();
        Swal.fire("บันทึกการแก้ไขสำเร็จ!", "", "success");
      } else {
        Swal.fire("แก้ไขไม่สำเร็จ", "ไม่พบรายการเดิมในชีต หรือเกิดข้อผิดพลาด กรุณารีเฟรชแล้วลองใหม่", "error");
      }
    } else {
      // 7. อัปเดตข้อมูลในหน้าเว็บทันที
      db.push(payload);
      updateDashboard();
      renderDocumentList();
      Swal.fire("สำเร็จ!", "บันทึกข้อมูลเรียบร้อยแล้ว", "success");
    }
  } catch (e) {
    console.error("Save Error:", e);
    Swal.fire("Error!", "เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
  }
}

// 🗑️ ระบบลบข้อมูล — รหัสผ่านตรวจสอบที่ฝั่งเซิร์ฟเวอร์ (Code.gs) เท่านั้น
// ไม่เก็บรหัสผ่านไว้ในโค้ดฝั่งหน้าเว็บอีกต่อไป เพราะใครก็เปิดดู source แล้วเห็นรหัสได้
function deleteItem(index) {
  const item = db[index];
  Swal.fire({
    title: "ยืนยันการลบ?",
    text: `ชื่อลูกค้า: ${item.customer}`,
    input: "password",
    inputPlaceholder: "รหัสผ่านสำหรับลบข้อมูล",
    showCancelButton: true,
    confirmButtonText: "ลบข้อมูล",
    confirmButtonColor: "#e53e3e",
    preConfirm: (password) => {
      if (!password) {
        Swal.showValidationMessage("กรุณากรอกรหัสผ่าน");
        return false;
      }
      return password;
    },
  }).then(async (result) => {
    if (!result.isConfirmed) return;
    const password = result.value;

    Swal.fire({
      title: "กำลังลบ...",
      allowOutsideClick: false,
      didOpen: () => Swal.showLoading(),
    });

    try {
      const res = await fetch(SCRIPT_URL, {
        method: "POST",
        body: JSON.stringify({ action: "delete", date: item.date, password: password }),
        headers: { "Content-Type": "text/plain;charset=utf-8" },
      });
      const text = await res.text();

      if (text.indexOf("Deleted") === 0) {
        db.splice(index, 1);
        updateDashboard();
        renderDocumentList();
        Swal.fire("ลบรายการสำเร็จ!", "", "success");
      } else if (text.indexOf("Invalid Password") !== -1) {
        Swal.fire("รหัสผ่านไม่ถูกต้อง!", "กรุณาลองใหม่อีกครั้ง", "error");
      } else {
        Swal.fire("ลบไม่สำเร็จ", "ไม่พบรายการนี้ในชีต หรือเกิดข้อผิดพลาด กรุณารีเฟรชแล้วลองใหม่", "error");
      }
    } catch (e) {
      console.error("Delete Error:", e);
      Swal.fire("Error!", "เกิดข้อผิดพลาดในการเชื่อมต่อ", "error");
    }
  });
}

// 📋 คัดลอกสรุป Line
// ---------------------------------------------------
// ฟังก์ชัน: คัดลอกรายงานสรุปส่ง Line (เวอร์ชันอัปเกรด)
// ---------------------------------------------------
// ---------------------------------------------------
// ฟังก์ชัน: คัดลอกรายงานสรุปส่ง Line (เปลี่ยน Ranking เป็นจำนวนพ่วง)
// ---------------------------------------------------
// ---------------------------------------------------
// ฟังก์ชัน: คัดลอกรายงานสรุปส่ง Line (อัปเกรดระบุช่วงเวลา Ranking)
// ---------------------------------------------------
function copySummaryText() {
  // 1. ดึงค่าจากหน้าจอ
  const name = document.getElementById("summaryNameDisplay").innerText;
  const s = document
    .getElementById("searchCustomer")
    .value.toLowerCase()
    .trim();
  const now = new Date();

  if (!s || !name) {
    Swal.fire(
      "แจ้งเตือน",
      "กรุณาค้นหาชื่อลูกค้าก่อนคัดลอกรายงานครับ",
      "warning",
    );
    return;
  }

  // 2. กรองข้อมูลของลูกค้าที่เลือก (ตามเงื่อนไขค้นหา)
  const filtered = db.filter((i) =>
    (i.customer || "").toString().toLowerCase().includes(s),
  );

  if (filtered.length === 0) {
    Swal.fire("ไม่พบข้อมูล", "ไม่พบรายการของลูกค้านี้", "error");
    return;
  }

  // 3. คำนวณค่าสถิติของลูกค้าคนนี้
  const count = filtered.length;
  const avgMoist = (
    filtered.reduce((sum, i) => sum + parseFloat(i.moist || 0), 0) / count
  ).toFixed(1);

  let maxPrice = 0;
  let moistAtMax = 0;
  filtered.forEach((i) => {
    const p = parseFloat(i.price || 0);
    if (p > maxPrice) {
      maxPrice = p;
      moistAtMax = i.moist;
    }
  });

  // 4. คำนวณ Ranking ตามช่วงเวลาที่เลือก (Filter) — ใช้ isDateInReportRange()/getReportFilterLabel()
  // ร่วมกับตารางรายการและรายงานภาพรวม เพื่อไม่ให้ตรรกะช่วงเวลากระจายซ้ำหลายจุดเหมือนเดิม
  // (รองรับโหมด "กำหนดเอง" ไปในตัวโดยอัตโนมัติ)
  let visitCounts = {};
  const filterLabel = getReportFilterLabel();

  const rankedData = db.filter((i) => {
    const d = new Date((i.date || "").replace(" ", "T"));
    return isDateInReportRange(d);
  });

  // นับจำนวนพ่วงในกลุ่มข้อมูลที่กรองแล้ว
  rankedData.forEach((i) => {
    if (i.customer) {
      visitCounts[i.customer] = (visitCounts[i.customer] || 0) + 1;
    }
  });

  let rank = Object.entries(visitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);

  let rankTxt =
    `\n🏆 *5 อันดับส่งพ่วงบ่อย (${filterLabel}):*\n` +
    rank.map((r, idx) => ` ${idx + 1}. ${r[0]} (${r[1]} พ่วง)`).join("\n");

  // 5. จัดรูปแบบ วันที่-เวลา ปัจจุบัน
  const dateStr =
    now.toLocaleDateString("th-TH", {
      day: "2-digit",
      month: "2-digit",
      year: "2-digit",
    }) +
    " " +
    now.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });

  // 6. สร้างข้อความรายงาน
  const txt = `📌 *รายงานสรุป GoldKernel*
  ลูกค้า: ${name}
  วันที่: ${dateStr} น.
--------------------------
  จำนวนของท่าน: ${count} พ่วง
  ความชื้นเฉลี่ย: ${avgMoist}%
  ราคาสูงสุด: ฿${maxPrice.toLocaleString()} (ที่ความชื้น ${moistAtMax}%)
--------------------------
${rankTxt}
--------------------------
✅ ข้อมูลถูกต้องแม่นยำ`;

  // 7. สั่งคัดลอก
  navigator.clipboard.writeText(txt).then(() => {
    Swal.fire({
      title: "คัดลอกสำเร็จ!",
      text: `สรุป Ranking แบบ${filterLabel}เรียบร้อย`,
      icon: "success",
      timer: 1500,
      showConfirmButton: false,
    });
  });
}

// ---------------------------------------------------
// 📊 รายงานสรุปภาพรวม (ไม่ผูกกับลูกค้าคนใดคนหนึ่ง) — ใช้ช่วงเวลาเดียวกับปุ่มตัวกรองด้านบน
// (1 วัน/3 วัน/7 วัน/เดือน/ปี/ทั้งหมด/กำหนดเอง) แล้วสรุปเป็นข้อความล้วนให้กดคัดลอกไปวางใน LINE เอง
// เหตุผลที่ทำแบบข้อความ+ปุ่มคัดลอก แทนที่จะส่งอัตโนมัติ: รูปภาพที่แชร์ผ่าน LINE จะหมดอายุ/โดนบีบอัดเมื่อเวลาผ่านไป
// ส่วนการส่งอัตโนมัติทำได้จริงผ่าน LINE Messaging API เท่านั้น (LINE Notify ปิดให้บริการไปแล้วตั้งแต่ปี 2025)
// ซึ่งต้องตั้งค่า LINE Official Account + Token เพิ่ม จึงเลือกใช้วิธีคัดลอก-วางเองตามที่ต้องการก่อน
// ---------------------------------------------------
function generateOverviewReport() {
  const filtered = db.filter((i) => {
    const d = new Date((i.date || "").replace(" ", "T"));
    return isDateInReportRange(d);
  });

  if (filtered.length === 0) {
    Swal.fire("ไม่พบข้อมูล", "ไม่มีรายการในช่วงเวลาที่เลือก", "info");
    return;
  }

  const filterLabel = getReportFilterLabel();

  // ยอดรวม
  const count = filtered.length;
  const totalWeight = filtered.reduce((sum, i) => sum + parseFloat(i.weight || 0), 0);
  const totalAmount = filtered.reduce(
    (sum, i) => sum + parseFloat(i.weight || 0) * parseFloat(i.price || 0),
    0,
  );

  // แยกตามคุณภาพ (เฉพาะน้ำหนัก สด/แห้ง — ตามที่ลูกค้าใช้งานจริงแค่นี้ ตัดช่องทาง/เม็ดแตก/เม็ดรา/% ออก)
  let freshWt = 0,
    dryWt = 0;
  filtered.forEach((i) => {
    const w = parseFloat(i.weight || 0);
    const m = parseFloat(i.moist || 0);
    if (m > 17.5) freshWt += w;
    else dryWt += w;
  });
  // ใส่ลูกน้ำคั่นหลักพัน (เช่น 1,000 / 30,000.00) ให้ตัวเลขในรายงานอ่านง่ายขึ้น
  const fmt = (v, decimals = 2) =>
    Number(v).toLocaleString("th-TH", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

  // Top 5 ลูกค้าที่ส่งพ่วงเยอะสุดในช่วงนี้
  const visitCounts = {};
  filtered.forEach((i) => {
    if (i.customer) visitCounts[i.customer] = (visitCounts[i.customer] || 0) + 1;
  });
  const rank = Object.entries(visitCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5);
  const rankTxt = rank.length
    ? rank.map((r, idx) => ` ${idx + 1}. ${r[0]} (${r[1]} พ่วง)`).join("\n")
    : " - ไม่มีข้อมูล";

  const txt = `📌 *สรุปรายงานภาพรวม GoldKernel*
ช่วงเวลา: ${filterLabel}

จำนวนรับซื้อ: ${count.toLocaleString("th-TH")} พ่วง
น้ำหนักรวม: ${fmt(totalWeight)} ตัน
ยอดเงินรวม: ฿${fmt(totalAmount, 0)}

 แยกตามคุณภาพ (น้ำหนัก):
 สด (>17.5%): ${fmt(freshWt)} ตัน
 แห้ง (≤17.5%): ${fmt(dryWt)} ตัน

 Top 5 ลูกค้าส่งพ่วงเยอะสุด:
${rankTxt}`;

  showOverviewReportModal(txt);
}

function showOverviewReportModal(txt) {
  document.getElementById("overviewReportText").value = txt;
  document.getElementById("overviewReportModal").style.display = "block";
}

function closeOverviewReportModal() {
  document.getElementById("overviewReportModal").style.display = "none";
}

function copyOverviewReport() {
  const textarea = document.getElementById("overviewReportText");
  const txt = textarea.value;

  navigator.clipboard
    .writeText(txt)
    .then(() => {
      Swal.fire({
        title: "คัดลอกสำเร็จ!",
        text: "วางในไลน์ได้เลยครับ",
        icon: "success",
        timer: 1500,
        showConfirmButton: false,
      });
    })
    .catch(() => {
      // เผื่อเบราว์เซอร์/บริบท (เช่น ไม่ใช่ HTTPS) ไม่รองรับ clipboard API — ให้เลือกข้อความในกล่องไว้ให้เลย ผู้ใช้กด Ctrl+C เองได้
      textarea.focus();
      textarea.select();
      Swal.fire("คัดลอกอัตโนมัติไม่ได้", "เลือกข้อความในกล่องไว้ให้แล้ว กด Ctrl+C (หรือแตะค้างแล้วเลือกคัดลอก) ได้เลย", "warning");
    });
}

// 🖨️ ระบบ Print เอกสาร (html2canvas เดิม)
// ---------------------------------------------------
// ฟังก์ชัน: แสดงตัวอย่างใบชั่ง (Preview) ก่อนบันทึก
// ---------------------------------------------------
function printDocument(index) {
  const i = db[index];
  const area = document.getElementById("captureArea");
  const d = new Date((i.date || "").replace(" ", "T"));
  const dStr = isNaN(d) ? i.date : d.toLocaleDateString("th-TH");
  const tStr = isNaN(d) ? "" : d.toLocaleTimeString("th-TH") + " น.";

  // 1. สร้างเนื้อหาใบชั่งในพื้นที่ซ่อน (Capture Area)
  area.innerHTML = `
        <div style="text-align:center; border-bottom:2px solid #000; padding-bottom:10px; margin-bottom:20px;">
            <img src="img/logo.png" style="width:60px; height:60px; object-fit:contain;"><br>
            <h2 style="margin:5px 0;">ใบชั่งน้ำหนักสินค้า</h2>
            <h3 style="margin:0;">ธนกรการเกษตร 99 (GoldKernel)</h3>
        </div>
        <div style="font-size:16px; line-height:1.8; color:#000;">
            <p><b>วันที่:</b> ${dStr} ${tStr}</p>
            <p><b>ชื่อลูกค้า:</b> ${i.customer}</p>
            <p><b>ทะเบียน:</b> ${i.truck || "-"}</p>
            <p><b>ช่องทาง:</b> ${i.channel}</p>
            <p style="background:#f8f9fa; padding:10px; border-radius:8px;">
                <b>น้ำหนักสินค้า:</b> <span style="font-size:24px; color:var(--blue);">${parseFloat(i.weight || 0).toFixed(2)}</span> ตัน
            </p>
            <p><b>ความชื้น:</b> ${i.moist || 0}%</p>
            <p><b>ราคา/ตัน:</b> ฿${parseFloat(i.price || 0).toLocaleString()}</p>
            <p><b>เม็ดแตก:</b> ${i.isBroken || "ไม่ใช่"} | <b>เม็ดรา:</b> ${i.isMolded || "ไม่ใช่"}</p>
        </div>
        <div style="margin-top:30px; border-top:1px dashed #000; padding-top:10px; text-align:center; font-size:14px;">
            <p>ขอบคุณที่ใช้บริการ GoldKernel 🙏</p>
        </div>
    `;

  // 2. ใช้ html2canvas แปลงเป็นภาพ
  Swal.fire({
    title: "กำลังสร้างใบชั่ง...",
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  html2canvas(area, { scale: 2 }).then((canvas) => {
    const imageData = canvas.toDataURL("image/png");

    // 3. แสดง Popup Preview รูปภาพ
    Swal.fire({
      title: "ตัวอย่างใบชั่งน้ำหนัก",
      imageWidth: 300,
      imageUrl: imageData,
      imageAlt: "คูปองรับซื้อ",
      showCancelButton: true,
      confirmButtonText: "💾 บันทึกลงเครื่อง",
      cancelButtonText: "ปิด",
      confirmButtonColor: "var(--blue)",
    }).then((result) => {
      if (result.isConfirmed) {
        // 4. ถ้า User กด Save ให้ทำการดาวน์โหลด
        const link = document.createElement("a");
        link.download = `Bill_${i.customer}_${dStr}.png`;
        link.href = imageData;
        link.click();

        Swal.fire({
          icon: "success",
          title: "บันทึกสำเร็จ",
          timer: 1000,
          showConfirmButton: false,
        });
      }
    });
  });
}

// เมนู & หน้าต่าง
function switchView(v, opts) {
  document.getElementById("dashboard-view").style.display =
    v === "dashboard" ? "block" : "none";
  document.getElementById("report-view").style.display =
    v === "report" ? "block" : "none";
  document
    .getElementById("nav-dash")
    .classList.toggle("active", v === "dashboard");
  document
    .getElementById("nav-report")
    .classList.toggle("active", v === "report");
  if (v === "report") renderDocumentList();

  // บันทึกลง browser history ทุกครั้งที่เปลี่ยนหน้า (ยกเว้นตอนที่กำลัง restore มาจากปุ่ม back เอง กันวนลูป)
  if (!(opts && opts.fromPopstate) && !_navRestoringGK) {
    try { history.pushState({ __gknav: true, view: v }, ""); } catch (e) {}
  }
}

// เก็บ index ของรายการที่กำลังแก้ไขอยู่ (null = โหมดบันทึกรายการใหม่)
let editingIndex = null;

// แปลง Date object เป็นรูปแบบที่ <input type="datetime-local"> ต้องการ ตามเวลาท้องถิ่นของเครื่อง
function toLocalDatetimeInputValue(d) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// เปิดฟอร์มกรอกข้อมูล — ไม่ส่ง index = บันทึกรายการใหม่ (ตั้งเวลาเป็นปัจจุบัน แก้เป็นย้อนหลังได้)
// ส่ง index ของรายการเดิม = โหมดแก้ไขรายการนั้น (ดึงข้อมูลเดิมมาแสดงในฟอร์มให้ครบ)
function openEntryModal(index) {
  const title = document.getElementById("entryModalTitle");
  const saveBtn = document.getElementById("saveBtn");

  if (typeof index === "number" && db[index]) {
    editingIndex = index;
    const item = db[index];
    document.getElementById("mCustomer").value = item.customer || "";
    if (document.getElementById("mChannel")) document.getElementById("mChannel").value = item.channel || "หน้าบ้าน";
    document.getElementById("mWeight").value = item.weight || "";
    document.getElementById("mMoist").value = item.moist || "";
    document.getElementById("mPrice").value = item.price || "";
    document.getElementById("mBroken").checked = item.isBroken === "ใช่";
    document.getElementById("mMolded").checked = item.isMolded === "ใช่";

    const hasTruck = !!(item.truck && item.truck !== "-");
    document.getElementById("enableTruck").checked = hasTruck;
    document.getElementById("truckSection").style.display = hasTruck ? "block" : "none";
    document.getElementById("mTruck").value = hasTruck ? item.truck : "";

    const d = new Date((item.date || "").replace(" ", "T"));
    document.getElementById("mDate").value = toLocalDatetimeInputValue(isNaN(d.getTime()) ? new Date() : d);

    if (title) title.textContent = "✏️ แก้ไขรายการ";
    if (saveBtn) saveBtn.innerHTML = "💾 บันทึกการแก้ไข";
  } else {
    editingIndex = null;
    document.getElementById("mDate").value = toLocalDatetimeInputValue(new Date());
    if (title) title.textContent = "📝 บันทึกข้อมูลใหม่";
    if (saveBtn) saveBtn.innerHTML = "💾 บันทึกข้อมูล";
  }

  document.getElementById("entryModal").style.display = "block";
}

// ปุ่ม ✏️ ในตารางรายการ — เปิดฟอร์มเดิมพร้อมข้อมูลของแถวนั้นให้แก้ไข
function editItem(index) {
  openEntryModal(index);
}

function closeEntryModal() {
  document.getElementById("entryModal").style.display = "none";
  document.getElementById("enableTruck").checked = false;
  document.getElementById("truckSection").style.display = "none";
  document.getElementById("mTruck").value = "";
  document.getElementById("mBroken").checked = false;
  document.getElementById("mMolded").checked = false;
  document.getElementById("mCustomer").value = "";
  document.getElementById("mWeight").value = "";
  document.getElementById("mMoist").value = "";
  document.getElementById("mPrice").value = "";
  document.getElementById("mDate").value = "";
  editingIndex = null;
}
window.onclick = function (event) {
  const modal = document.getElementById("entryModal");
  if (event.target === modal) {
    closeEntryModal();
  }
  const overviewModal = document.getElementById("overviewReportModal");
  if (event.target === overviewModal) {
    closeOverviewReportModal();
  }
};
