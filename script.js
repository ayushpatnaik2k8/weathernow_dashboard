const STORAGE_KEYS = {
  CITY: "weathernow_last_city",
  UNIT: "weathernow_unit",
  COORDS: "weathernow_last_coords"
};

const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const suggestionsList = document.getElementById("suggestions-list");
const unitToggle = document.getElementById("unit-toggle");
const geoBtn = document.getElementById("geo-btn");
const errorMsg = document.getElementById("error-msg");
const drizzleLayer = document.getElementById("drizzle-layer");

const timeGreetingEl = document.getElementById("time-greeting");
const railCityEl = document.getElementById("rail-city");
const railTempEl = document.getElementById("rail-temp");
const railEmojiEl = document.getElementById("rail-emoji");
const railRangeEl = document.getElementById("rail-range");

const currentCityEl = document.getElementById("current-city");
const currentConditionEl = document.getElementById("current-condition");
const currentEmojiEl = document.getElementById("current-emoji");
const currentTempEl = document.getElementById("current-temp");
const currentHumidityEl = document.getElementById("current-humidity");
const currentWindEl = document.getElementById("current-wind");
const currentWindDirEl = document.getElementById("current-wind-dir");
const currentSunriseEl = document.getElementById("current-sunrise");
const currentSunsetEl = document.getElementById("current-sunset");

const overviewHourlyTitleEl = document.getElementById("overview-hourly-title");
const fullHourlyTitleEl = document.getElementById("full-hourly-title");
const openFullHourlyBtn = document.getElementById("open-full-hourly-btn");
const hourlyDayTabsEl = document.getElementById("hourly-day-tabs");
const hourlyStripEl = document.getElementById("hourly-strip");
const hourlyGridFullEl = document.getElementById("hourly-grid-full");
const forecastGridEl = document.getElementById("forecast-grid");
const forecastGridFullEl = document.getElementById("forecast-grid-full");

const navButtons = document.querySelectorAll(".nav-bubble");
const viewPanels = {
  overview: document.getElementById("view-overview"),
  forecast: document.getElementById("view-forecast"),
  hourly: document.getElementById("view-hourly"),
  details: document.getElementById("view-details"),
  atmosphere: document.getElementById("view-atmosphere"),
  sun: document.getElementById("view-sun"),
  moon: document.getElementById("view-moon"),
  activities: document.getElementById("view-activities")
};

let currentUnit = localStorage.getItem(STORAGE_KEYS.UNIT) === "F" ? "F" : "C";
let latestWeatherData = null;
let selectedDayIndex = 0;
let typingTimer = null;

function initDrizzleParticles() {
  if (!drizzleLayer) return;
  drizzleLayer.innerHTML = "";
  for (let i = 0; i < 65; i++) {
    const drop = document.createElement("span");
    drop.className = "raindrop";
    drop.style.left = `${Math.random() * 110}%`;
    drop.style.animationDuration = `${0.65 + Math.random() * 0.55}s`;
    drop.style.animationDelay = `${-Math.random() * 2}s`;
    drizzleLayer.appendChild(drop);
  }
}

initDrizzleParticles();

function switchView(targetView) {
  navButtons.forEach((b) => {
    b.classList.toggle("active", b.dataset.view === targetView);
  });
  Object.entries(viewPanels).forEach(([key, panel]) => {
    if (!panel) return;
    panel.hidden = key !== targetView;
  });
}

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    switchView(btn.dataset.view);
  });
});

if (openFullHourlyBtn) {
  openFullHourlyBtn.addEventListener("click", () => {
    switchView("hourly");
  });
}

function updateGreeting() {
  if (!timeGreetingEl) return;
  const hour = new Date().getHours();
  if (hour < 12) timeGreetingEl.textContent = "Good morning";
  else if (hour < 18) timeGreetingEl.textContent = "Good afternoon";
  else timeGreetingEl.textContent = "Good evening";
}

function mapWeatherCode(code) {
  if (code === 0) return { label: "Sunny / Clear", emoji: "☀️", theme: "theme-clear" };
  if (code === 1 || code === 2) return { label: "Partly Cloudy", emoji: "⛅", theme: "theme-cloudy" };
  if (code === 3) return { label: "Cloudy", emoji: "☁️", theme: "theme-cloudy" };
  if (code === 45 || code === 48) return { label: "Foggy / Mist", emoji: "🌫️", theme: "theme-fog" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: "Rain / Drizzle", emoji: "🌧️", theme: "theme-rain" };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { label: "Snow", emoji: "❄️", theme: "theme-snow" };
  }
  if (code >= 95) return { label: "Thunderstorm", emoji: "⛈️", theme: "theme-storm" };
  return { label: "Partly Cloudy", emoji: "🌤️", theme: "theme-cloudy" };
}

function getWindDirectionInfo(deg) {
  const normalized = ((deg % 360) + 360) % 360;
  const dirs = [
    { short: "N", full: "North" },
    { short: "NE", full: "Northeast" },
    { short: "E", full: "East" },
    { short: "SE", full: "Southeast" },
    { short: "S", full: "South" },
    { short: "SW", full: "Southwest" },
    { short: "W", full: "West" },
    { short: "NW", full: "Northwest" }
  ];
  const idx = Math.round(normalized / 45) % 8;
  return {
    deg: Math.round(normalized),
    short: dirs[idx].short,
    full: dirs[idx].full
  };
}

function getAqiCategory(aqi) {
  if (aqi <= 25) return "Good";
  if (aqi <= 50) return "Fair";
  if (aqi <= 75) return "Moderate";
  if (aqi <= 100) return "Poor";
  return "Very Poor";
}

function getMoonPhaseName(phase) {
  if (phase == null || Number.isNaN(phase)) return "Waxing Gibbous";
  if (phase < 0.03 || phase > 0.97) return "New Moon";
  if (phase < 0.22) return "Waxing Crescent";
  if (phase < 0.28) return "First Quarter";
  if (phase < 0.47) return "Waxing Gibbous";
  if (phase < 0.53) return "Full Moon";
  if (phase < 0.72) return "Waning Gibbous";
  if (phase < 0.78) return "Last Quarter";
  return "Waning Crescent";
}

