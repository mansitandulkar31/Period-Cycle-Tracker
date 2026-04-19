const STORAGE_KEY = "luna-cycle-tracker-v1";
const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const SYMPTOMS = [
  "Bloating",
  "Headache",
  "Back pain",
  "Acne",
  "Tender breasts",
  "Cravings",
  "Fatigue",
  "Nausea",
  "Stress",
  "Poor sleep"
];

const DEFAULT_STATE = {
  settings: {
    cycleLength: 28,
    periodLength: 5,
    lastPeriodStart: todayKey(),
    trackingGoal: "balance"
  },
  entries: {}
};

const state = loadState();
let currentMonth = startOfMonth(new Date());
let selectedDateKey = todayKey();
let selectedSymptoms = [];

const els = {
  settingsForm: document.getElementById("settingsForm"),
  cycleLength: document.getElementById("cycleLength"),
  periodLength: document.getElementById("periodLength"),
  lastPeriodStart: document.getElementById("lastPeriodStart"),
  trackingGoal: document.getElementById("trackingGoal"),
  todayStatus: document.getElementById("todayStatus"),
  todayMeta: document.getElementById("todayMeta"),
  nextPeriodDate: document.getElementById("nextPeriodDate"),
  periodCountdown: document.getElementById("periodCountdown"),
  ovulationDate: document.getElementById("ovulationDate"),
  fertileWindow: document.getElementById("fertileWindow"),
  cycleDay: document.getElementById("cycleDay"),
  phaseName: document.getElementById("phaseName"),
  calendarTitle: document.getElementById("calendarTitle"),
  calendarWeekdays: document.getElementById("calendarWeekdays"),
  calendarGrid: document.getElementById("calendarGrid"),
  prevMonth: document.getElementById("prevMonth"),
  nextMonth: document.getElementById("nextMonth"),
  dailyLogForm: document.getElementById("dailyLogForm"),
  logDate: document.getElementById("logDate"),
  flowLevel: document.getElementById("flowLevel"),
  crampLevel: document.getElementById("crampLevel"),
  mood: document.getElementById("mood"),
  notes: document.getElementById("notes"),
  symptomTags: document.getElementById("symptomTags"),
  selectedDayCard: document.getElementById("selectedDayCard"),
  doList: document.getElementById("doList"),
  dontList: document.getElementById("dontList")
};

init();

function init() {
  renderWeekdays();
  renderSymptomTags();
  populateForms();
  bindEvents();
  renderAll();
}

function bindEvents() {
  els.settingsForm.addEventListener("submit", (event) => {
    event.preventDefault();
    state.settings.cycleLength = clamp(Number(els.cycleLength.value), 20, 45);
    state.settings.periodLength = clamp(Number(els.periodLength.value), 2, 10);
    state.settings.lastPeriodStart = els.lastPeriodStart.value;
    state.settings.trackingGoal = els.trackingGoal.value;
    saveState();
    renderAll();
  });

  els.dailyLogForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const dateKey = els.logDate.value;

    state.entries[dateKey] = {
      flow: els.flowLevel.value,
      cramp: els.crampLevel.value,
      mood: els.mood.value,
      symptoms: [...selectedSymptoms],
      notes: els.notes.value.trim()
    };

    const shouldDeleteEntry =
      state.entries[dateKey].flow === "none" &&
      state.entries[dateKey].cramp === "none" &&
      state.entries[dateKey].mood === "steady" &&
      !state.entries[dateKey].notes &&
      state.entries[dateKey].symptoms.length === 0;

    if (shouldDeleteEntry) {
      delete state.entries[dateKey];
    }

    inferLastPeriodStart();
    saveState();
    selectedDateKey = dateKey;
    currentMonth = startOfMonth(parseDateKey(dateKey));
    renderAll();
  });

  els.prevMonth.addEventListener("click", () => {
    currentMonth = addMonths(currentMonth, -1);
    renderCalendar();
  });

  els.nextMonth.addEventListener("click", () => {
    currentMonth = addMonths(currentMonth, 1);
    renderCalendar();
  });
}

function populateForms() {
  const { settings } = state;
  els.cycleLength.value = settings.cycleLength;
  els.periodLength.value = settings.periodLength;
  els.lastPeriodStart.value = settings.lastPeriodStart;
  els.trackingGoal.value = settings.trackingGoal;
  els.logDate.value = selectedDateKey;
  populateDailyForm(selectedDateKey);
}

