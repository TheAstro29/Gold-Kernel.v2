const SCRIPT_URL =
  "https://script.google.com/macros/s/AKfycby5ON_vODh0U8_fxGkSK4mQBOuRgk3t-enau3DsDoJsWn2INepoc8AOB5dmkgrQiRrz_A/exec";
let db = [];
let charts = {};
let currentReportFilter = "all";

// 🟢 เริ่มต้นระบบ
window.onload = async () => {
  await loadData();
  initCharts();
  document.getElementById("splash").style.opacity = "0";
  setTimeout(() => {
    document.getElementById("splash").style.display = "none";
    document.getElementById("main-content").style.display = "block";
    updateDashboard();
  }, 800);
};

function triggerSearch() {
  Swal.fire({
    title: "กำลังค้นหาข้อมูล...",
    html: '<span style="color:#a0aec0; font-size:14px;">โปรดรอสักครู่ ระบบกำลังประมวลผล</span>',
    allowOutsideClick: false,
    didOpen: () => {
      Swal.showLoading();
    },
  });

  // หน่วงเวลา 0.4 วินาทีให้เห็น Effect โหลดดิ้ง และป้องกันหน้าเว็บกระตุก
  setTimeout(() => {
    currentDisplayLimit = 50; // รีเซ็ตการดูข้อมูลให้เริ่มที่ 50 รายการแรกใหม่
    renderDocumentList();
    Swal.close();
  }, 400);
}