/* Regional Meteorological Alert (IMD for India, National Met Dept for Foreign) */
function renderMetAlert(data) {
  const bannerEl = document.getElementById("met-alert-banner");
  const badgeEl = document.getElementById("alert-badge");
  const authEl = document.getElementById("alert-authority");
  const msgEl = document.getElementById("alert-message");
  const tagEl = document.getElementById("alert-level-code");
  if (!bannerEl || !badgeEl || !authEl || !msgEl || !tagEl) return;

  const isIndia =
    /india/i.test(data.countryName || "") ||
    /india/i.test(data.locationLabel || "") ||
    (data.lat >= 6 && data.lat <= 37.5 && data.lon >= 68 && data.lon <= 97.5);

  const authority = isIndia
    ? "Indian Meteorological Department (IMD)"
    : `${data.countryName || "Regional"} Meteorological Department`;

  let colorKey = "green";
  let badgeText = "GREEN ALERT";
  let tagText = "NO WARNING";
  let detailText = isIndia
    ? "Green — No Warning: Normal weather conditions; no severe advisory issued."
    : "Green — Normal: Weather conditions are settled with no meteorological warning.";

  if (data.currentCode >= 95 || data.windKmh >= 50) {
    colorKey = "red";
    badgeText = "RED ALERT";
    tagText = "TAKE ACTION";
    detailText = isIndia
      ? "Red — Take Action: Severe weather / thunderstorm or high winds expected; stay indoors and avoid travel."
      : "Red — Take Action / Warning: Severe weather hazard expected; follow local emergency guidance.";
  } else if (
    (data.currentCode >= 63 && data.currentCode <= 67) ||
    (data.currentCode >= 81 && data.currentCode <= 82) ||
    data.windKmh >= 35
  ) {
    colorKey = "orange";
    badgeText = "ORANGE ALERT";
    tagText = "BE PREPARED";
    detailText = isIndia
      ? "Orange — Be Prepared: Heavy rain or strong winds likely; prepare for commute or power disruptions."
      : "Orange — Be Prepared: Significant weather event expected; prepare for travel or utility disruptions.";
  } else if (
    data.currentCode === 45 ||
    data.currentCode === 48 ||
    (data.currentCode >= 51 && data.currentCode <= 61) ||
    data.currentCode === 80 ||
    data.windKmh >= 24
  ) {
    colorKey = "yellow";
    badgeText = "YELLOW ALERT";
    tagText = "BE AWARE";
    detailText = isIndia
      ? "Yellow — Be Aware: Moderate rain, mist/fog, or breezy conditions possible; stay updated on local weather."
      : "Yellow — Be Aware: Advisory weather conditions (rain, mist, or gusty breeze); stay alert.";
  }

  bannerEl.classList.remove("alert-green", "alert-yellow", "alert-orange", "alert-red");
  bannerEl.classList.add(`alert-${colorKey}`);
  badgeEl.textContent = badgeText;
  authEl.textContent = authority;
  msgEl.textContent = detailText;
  tagEl.textContent = tagText;
}