function renderAll() {
  populateForms();
  renderSummary();
  renderCalendar();
  renderSelectedDay();
  renderGuidance();
}

function renderWeekdays() {
  els.calendarWeekdays.innerHTML = WEEKDAYS.map((day) => `<div>${day}</div>`).join("");
}

function renderSymptomTags() {
  els.symptomTags.innerHTML = "";
  SYMPTOMS.forEach((symptom) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "tag-chip";
    button.textContent = symptom;
    button.addEventListener("click", () => {
      const exists = selectedSymptoms.includes(symptom);
      selectedSymptoms = exists
        ? selectedSymptoms.filter((item) => item !== symptom)
        : [...selectedSymptoms, symptom];
      renderSymptomTagState();
    });
    els.symptomTags.appendChild(button);
  });
}

function renderSymptomTagState() {
  [...els.symptomTags.children].forEach((node) => {
    node.classList.toggle("active", selectedSymptoms.includes(node.textContent));
  });
}

function renderSummary() {
  const today = new Date();
  const insights = calculateCycleInsights(today);
  const periodStart = parseDateKey(insights.nextPeriodStart);
  const ovulation = parseDateKey(insights.ovulationDate);

  els.todayStatus.textContent = insights.todayHeadline;
  els.todayMeta.textContent = insights.todayMeta;
  els.nextPeriodDate.textContent = formatLongDate(periodStart);
  els.periodCountdown.textContent = insights.daysUntilPeriod === 0
    ? "Predicted to start today."
    : `${insights.daysUntilPeriod} day${insights.daysUntilPeriod === 1 ? "" : "s"} until your next expected period.`;
  els.ovulationDate.textContent = formatLongDate(ovulation);
  els.fertileWindow.textContent = `${formatShortDate(parseDateKey(insights.fertileStart))} to ${formatShortDate(parseDateKey(insights.fertileEnd))}`;
  els.cycleDay.textContent = `Day ${insights.cycleDay}`;
  els.phaseName.textContent = insights.phaseDescription;
}

function renderCalendar() {
  els.calendarTitle.textContent = currentMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric"
  });

  const gridDates = getCalendarDates(currentMonth);
  els.calendarGrid.innerHTML = "";

  gridDates.forEach((date) => {
    const key = formatDateKey(date);
    const insights = calculateCycleInsights(date);
    const isToday = key === todayKey();
    const isSelected = key === selectedDateKey;
    const isCurrentMonth = date.getMonth() === currentMonth.getMonth();
    const entry = state.entries[key];

    const cell = document.createElement("button");
    cell.type = "button";
    cell.className = "calendar-day";

    if (!isCurrentMonth) cell.classList.add("other-month");
    if (isToday) cell.classList.add("today");
    if (isSelected) cell.classList.add("selected");
    if (insights.isPredictedPeriod) cell.classList.add("period-day");
    if (insights.isFertileWindow) cell.classList.add("fertile-day");
    if (insights.isOvulationDay) cell.classList.add("ovulation-day");

    const badges = [];
    if (insights.isPredictedPeriod) badges.push(`<span class="mini-badge period">Period</span>`);
    if (insights.isFertileWindow) badges.push(`<span class="mini-badge fertile">Fertile</span>`);
    if (insights.isOvulationDay) badges.push(`<span class="mini-badge ovulation">Ovulation</span>`);
    if (entry?.flow && entry.flow !== "none") badges.push(`<span class="mini-badge">${capitalize(entry.flow)} flow</span>`);

    cell.innerHTML = `
      <span class="day-number">${date.getDate()}</span>
      ${badges.join("")}
    `;

    cell.addEventListener("click", () => {
      selectedDateKey = key;
      els.logDate.value = key;
      populateDailyForm(key);
      renderCalendar();
      renderSelectedDay();
      renderGuidance();
    });

    els.calendarGrid.appendChild(cell);
  });
}