function loadMore() {
  currentDisplayLimit += 50; // เพิ่มลิมิตทีละ 50
  renderDocumentList(); // วาดตารางใหม่
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
  renderDocumentList();
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
  const now = new Date();
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
      const diff = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
      return matchesSearch && diff <= parseInt(currentReportFilter);
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

// 💾 บันทึกข้อมูล แบบสมบูรณ์
async function saveData() {
  const cust = document.getElementById("mCustomer").value;
  const weight = document.getElementById("mWeight").value;
  const moist = document.getElementById("mMoist").value;
  const price = document.getElementById("mPrice").value;
  const channel = document.getElementById("mChannel") ? document.getElementById("mChannel").value : "หน้าบ้าน";
  const truck = document.getElementById("enableTruck").checked
    ? document.getElementById("mTruck").value
    : "-";

  if (!cust || !weight || (channel !== "โอนตั๋ว" && !price)) {
    Swal.fire("กรอกข้อมูลไม่ครบ!", "กรุณาระบุชื่อและข้อมูลให้เรียบร้อย", "warning");
    return;
  }

  closeEntryModal();
  Swal.fire({
    title: "กำลังบันทึก...",
    allowOutsideClick: false,
    didOpen: () => Swal.showLoading(),
  });

  // เตรียมข้อมูลให้ตรงกับที่ GAS ต้องการ (data.action และ data.moist)
  const payload = {
    action: "save",
    type: "รับซื้อ",
    truck: truck,
    customer: cust,
    weight: weight,
    moist: moist || 0, // ส่งค่าความชื้นตรงๆ
    price: price || 0,
    channel: channel,
    isBroken: document.getElementById("mBroken").checked ? "ใช่" : "ไม่ใช่",
    isMolded: document.getElementById("mMolded").checked ? "ใช่" : "ไม่ใช่",
    date: new Date().toISOString(),
  };

  try {
    // เปลี่ยนวิธีส่ง เพื่อให้ Apps Script ได้รับ data แน่นอน
    await fetch(SCRIPT_URL, {
      method: "POST",
      body: JSON.stringify(payload), // ส่ง payload ไปตรงๆ
      headers: {
        "Content-Type": "text/plain;charset=utf-8", // ใช้ text/plain เพื่อเลี่ยงปัญหา CORS
      },
    });

    // อัปเดตหน้าจอทันที
    db.push(payload);
    updateDashboard();
    renderDocumentList();
    Swal.fire("สำเร็จ!", "บันทึกข้อมูลเรียบร้อยแล้ว", "success");
  } catch (e) {
    console.error(e);
    Swal.fire("Error!", "ไม่สามารถบันทึกได้: " + e.message, "error");
  }
}

// 🗑️ ระบบลบข้อมูลด้วยรหัสผ่าน C2tech1234
function deleteItem(index) {
  const item = db[index];
  Swal.fire({
    title: "ยืนยันการลบ?",
    text: `ชื่อลูกค้า: ${item.customer}`,
    input: "password",
    showCancelButton: true,
    confirmButtonText: "ลบข้อมูล",
    confirmButtonColor: "#e53e3e",
    preConfirm: (password) => {
      if (password === "C2tech1234") return true;
      Swal.showValidationMessage("รหัสผ่านไม่ถูกต้อง!");
      return false;
    },
  }).then(async (result) => {
    if (result.isConfirmed) {
      Swal.fire({
        title: "กำลังลบ...",
        didOpen: () => Swal.showLoading(),
      });
      await fetch(SCRIPT_URL, {
        method: "POST",
        mode: "no-cors",
        body: JSON.stringify({ action: "delete", date: item.date }),
      });
      db.splice(index, 1);
      updateDashboard();
      renderDocumentList();
      Swal.fire("ลบรายการสำเร็จ!", "", "success");
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

  // 4. คำนวณ Ranking ตามช่วงเวลาที่เลือก (Filter)
  let visitCounts = {};
  let filterLabel = ""; // สำหรับแสดงหัวข้อใน Line

  // กรองข้อมูลทั้งหมดตาม Filter ก่อนนำมาจัดอันดับ
  const rankedData = db.filter((i) => {
    if (currentReportFilter === "all") {
      filterLabel = "ทั้งหมด";
      return true;
    }

    let d = new Date((i.date || "").replace(" ", "T"));
    if (isNaN(d)) return false;

    const diff = Math.ceil(Math.abs(now - d) / (1000 * 60 * 60 * 24));
    const limit = parseInt(currentReportFilter);

    if (limit === 1) filterLabel = "วันนี้";
    else if (limit === 3) filterLabel = "3 วันล่าสุด";
    else if (limit === 7) filterLabel = "สัปดาห์นี้";
    else if (limit === 30) filterLabel = "เดือนนี้";
    else if (limit === 365) filterLabel = "ปีนี้";

    return diff <= limit;
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
            <p><b>ประเภทรถ/ทะเบียน:</b> ${i.truck || "-"}</p>
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

// 1. ฟังก์ชันสลับหน้าจอ (แนะนำให้ใช้ชื่อ showView ตามระบบเดิมของคุณ)
function showView(v) {
  const dashView = document.getElementById("dashboard-view");
  const reportView = document.getElementById("report-view");

  if (dashView && reportView) {
    dashView.style.display = v === "dashboard" ? "block" : "none";
    reportView.style.display = v === "report" ? "block" : "none";
  }

  // ปรับสถานะปุ่มเมนูให้เป็น Active
  const navDash = document.getElementById("nav-dash");
  const navReport = document.getElementById("nav-report");

  if (navDash) navDash.classList.toggle("active", v === "dashboard");
  if (navReport) navReport.classList.toggle("active", v === "report");

  // ถ้าไปหน้า Report ให้โหลดรายการข้อมูล
  if (v === "report") renderDocumentList();

  // ปิดแถบเมนูด้านข้าง
  toggleSidebar(false);
}

// 2. ฟังก์ชัน เปิด/ปิด Sidebar (ต้องมีครบทุกเงื่อนไข)
function toggleSidebar(show) {
  const s = document.getElementById("sidebar");
  const o = document.getElementById("overlay");

  if (!s || !o) return; // ป้องกัน Error ถ้าหา Element ไม่เจอ

  if (show === undefined) {
    s.classList.toggle("active");
    o.classList.toggle("active");
  } else if (show === true) {
    s.classList.add("active");
    o.classList.add("active");
  } else {
    s.classList.remove("active");
    o.classList.remove("active");
  }
}

// เมนู & หน้าต่าง
function switchView(v) {
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
}

function openEntryModal() {
  document.getElementById("entryModal").style.display = "block";
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
}
window.onclick = function (event) {
  const modal = document.getElementById("entryModal");
  if (event.target === modal) {
    closeEntryModal();
  }
};