function formatTemp(tempC) {
  if (currentUnit === "F") {
    return `${Math.round((tempC * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

function formatClockTime(isoString) {
  if (!isoString) return "--:--";
  const timePart = isoString.includes("T") ? isoString.split("T")[1] : isoString;
  if (!timePart) return isoString;
  const [hourStr, minStr] = timePart.split(":");
  let hour = parseInt(hourStr, 10);
  if (Number.isNaN(hour)) return isoString;
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${minStr} ${ampm}`;
}

function parseMinutesFromIso(isoString) {
  if (!isoString) return null;
  const timePart = isoString.includes("T") ? isoString.split("T")[1] : isoString;
  const parts = timePart.split(":").map(Number);
  if (parts.length < 2 || Number.isNaN(parts[0]) || Number.isNaN(parts[1])) return null;
  return parts[0] * 60 + parts[1];
}

function computeArcCoords(progress) {
  const clamped = Math.min(1, Math.max(0, progress));
  if (clamped <= 0.5) {
    const t = clamped * 2;
    const mt = 1 - t;
    return {
      x: mt * mt * mt * 75 + 3 * mt * mt * t * 122 + 3 * mt * t * t * 158 + t * t * t * 210,
      y: mt * mt * mt * 112 + 3 * mt * mt * t * 65 + 3 * mt * t * t * 26 + t * t * t * 26
    };
  }
  const t = (clamped - 0.5) * 2;
  const mt = 1 - t;
  return {
    x: mt * mt * mt * 210 + 3 * mt * mt * t * 262 + 3 * mt * t * t * 298 + t * t * t * 345,
    y: mt * mt * mt * 26 + 3 * mt * mt * t * 26 + 3 * mt * t * t * 65 + t * t * t * 112
  };
}

function applyTheme(themeClass) {
  document.body.classList.remove(
    "theme-clear",
    "theme-cloudy",
    "theme-fog",
    "theme-rain",
    "theme-storm",
    "theme-snow"
  );
  document.body.classList.add(themeClass);
}

function formatDayLabel(dateStr, index) {
  if (index === 0) return "Today";
  const date = new Date(`${dateStr}T00:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function formatFullDayTitle(dateStr, index) {
  const date = new Date(`${dateStr}T00:00:00`);
  const formatted = date.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" });
  return index === 0 ? `Today (${formatted})` : formatted;
}

function getHoursForDay(data, dayIndex) {
  const targetDate = data.daily[dayIndex]?.date;
  if (!targetDate) return [];
  return data.allHourly.filter((item) => item.time.startsWith(targetDate));
}

function populateHourlyGrid(container, hours, limit, currentHourPrefix = "") {
  if (!container) return;
  container.innerHTML = "";
  hours.slice(0, limit).forEach((item) => {
    const info = mapWeatherCode(item.code);
    const isNow = currentHourPrefix && item.time.startsWith(currentHourPrefix);
    const card = document.createElement("div");
    card.className = "hourly-card";
    card.innerHTML = `
      <div class="hourly-time">${isNow ? "Now" : formatClockTime(item.time)}</div>
      <div class="hourly-emoji" aria-hidden="true">${info.emoji}</div>
      <div class="hourly-temp">${formatTemp(item.tempC)}</div>
      <div class="hourly-cond">${info.label}</div>
    `;
    container.appendChild(card);
  });
}

function renderSelectedDayHourly() {
  if (!latestWeatherData) return;
  const dayObj = latestWeatherData.daily[selectedDayIndex];
  const dayTitle = formatFullDayTitle(dayObj.date, selectedDayIndex);
  const dayHours = getHoursForDay(latestWeatherData, selectedDayIndex);

  if (overviewHourlyTitleEl) {
    overviewHourlyTitleEl.textContent = `Hourly Forecast — ${formatDayLabel(dayObj.date, selectedDayIndex)}`;
  }
  if (fullHourlyTitleEl) {
    fullHourlyTitleEl.textContent = `24-Hour Forecast — ${dayTitle}`;
  }

  const threeHourlySlice = dayHours.filter((_, idx) => idx % 3 === 0);
  populateHourlyGrid(
    hourlyStripEl,
    threeHourlySlice,
    8,
    selectedDayIndex === 0 ? latestWeatherData.currentHourPrefix : ""
  );

  populateHourlyGrid(
    hourlyGridFullEl,
    dayHours,
    24,
    selectedDayIndex === 0 ? latestWeatherData.currentHourPrefix : ""
  );

  if (hourlyDayTabsEl) {
    hourlyDayTabsEl.innerHTML = "";
    latestWeatherData.daily.forEach((d, idx) => {
      const tab = document.createElement("button");
      tab.type = "button";
      tab.className = `day-tab-btn${idx === selectedDayIndex ? " active" : ""}`;
      tab.textContent = formatDayLabel(d.date, idx);
      tab.addEventListener("click", () => {
        selectedDayIndex = idx;
        renderSelectedDayHourly();
        populateForecastGrid(forecastGridEl, latestWeatherData.daily, false);
        populateForecastGrid(forecastGridFullEl, latestWeatherData.daily, true);
      });
      hourlyDayTabsEl.appendChild(tab);
    });
  }
}

function populateForecastGrid(container, daily, openHourlyOnClick) {
  if (!container) return;
  container.innerHTML = "";
  daily.forEach((day, idx) => {
    const dayInfo = mapWeatherCode(day.code);
    const card = document.createElement("div");
    card.className = `forecast-card${idx === selectedDayIndex ? " selected-day" : ""}`;
    card.setAttribute("role", "button");
    card.tabIndex = 0;
    card.title = `Click to view 24-hour forecast for ${formatDayLabel(day.date, idx)}`;
    card.innerHTML = `
      <div class="forecast-day">${formatDayLabel(day.date, idx)}</div>
      <div class="forecast-emoji" aria-hidden="true">${dayInfo.emoji}</div>
      <div class="forecast-condition">${dayInfo.label}</div>
      <div class="forecast-temps">${formatTemp(day.maxC)} / ${formatTemp(day.minC)}</div>
    `;

    const handleSelectDay = () => {
      selectedDayIndex = idx;
      renderSelectedDayHourly();
      populateForecastGrid(forecastGridEl, daily, false);
      populateForecastGrid(forecastGridFullEl, daily, true);
      if (openHourlyOnClick) {
        switchView("hourly");
      }
    };

    card.addEventListener("click", handleSelectDay);
    card.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        handleSelectDay();
      }
    });

    container.appendChild(card);
  });
}

function renderAtmosphereSunMoonAndActivities(data) {
  const atmoBadge = document.getElementById("atmo-city-badge");
  const sunBadge = document.getElementById("sun-city-badge");
  const moonBadge = document.getElementById("moon-city-badge");
  const actBadge = document.getElementById("activities-city-badge");
  if (atmoBadge) atmoBadge.textContent = data.locationLabel;
  if (sunBadge) sunBadge.textContent = data.locationLabel;
  if (moonBadge) moonBadge.textContent = data.locationLabel;
  if (actBadge) actBadge.textContent = data.locationLabel;

  const windInfo = getWindDirectionInfo(data.windDirDeg);

  // 1. Airflow Direction with Compass
  const airflowValEl = document.getElementById("atmo-airflow-val");
  const airflowSpeedEl = document.getElementById("atmo-airflow-speed");
  const airflowDescEl = document.getElementById("atmo-airflow-desc");
  const compassNeedleEl = document.getElementById("airflow-compass-needle");
  if (airflowValEl) airflowValEl.textContent = `${windInfo.short} (${windInfo.deg}°)`;
  if (airflowSpeedEl) airflowSpeedEl.textContent = `${Math.round(data.windKmh)} km/h`;
  if (airflowDescEl) {
    airflowDescEl.textContent = `Airflow from ${windInfo.full} (${windInfo.deg}°) · Speed ${Math.round(data.windKmh)} km/h`;
  }
  if (compassNeedleEl) {
    compassNeedleEl.setAttribute("transform", `translate(55,55) rotate(${windInfo.deg})`);
  }

  // 2. AQI, PM2.5 & PM10
  const aqiVal = Math.round(data.aqi);
  const aqiStatus = getAqiCategory(aqiVal);
  const aqiValEl = document.getElementById("atmo-aqi-val");
  const aqiStatusEl = document.getElementById("atmo-aqi-status");
  const aqiDescEl = document.getElementById("atmo-aqi-desc");
  const aqiMarkerEl = document.getElementById("atmo-aqi-marker");
  const pm25El = document.getElementById("atmo-pm25");
  const pm10El = document.getElementById("atmo-pm10");
  if (aqiValEl) aqiValEl.textContent = `${aqiVal}`;
  if (aqiStatusEl) aqiStatusEl.textContent = aqiStatus;
  if (aqiDescEl) {
    aqiDescEl.textContent = `${aqiStatus} air quality · Clean ambient airflow`;
  }
  if (aqiMarkerEl) {
    const aqiPct = Math.min(96, Math.max(4, (aqiVal / 120) * 100));
    aqiMarkerEl.style.left = `${aqiPct}%`;
  }
  if (pm25El) pm25El.textContent = data.pm25.toFixed(1);
  if (pm10El) pm10El.textContent = data.pm10.toFixed(1);

  // 3. Visibility
  const visKm = (data.visibilityMeters / 1000).toFixed(1);
  let visStatus = "Good";
  let visDesc = "Clear horizontal sightline across open roads and surroundings.";
  if (data.visibilityMeters < 2000) {
    visStatus = "Poor";
    visDesc = "Reduced visibility due to mist, fog, or heavy precipitation.";
  } else if (data.visibilityMeters < 6000) {
    visStatus = "Moderate";
    visDesc = "Light haze in the distance; normal local visibility.";
  }
  const visValEl = document.getElementById("atmo-visibility-val");
  const visStatusEl = document.getElementById("atmo-visibility-status");
  const visDescEl = document.getElementById("atmo-visibility-desc");
  if (visValEl) visValEl.textContent = `${visKm} km`;
  if (visStatusEl) visStatusEl.textContent = visStatus;
  if (visDescEl) visDescEl.textContent = visDesc;

  // 4. UV Index
  const uv = Math.round(data.uvIndex * 10) / 10;
  let uvStatus = "Low";
  let uvDesc = "Minimal UV exposure; safe for outdoor activities.";
  if (uv >= 8) {
    uvStatus = "Very High";
    uvDesc = "Strong solar radiation — seek shade and wear sun protection.";
  } else if (uv >= 6) {
    uvStatus = "High";
    uvDesc = "High UV levels — sunscreen and sunglasses advised.";
  } else if (uv >= 3) {
    uvStatus = "Moderate";
    uvDesc = "Moderate solar UV radiation — sunglasses recommended midday.";
  }
  const uvValEl = document.getElementById("atmo-uv-val");
  const uvStatusEl = document.getElementById("atmo-uv-status");
  const uvDescEl = document.getElementById("atmo-uv-desc");
  const uvMarkerEl = document.getElementById("atmo-uv-marker");
  if (uvValEl) uvValEl.textContent = `${uv}`;
  if (uvStatusEl) uvStatusEl.textContent = uvStatus;
  if (uvDescEl) uvDescEl.textContent = uvDesc;
  if (uvMarkerEl) {
    const pct = Math.min(100, Math.max(4, (uv / 11) * 100));
    uvMarkerEl.style.left = `${pct}%`;
  }

  // 5. Air Pressure
  const pHpa = Math.round(data.pressure);
  const pValEl = document.getElementById("atmo-pressure-val");
  const pTrendEl = document.getElementById("atmo-pressure-trend");
  const pDescEl = document.getElementById("atmo-pressure-desc");
  if (pValEl) pValEl.textContent = `${pHpa} hPa`;
  if (pTrendEl) pTrendEl.textContent = data.pressureTrend;
  if (pDescEl) {
    pDescEl.textContent =
      pHpa >= 1016
        ? "High barometric pressure — typically associated with settled weather."
        : pHpa <= 1006
        ? "Lower barometric pressure — unsettled or breezy conditions possible."
        : "Standard atmospheric sea-level barometric pressure.";
  }

  // 6. Graphical Sunrise & Sunset Solar Arc
  const srEl = document.getElementById("atmo-sunrise-time");
  const ssEl = document.getElementById("atmo-sunset-time");
  const solarStatusEl = document.getElementById("atmo-solar-status");
  const daylightBadgeEl = document.getElementById("atmo-daylight-badge");
  const sunMarker = document.getElementById("sun-live-marker");

  if (srEl) srEl.textContent = data.sunrise;
  if (ssEl) ssEl.textContent = data.sunset;

  const nowMins = parseMinutesFromIso(data.currentTimeIso) ?? 720;
  const srMins = parseMinutesFromIso(data.sunriseIso) ?? 360;
  const ssMins = parseMinutesFromIso(data.sunsetIso) ?? 1080;
  const totalDayMins = Math.max(1, ssMins - srMins);
  const dayHours = Math.floor(totalDayMins / 60);
  const dayRemMins = totalDayMins % 60;
  if (daylightBadgeEl) daylightBadgeEl.textContent = `${dayHours}h ${dayRemMins}m Daylight`;

  let sunProgress = (nowMins - srMins) / totalDayMins;
  const isDaytime = sunProgress >= 0 && sunProgress <= 1;
  sunProgress = Math.min(1, Math.max(0, sunProgress));

  if (solarStatusEl) {
    solarStatusEl.textContent = isDaytime
      ? `Daylight · ${Math.round(sunProgress * 100)}% of solar arc`
      : "Nighttime · Sun below horizon";
  }

  if (sunMarker) {
    const pt = computeArcCoords(sunProgress);
    sunMarker.setAttribute("transform", `translate(${pt.x.toFixed(1)}, ${pt.y.toFixed(1)})`);
  }

  // 7. Graphical Moonrise & Moonset Lunar Arc
  const mrEl = document.getElementById("moon-rise-time");
  const msEl = document.getElementById("moon-set-time");
  const moonPhaseEl = document.getElementById("moon-phase-label");
  const moonCycleEl = document.getElementById("moon-cycle-badge");
  const moonStatusEl = document.getElementById("moon-status-text");
  const moonMarker = document.getElementById("moon-live-marker");

  const phaseName = getMoonPhaseName(data.moonPhase);
  if (moonPhaseEl) moonPhaseEl.textContent = `LUNAR ARC · ${phaseName.toUpperCase()}`;
  if (moonCycleEl) {
    const illumPct = data.moonPhase != null ? Math.round(Math.sin(data.moonPhase * Math.PI) * 100) : 68;
    moonCycleEl.textContent = `${illumPct}% Illumination`;
  }

  const mrMins = parseMinutesFromIso(data.moonriseIso);
  const msMins = parseMinutesFromIso(data.moonsetIso);
  if (mrEl) mrEl.textContent = mrMins != null ? formatClockTime(data.moonriseIso) : "07:15 PM";
  if (msEl) msEl.textContent = msMins != null ? formatClockTime(data.moonsetIso) : "06:30 AM";

  let moonProgress = 0.45;
  if (mrMins != null && msMins != null) {
    let span = msMins - mrMins;
    if (span <= 0) span += 1440;
    let elapsed = nowMins - mrMins;
    if (elapsed < 0) elapsed += 1440;
    moonProgress = Math.min(1, Math.max(0, elapsed / span));
  }

  if (moonStatusEl) {
    moonStatusEl.textContent = `${phaseName} · ${Math.round(moonProgress * 100)}% of lunar arc`;
  }
  if (moonMarker) {
    const mPt = computeArcCoords(moonProgress);
    moonMarker.setAttribute("transform", `translate(${mPt.x.toFixed(1)}, ${mPt.y.toFixed(1)})`);
  }

  // 8. Six Activities Suitability Cards
  const isRainyOrStorm =
    (data.currentCode >= 51 && data.currentCode <= 67) ||
    (data.currentCode >= 80 && data.currentCode <= 82) ||
    data.currentCode >= 95;
  const isFoggy = data.currentCode === 45 || data.currentCode === 48;
  const isBreezy = data.windKmh > 25;

  const outdoorEl = document.getElementById("act-outdoor-rating");
  const outdoorNoteEl = document.getElementById("act-outdoor-note");
  if (outdoorEl && outdoorNoteEl) {
    if (isRainyOrStorm || aqiVal > 100) {
      outdoorEl.textContent = "Poor";
      outdoorNoteEl.textContent = isRainyOrStorm ? "Wet weather & rain" : "High air pollution";
    } else if (aqiVal > 60 || isFoggy) {
      outdoorEl.textContent = "Fair";
      outdoorNoteEl.textContent = isFoggy ? "Misty conditions" : "Moderate AQI";
    } else {
      outdoorEl.textContent = "Good";
      outdoorNoteEl.textContent = `${aqiStatus} AQI & pleasant weather`;
    }
  }

  const starEl = document.getElementById("act-stargazing-rating");
  const starNoteEl = document.getElementById("act-stargazing-note");
  if (starEl && starNoteEl) {
    if (isRainyOrStorm || isFoggy) {
      starEl.textContent = "Poor";
      starNoteEl.textContent = "Clouds / mist block sky";
    } else if (data.currentCode <= 1 && data.visibilityMeters >= 8000) {
      starEl.textContent = "Good";
      starNoteEl.textContent = "Clear skies & high visibility";
    } else {
      starEl.textContent = "Fair";
      starNoteEl.textContent = "Partial cloud cover";
    }
  }

  const fishingEl = document.getElementById("act-fishing-rating");
  const fishingNoteEl = document.getElementById("act-fishing-note");
  if (fishingEl && fishingNoteEl) {
    if (data.currentCode >= 95 || data.windKmh > 35) {
      fishingEl.textContent = "Poor";
      fishingNoteEl.textContent = "Rough wind or storm risk";
    } else if (isRainyOrStorm || isBreezy) {
      fishingEl.textContent = "Fair";
      fishingNoteEl.textContent = "Breezy or light rain";
    } else {
      fishingEl.textContent = "Good";
      fishingNoteEl.textContent = "Calm water & steady wind";
    }
  }

  const sailingEl = document.getElementById("act-sailing-rating");
  const sailingNoteEl = document.getElementById("act-sailing-note");
  if (sailingEl && sailingNoteEl) {
    if (data.currentCode >= 95 || data.windKmh > 40 || data.visibilityMeters < 1500) {
      sailingEl.textContent = "Poor";
      sailingNoteEl.textContent = "Squall / low visibility hazard";
    } else if (data.windKmh < 8 || isRainyOrStorm) {
      sailingEl.textContent = "Fair";
      sailingNoteEl.textContent = data.windKmh < 8 ? "Light wind for sails" : "Light rain showers";
    } else {
      sailingEl.textContent = "Good";
      sailingNoteEl.textContent = `Steady ${Math.round(data.windKmh)} km/h breeze`;
    }
  }

  const coldEl = document.getElementById("act-cold-rating");
  const coldNoteEl = document.getElementById("act-cold-note");
  if (coldEl && coldNoteEl) {
    if (data.apparentTempC <= 12) {
      coldEl.textContent = "High risk";
      coldNoteEl.textContent = `Chilly ${formatTemp(data.apparentTempC)} feels-like`;
    } else if (data.apparentTempC <= 19) {
      coldEl.textContent = "Moderate";
      coldNoteEl.textContent = `Cool ${formatTemp(data.apparentTempC)} temperature`;
    } else {
      coldEl.textContent = "Low risk";
      coldNoteEl.textContent = `Warm ${formatTemp(data.apparentTempC)} feels-like`;
    }
  }

  const mosquitoEl = document.getElementById("act-mosquito-rating");
  const mosquitoNoteEl = document.getElementById("act-mosquito-note");
  if (mosquitoEl && mosquitoNoteEl) {
    if (data.humidity >= 75 && data.windKmh < 12 && data.tempC >= 20) {
      mosquitoEl.textContent = "Very high";
      mosquitoNoteEl.textContent = `High humidity (${Math.round(data.humidity)}%) & calm air`;
    } else if (data.humidity >= 60 && data.windKmh < 18) {
      mosquitoEl.textContent = "Moderate";
      mosquitoNoteEl.textContent = "Moderate humidity & light breeze";
    } else {
      mosquitoEl.textContent = "Low";
      mosquitoNoteEl.textContent = data.windKmh >= 18 ? "Breeze deters mosquitoes" : "Lower humidity";
    }
  }
}

function renderWeather(data) {
  latestWeatherData = data;
  const info = mapWeatherCode(data.currentCode);
  const windInfo = getWindDirectionInfo(data.windDirDeg);
  const formattedTemp = formatTemp(data.tempC);

  updateGreeting();
  applyTheme(info.theme);
  renderMetAlert(data);

  currentCityEl.textContent = data.locationLabel;
  currentConditionEl.textContent = info.label;
  currentEmojiEl.textContent = info.emoji;
  currentTempEl.textContent = formattedTemp;
  currentHumidityEl.textContent = `${Math.round(data.humidity)}%`;
  currentWindEl.textContent = `${Math.round(data.windKmh)} km/h`;
  if (currentWindDirEl) currentWindDirEl.textContent = `${windInfo.short} (${windInfo.deg}°)`;
  if (currentSunriseEl) currentSunriseEl.textContent = data.sunrise;
  if (currentSunsetEl) currentSunsetEl.textContent = data.sunset;

  if (railCityEl) railCityEl.textContent = data.city;
  if (railTempEl) railTempEl.textContent = formattedTemp;
  if (railEmojiEl) railEmojiEl.textContent = info.emoji;
  if (railRangeEl && data.daily[0]) {
    railRangeEl.textContent = `H ${formatTemp(data.daily[0].maxC)} · L ${formatTemp(data.daily[0].minC)}`;
  }

  const hourlyBadge = document.getElementById("hourly-city-badge");
  const forecastBadge = document.getElementById("forecast-city-badge");
  const detailsBadge = document.getElementById("details-city-badge");

  const detailTemp = document.getElementById("detail-temp");
  const detailFeels = document.getElementById("detail-feels");
  const detailHumidity = document.getElementById("detail-humidity");
  const detailPrecip = document.getElementById("detail-precip");
  const detailWind = document.getElementById("detail-wind");
  const detailWindDir = document.getElementById("detail-wind-dir");
  const detailSun = document.getElementById("detail-sun");
  const detailRange = document.getElementById("detail-range");

  if (hourlyBadge) hourlyBadge.textContent = data.locationLabel;
  if (forecastBadge) forecastBadge.textContent = data.locationLabel;
  if (detailsBadge) detailsBadge.textContent = data.locationLabel;

  if (detailTemp) detailTemp.textContent = formattedTemp;
  if (detailFeels) detailFeels.textContent = `Feels like ${formatTemp(data.apparentTempC)}`;
  if (detailHumidity) detailHumidity.textContent = `${Math.round(data.humidity)}%`;
  if (detailPrecip) detailPrecip.textContent = `Precipitation probability: ${data.precipProb}%`;
  if (detailWind) detailWind.textContent = `${windInfo.short} · ${Math.round(data.windKmh)} km/h`;
  if (detailWindDir) detailWindDir.textContent = `Direction: ${windInfo.full} (${windInfo.deg}°)`;
  if (detailSun) detailSun.textContent = `${data.sunrise} / ${data.sunset}`;
  if (detailRange && data.daily[0]) {
    detailRange.textContent = `High ${formatTemp(data.daily[0].maxC)} / Low ${formatTemp(data.daily[0].minC)}`;
  }

  renderSelectedDayHourly();
  populateForecastGrid(forecastGridEl, data.daily, false);
  populateForecastGrid(forecastGridFullEl, data.daily, true);
  renderAtmosphereSunMoonAndActivities(data);
}

function extractLocalityDetails(address, fallbackName) {
  if (!address) {
    return {
      shortName: fallbackName || "Current Location",
      fullLabel: fallbackName || "Current Location",
      countryName: ""
    };
  }

  const villageOrLocality =
    address.village ||
    address.hamlet ||
    address.suburb ||
    address.neighbourhood ||
    address.quarter ||
    address.town ||
    address.city ||
    address.county ||
    fallbackName ||
    "Current Location";

  const districtOrCity =
    address.state_district ||
    address.city ||
    address.town ||
    address.county ||
    "";

  const state = address.state || "";
  const country = address.country || "";
  const parts = [villageOrLocality];

  if (districtOrCity && districtOrCity.toLowerCase() !== villageOrLocality.toLowerCase()) {
    parts.push(districtOrCity.replace(/\s+District$/i, ""));
  }
  if (state && state.toLowerCase() !== villageOrLocality.toLowerCase()) {
    parts.push(state);
  }

  return {
    shortName: villageOrLocality,
    fullLabel: parts.join(", "),
    countryName: country
  };
}

/* =========================================================
   Spelling-Tolerant Search & Live Autocomplete Helpers
   ========================================================= */
function normalizePhonetic(str) {
  return str
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .replace(/(.)\1+/g, "$1")
    .replace(/ph/g, "f")
    .replace(/bh/g, "b")
    .replace(/sh/g, "s")
    .replace(/th/g, "t")
    .replace(/kh/g, "k")
    .replace(/gh/g, "g")
    .trim();
}

function levenshteinDistance(a, b) {
  const m = a.length;
  const n = b.length;
  const dp = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));
  for (let i = 0; i <= m; i++) dp[i][0] = i;
  for (let j = 0; j <= n; j++) dp[0][j] = j;
  for (let i = 1; i <= m; i++) {
    for (let j = 1; j <= n; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      dp[i][j] = Math.min(dp[i - 1][j] + 1, dp[i][j - 1] + 1, dp[i - 1][j - 1] + cost);
    }
  }
  return dp[m][n];
}

function scorePlaceMatch(query, candidateName) {
  const qNorm = normalizePhonetic(query);
  const cNorm = normalizePhonetic(candidateName);
  if (!qNorm || !cNorm) return 999;
  if (cNorm.startsWith(qNorm)) return 0;
  if (cNorm.includes(qNorm)) return 1;
  return levenshteinDistance(qNorm, cNorm);
}

async function searchFuzzyPlaces(rawQuery) {
  const clean = rawQuery.trim();
  if (!clean) return [];

  const variants = [clean];
  const collapsed = clean.replace(/(.)\1+/gi, "$1");
  if (collapsed.toLowerCase() !== clean.toLowerCase()) variants.push(collapsed);

  const results = [];
  const seenKeys = new Set();

  for (const term of variants) {
    try {
      const photonRes = await fetch(
        `https://photon.komoot.io/api/?q=${encodeURIComponent(term)}&limit=6&lang=en`
      );
      const photonJson = await photonRes.json();

      if (photonJson && Array.isArray(photonJson.features)) {
        for (const feat of photonJson.features) {
          const p = feat.properties || {};
          const [lon, lat] = feat.geometry?.coordinates || [];
          const name = p.name || p.city || p.town || p.village;
          if (!name || lat == null || lon == null) continue;

          const subParts = [p.district || p.county, p.state, p.country].filter(Boolean);
          const uniqueSub = [...new Set(subParts)].filter(
            (s) => s.toLowerCase() !== name.toLowerCase()
          );
          const fullLabel = uniqueSub.length ? `${name}, ${uniqueSub.join(", ")}` : name;
          const key = `${name.toLowerCase()}|${lat.toFixed(2)}|${lon.toFixed(2)}`;

          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            results.push({
              shortName: name,
              subLabel: uniqueSub.join(", ") || p.country || "",
              fullLabel,
              countryName: p.country || "",
              type: p.osm_value || "Place",
              lat,
              lon,
              score: scorePlaceMatch(clean, name)
            });
          }
        }
      }
    } catch (e) {
      // Continue to fallback
    }
    if (results.length >= 5) break;
  }

  if (results.length === 0) {
    try {
      const geoRes = await fetch(
        `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(collapsed)}&count=6&language=en&format=json`
      );
      const geoJson = await geoRes.json();
      if (geoJson.results) {
        for (const place of geoJson.results) {
          const subParts = [place.admin2, place.admin1, place.country].filter(Boolean);
          const fullLabel = subParts.length ? `${place.name}, ${subParts.join(", ")}` : place.name;
          results.push({
            shortName: place.name,
            subLabel: subParts.join(", "),
            fullLabel,
            countryName: place.country || "",
            type: "Location",
            lat: place.latitude,
            lon: place.longitude,
            score: scorePlaceMatch(clean, place.name)
          });
        }
      }
    } catch (e) {
      // Ignore
    }
  }

  return results.sort((a, b) => a.score - b.score).slice(0, 6);
}