function renderSelectedDay() {
  const date = parseDateKey(selectedDateKey);
  const key = formatDateKey(date);
  const entry = state.entries[key];
  const insights = calculateCycleInsights(date);

  const blocks = [
    `<div class="detail-block"><h3>${formatLongDate(date)}</h3><p>${insights.daySummary}</p></div>`,
    `<div class="detail-block"><strong>Predicted phase:</strong> ${insights.phaseLabel}</div>`,
    `<div class="detail-block"><strong>Flow:</strong> ${entry ? capitalize(entry.flow) : "None logged"}</div>`,
    `<div class="detail-block"><strong>Cramp level:</strong> ${entry ? capitalize(entry.cramp) : "None logged"}</div>`,
    `<div class="detail-block"><strong>Mood:</strong> ${entry ? capitalize(entry.mood) : "None logged"}</div>`,
    `<div class="detail-block"><strong>Symptoms:</strong> ${entry?.symptoms?.length ? entry.symptoms.join(", ") : "None logged"}</div>`,
    `<div class="detail-block"><strong>Notes:</strong> ${entry?.notes ? escapeHtml(entry.notes) : "No notes yet."}</div>`
  ];

  els.selectedDayCard.innerHTML = blocks.join("");
}

function renderGuidance() {
  const insights = calculateCycleInsights(parseDateKey(selectedDateKey));
  const entry = state.entries[selectedDateKey];
  const doItems = [];
  const dontItems = [];

  if (insights.phase === "menstrual") {
    doItems.push("Prioritize hydration, iron-rich foods, and lighter movement if energy is low.");
    doItems.push("Use heat, stretching, and rest windows if cramps are strong.");
    dontItems.push("Do not ignore unusually severe pain, dizziness, or very heavy bleeding.");
    dontItems.push("Do not force intense training if your body wants recovery.");
  } else if (insights.phase === "follicular") {
    doItems.push("Use this phase for planning, focused work, and gradually increasing exercise.");
    doItems.push("Try protein-rich meals and consistent sleep to support energy.");
    dontItems.push("Do not overcommit just because energy improves for a few days.");
    dontItems.push("Do not skip meals if you are more active.");
  } else if (insights.phase === "ovulation") {
    doItems.push("Watch cervical mucus, libido, and energy changes if fertility awareness matters to you.");
    doItems.push("Stay hydrated and track any one-sided pain or spotting.");
    dontItems.push("Do not rely on predictions alone for pregnancy prevention.");
    dontItems.push("Do not ignore sudden severe pelvic pain.");
  } else {
    doItems.push("Make space for slower evenings, stable meals, and extra magnesium-rich foods.");
    doItems.push("Prepare for mood shifts, cravings, or bloating with lower-friction routines.");
    dontItems.push("Do not judge yourself harshly for lower energy or mood fluctuations.");
    dontItems.push("Do not overload your schedule right before your predicted period.");
  }

  if (entry?.cramp === "strong") {
    doItems.push("Because you logged strong cramps, monitor pain duration and what relieves it.");
    dontItems.push("Do not normalize pain that stops you from daily activities.");
  }

  if (entry?.mood === "low" || entry?.mood === "irritable") {
    doItems.push("Lower your decision load today and choose calming routines where possible.");
    dontItems.push("Do not assume difficult feelings will last forever; log patterns instead.");
  }

  els.doList.innerHTML = doItems.map((item) => `<li>${item}</li>`).join("");
  els.dontList.innerHTML = dontItems.map((item) => `<li>${item}</li>`).join("");
}

function populateDailyForm(dateKey) {
  const entry = state.entries[dateKey];
  els.logDate.value = dateKey;
  els.flowLevel.value = entry?.flow || "none";
  els.crampLevel.value = entry?.cramp || "none";
  els.mood.value = entry?.mood || "steady";
  els.notes.value = entry?.notes || "";
  selectedSymptoms = entry?.symptoms ? [...entry.symptoms] : [];
  renderSymptomTagState();
}