function hideSuggestions() {
  if (!suggestionsList) return;
  suggestionsList.hidden = true;
  suggestionsList.innerHTML = "";
}

function renderSuggestions(places) {
  if (!suggestionsList) return;
  if (!places || places.length === 0) {
    hideSuggestions();
    return;
  }

  suggestionsList.innerHTML = "";
  places.forEach((place) => {
    const li = document.createElement("li");
    li.className = "suggestion-item";
    li.setAttribute("role", "option");
    li.tabIndex = 0;
    li.innerHTML = `
      <div>
        <div class="suggestion-main">${place.shortName}</div>
        <div class="suggestion-sub">${place.subLabel || place.fullLabel}</div>
      </div>
      <span class="suggestion-tag">${place.type}</span>
    `;

    const selectPlace = () => {
      hideSuggestions();
      errorMsg.textContent = "Loading weather...";
      fetchWeatherByCoords(place.lat, place.lon, place.shortName, place.fullLabel, "", place.countryName);
    };

    li.addEventListener("click", selectPlace);
    li.addEventListener("keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        selectPlace();
      }
    });

    suggestionsList.appendChild(li);
  });

  suggestionsList.hidden = false;
}

if (cityInput) {
  cityInput.addEventListener("input", () => {
    clearTimeout(typingTimer);
    const val = cityInput.value.trim();
    if (val.length < 2) {
      hideSuggestions();
      return;
    }
    typingTimer = setTimeout(async () => {
      const matches = await searchFuzzyPlaces(val);
      renderSuggestions(matches);
    }, 280);
  });
}