function calculateCycleInsights(date) {
  const { cycleLength, periodLength, lastPeriodStart, trackingGoal } = state.settings;
  const lastStart = parseDateKey(lastPeriodStart);
  const daysSinceLastStart = diffInDays(lastStart, date);
  const normalized = ((daysSinceLastStart % cycleLength) + cycleLength) % cycleLength;
  const cycleDay = normalized + 1;
  const nextPeriodOffset = cycleLength - normalized;
  const nextPeriodStart = addDays(date, normalized === 0 ? 0 : nextPeriodOffset);
  const currentCycleStart = addDays(date, -(cycleDay - 1));
  const ovulationDate = addDays(currentCycleStart, cycleLength - 14);
  const fertileStart = addDays(ovulationDate, -5);
  const fertileEnd = addDays(ovulationDate, 1);
  const isPredictedPeriod = cycleDay <= periodLength;
  const isOvulationDay = sameDay(date, ovulationDate);
  const isFertileWindow = date >= fertileStart && date <= fertileEnd;

  let phase = "luteal";
  let phaseLabel = "Luteal phase";
  let phaseDescription = "Post-ovulation phase; energy and mood can become more sensitive.";

  if (cycleDay <= periodLength) {
    phase = "menstrual";
    phaseLabel = "Menstrual phase";
    phaseDescription = "Period days; recovery, comfort, and symptom support matter most.";
  } else if (cycleDay < cycleLength - 14) {
    phase = "follicular";
    phaseLabel = "Follicular phase";
    phaseDescription = "Build-up phase; energy often rises and routines can feel easier.";
  } else if (Math.abs(diffInDays(date, ovulationDate)) === 0) {
    phase = "ovulation";
    phaseLabel = "Ovulation day";
    phaseDescription = "Estimated ovulation; fertile window is at its peak.";
  }

  const goalText = {
    balance: "tracking your rhythm",
    pregnancy: "watching fertility timing",
    awareness: "building body awareness",
    planning: "planning around your cycle"
  }[trackingGoal];

  const daysUntilPeriod = Math.max(0, diffInDays(date, nextPeriodStart));
  const todayHeadline = isPredictedPeriod
    ? `You are likely on period day ${cycleDay}.`
    : isOvulationDay
      ? "Today is your estimated ovulation day."
      : `You are in your ${phaseLabel.toLowerCase()}.`;

  const todayMeta = `Right now you are ${goalText}. Estimated fertile window: ${formatShortDate(fertileStart)} to ${formatShortDate(fertileEnd)}.`;
  const daySummary = isPredictedPeriod
    ? "This date falls in your predicted bleeding window."
    : isOvulationDay
      ? "This date is your estimated ovulation day."
      : isFertileWindow
        ? "This date falls inside your estimated fertile window."
        : `This date is in your ${phaseLabel.toLowerCase()}.`;

  return {
    cycleDay,
    phase,
    phaseLabel,
    phaseDescription,
    nextPeriodStart: formatDateKey(nextPeriodStart),
    ovulationDate: formatDateKey(ovulationDate),
    fertileStart: formatDateKey(fertileStart),
    fertileEnd: formatDateKey(fertileEnd),
    isPredictedPeriod,
    isFertileWindow,
    isOvulationDay,
    todayHeadline,
    todayMeta,
    daySummary,
    daysUntilPeriod
  };
}

function inferLastPeriodStart() {
  const bleedingDays = Object.keys(state.entries)
    .filter((key) => ["light", "medium", "heavy", "spotting"].includes(state.entries[key].flow))
    .sort();

  if (bleedingDays.length === 0) return;

  const recent = bleedingDays[bleedingDays.length - 1];
  let cursor = parseDateKey(recent);

  while (true) {
    const previous = addDays(cursor, -1);
    const prevKey = formatDateKey(previous);
    if (!state.entries[prevKey] || !["light", "medium", "heavy", "spotting"].includes(state.entries[prevKey].flow)) {
      break;
    }
    cursor = previous;
  }

  state.settings.lastPeriodStart = formatDateKey(cursor);
}

function getCalendarDates(monthDate) {
  const first = startOfMonth(monthDate);
  const start = addDays(first, -first.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(start, index));
}

function loadState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    return saved
      ? { ...DEFAULT_STATE, ...saved, settings: { ...DEFAULT_STATE.settings, ...saved.settings } }
      : structuredClone(DEFAULT_STATE);
  } catch {
    return structuredClone(DEFAULT_STATE);
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function addMonths(date, amount) {
  return new Date(date.getFullYear(), date.getMonth() + amount, 1);
}

function addDays(date, amount) {
  const copy = new Date(date);
  copy.setDate(copy.getDate() + amount);
  return copy;
}

function diffInDays(fromDate, toDate) {
  const oneDay = 1000 * 60 * 60 * 24;
  const from = Date.UTC(fromDate.getFullYear(), fromDate.getMonth(), fromDate.getDate());
  const to = Date.UTC(toDate.getFullYear(), toDate.getMonth(), toDate.getDate());
  return Math.round((to - from) / oneDay);
}

function sameDay(a, b) {
  return formatDateKey(a) === formatDateKey(b);
}

function formatDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function parseDateKey(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function todayKey() {
  return formatDateKey(new Date());
}

function formatLongDate(date) {
  return date.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function formatShortDate(date) {
  return date.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short"
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