document.addEventListener("click", (e) => {
  if (!searchForm.contains(e.target)) {
    hideSuggestions();
  }
});

async function fetchWeatherByCoords(lat, lon, cityName, locationLabel, statusNote = "", countryName = "") {
  const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_direction_10m,surface_pressure&hourly=temperature_2m,weather_code,precipitation_probability,visibility,uv_index,surface_pressure&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,moonrise,moonset,moon_phase,uv_index_max&forecast_days=7&timezone=auto`;
  const aqiUrl = `https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${lat}&longitude=${lon}&current=european_aqi,pm2_5,pm10&timezone=auto`;

  const [weatherRes, aqiRes] = await Promise.allSettled([fetch(weatherUrl), fetch(aqiUrl)]);
  if (weatherRes.status !== "fulfilled") {
    throw new Error("Weather fetch failed");
  }
  const weatherJson = await weatherRes.value.json();

  let aqiJson = null;
  if (aqiRes.status === "fulfilled" && aqiRes.value.ok) {
    aqiJson = await aqiRes.value.json();
  }

  const currentHourPrefix = weatherJson.current.time.slice(0, 13);
  let startIdx = weatherJson.hourly.time.findIndex((t) => t.startsWith(currentHourPrefix));
  if (startIdx < 0) startIdx = 0;

  const allHourly = weatherJson.hourly.time.map((time, idx) => ({
    time,
    tempC: weatherJson.hourly.temperature_2m[idx],
    code: weatherJson.hourly.weather_code[idx]
  }));

  const daily = weatherJson.daily.time.slice(0, 7).map((date, i) => ({
    date,
    code: weatherJson.daily.weather_code[i],
    maxC: weatherJson.daily.temperature_2m_max[i],
    minC: weatherJson.daily.temperature_2m_min[i]
  }));

  const curPressure = weatherJson.current.surface_pressure ?? 1013;
  const prevPressure = weatherJson.hourly.surface_pressure?.[Math.max(0, startIdx - 1)] ?? curPressure;
  let pressureTrend = "Steady";
  if (curPressure - prevPressure >= 0.6) pressureTrend = "Increase";
  else if (curPressure - prevPressure <= -0.6) pressureTrend = "Decrease";

  selectedDayIndex = 0;

  const formattedData = {
    city: cityName,
    locationLabel,
    countryName,
    lat,
    lon,
    currentTimeIso: weatherJson.current.time,
    currentHourPrefix,
    tempC: weatherJson.current.temperature_2m,
    apparentTempC: weatherJson.current.apparent_temperature ?? weatherJson.current.temperature_2m,
    humidity: weatherJson.current.relative_humidity_2m,
    windKmh: weatherJson.current.wind_speed_10m,
    windDirDeg: weatherJson.current.wind_direction_10m ?? 0,
    pressure: curPressure,
    pressureTrend,
    aqi: aqiJson?.current?.european_aqi ?? 36,
    pm25: aqiJson?.current?.pm2_5 ?? 10.5,
    pm10: aqiJson?.current?.pm10 ?? 21.0,
    visibilityMeters: weatherJson.hourly.visibility?.[startIdx] ?? 16000,
    uvIndex: weatherJson.hourly.uv_index?.[startIdx] ?? weatherJson.daily.uv_index_max?.[0] ?? 3,
    precipProb: weatherJson.hourly.precipitation_probability?.[startIdx] ?? 0,
    currentCode: weatherJson.current.weather_code,
    sunriseIso: weatherJson.daily.sunrise?.[0],
    sunsetIso: weatherJson.daily.sunset?.[0],
    moonriseIso: weatherJson.daily.moonrise?.[0],
    moonsetIso: weatherJson.daily.moonset?.[0],
    moonPhase: weatherJson.daily.moon_phase?.[0] ?? 0.6,
    sunrise: formatClockTime(weatherJson.daily.sunrise?.[0]),
    sunset: formatClockTime(weatherJson.daily.sunset?.[0]),
    allHourly,
    daily
  };

  localStorage.setItem(STORAGE_KEYS.CITY, cityName);
  localStorage.setItem(
    STORAGE_KEYS.COORDS,
    JSON.stringify({ lat, lon, cityName, locationLabel, countryName })
  );
  cityInput.value = cityName;
  errorMsg.textContent = statusNote;
  renderWeather(formattedData);
}

async function fetchWeatherForCity(cityQuery) {
  const cleanCity = cityQuery.trim();
  hideSuggestions();

  if (!cleanCity) {
    errorMsg.textContent = "Please type a village or city name, or tap 'Use My Location'.";
    return;
  }

  errorMsg.textContent = "Finding best matching location...";
  try {
    const matches = await searchFuzzyPlaces(cleanCity);

    if (matches.length > 0) {
      const best = matches[0];
      const wasCorrected =
        best.shortName.toLowerCase() !== cleanCity.toLowerCase() &&
        !cleanCity.toLowerCase().includes(best.shortName.toLowerCase());
      const note = wasCorrected ? `Showing closest match: ${best.fullLabel}` : "";
      await fetchWeatherByCoords(
        best.lat,
        best.lon,
        best.shortName,
        best.fullLabel,
        note,
        best.countryName
      );
      return;
    }

    const nomRes = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(cleanCity)}&format=json&addressdetails=1&limit=1`,
      { headers: { "Accept-Language": "en" } }
    );
    const nomJson = await nomRes.json();

    if (nomJson && nomJson.length > 0) {
      const hit = nomJson[0];
      const fallback = hit.display_name.split(",")[0].trim();
      const { shortName, fullLabel, countryName } = extractLocalityDetails(hit.address, fallback);
      await fetchWeatherByCoords(
        parseFloat(hit.lat),
        parseFloat(hit.lon),
        shortName,
        fullLabel,
        "",
        countryName
      );
      return;
    }

    errorMsg.textContent = `Could not find "${cleanCity}". Try tapping 'Use My Location' above.`;
  } catch (err) {
    errorMsg.textContent = "Unable to load weather right now. Check your internet connection.";
  }
}

function handleUseCurrentLocation() {
  hideSuggestions();
  if (!navigator.geolocation) {
    errorMsg.textContent = "Geolocation is not supported by your browser.";
    return;
  }

  errorMsg.textContent = "Detecting your exact village / locality...";
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const { latitude, longitude } = position.coords;
      try {
        const revRes = await fetch(
          `https://nominatim.openstreetmap.org/reverse?lat=${latitude}&lon=${longitude}&zoom=18&format=json&addressdetails=1`,
          { headers: { "Accept-Language": "en" } }
        );
        const revJson = await revRes.json();
        const { shortName, fullLabel, countryName } = extractLocalityDetails(
          revJson.address,
          "Current Location"
        );
        await fetchWeatherByCoords(latitude, longitude, shortName, fullLabel, "", countryName);
      } catch (err) {
        await fetchWeatherByCoords(latitude, longitude, "Current Location", "Current Location");
      }
    },
    (err) => {
      if (err.code === 1) {
        errorMsg.textContent = "Location permission blocked. Allow location access in browser & Windows Settings.";
      } else {
        errorMsg.textContent = "Could not detect GPS. Turn on Windows Location Services or type 2-3 letters in search.";
      }
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
  );
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  fetchWeatherForCity(cityInput.value);
});

if (geoBtn) {
  geoBtn.addEventListener("click", handleUseCurrentLocation);
}

unitToggle.addEventListener("click", () => {
  currentUnit = currentUnit === "C" ? "F" : "C";
  localStorage.setItem(STORAGE_KEYS.UNIT, currentUnit);
  if (latestWeatherData) {
    renderWeather(latestWeatherData);
  }
});

const savedCoordsRaw = localStorage.getItem(STORAGE_KEYS.COORDS);
if (savedCoordsRaw) {
  try {
    const saved = JSON.parse(savedCoordsRaw);
    cityInput.value = saved.cityName;
    fetchWeatherByCoords(
      saved.lat,
      saved.lon,
      saved.cityName,
      saved.locationLabel,
      "",
      saved.countryName || ""
    );
  } catch (e) {
    fetchWeatherForCity("Sitalapalli, Ganjam, Odisha");
  }
} else {
  fetchWeatherForCity("Sitalapalli, Ganjam, Odisha");
}