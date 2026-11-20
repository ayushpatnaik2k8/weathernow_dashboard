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
  details: document.getElementById("view-details")
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

function formatTemp(tempC) {
  if (currentUnit === "F") {
    return `${Math.round((tempC * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

function formatClockTime(isoString) {
  if (!isoString) return "--:--";
  const timePart = isoString.split("T")[1];
  if (!timePart) return isoString;
  const [hourStr, minStr] = timePart.split(":");
  let hour = parseInt(hourStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${String(hour).padStart(2, "0")}:${minStr} ${ampm}`;
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

/* Get the 24 Hourly Slices (00:00 to 23:00) for Any of the 7 Days */
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

  // Overview strip shows 8 key 3-hour intervals across that day's 24 hours
  const threeHourlySlice = dayHours.filter((_, idx) => idx % 3 === 0);
  populateHourlyGrid(
    hourlyStripEl,
    threeHourlySlice,
    8,
    selectedDayIndex === 0 ? latestWeatherData.currentHourPrefix : ""
  );

  // Dedicated Hourly Forecast view shows all 24 hours (12:00 AM to 11:00 PM)
  populateHourlyGrid(
    hourlyGridFullEl,
    dayHours,
    24,
    selectedDayIndex === 0 ? latestWeatherData.currentHourPrefix : ""
  );

  // Sync active day tabs inside Hourly View
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

function renderWeather(data) {
  latestWeatherData = data;
  const info = mapWeatherCode(data.currentCode);
  const formattedTemp = formatTemp(data.tempC);

  updateGreeting();
  applyTheme(info.theme);

  currentCityEl.textContent = data.locationLabel;
  currentConditionEl.textContent = info.label;
  currentEmojiEl.textContent = info.emoji;
  currentTempEl.textContent = formattedTemp;
  currentHumidityEl.textContent = `${Math.round(data.humidity)}%`;
  currentWindEl.textContent = `${Math.round(data.windKmh)} km/h`;
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
  const detailPressure = document.getElementById("detail-pressure");
  const detailSun = document.getElementById("detail-sun");
  const detailRange = document.getElementById("detail-range");

  if (hourlyBadge) hourlyBadge.textContent = data.locationLabel;
  if (forecastBadge) forecastBadge.textContent = data.locationLabel;
  if (detailsBadge) detailsBadge.textContent = data.locationLabel;

  if (detailTemp) detailTemp.textContent = formattedTemp;
  if (detailFeels) detailFeels.textContent = `Feels like ${formatTemp(data.apparentTempC)}`;
  if (detailHumidity) detailHumidity.textContent = `${Math.round(data.humidity)}%`;
  if (detailPrecip) detailPrecip.textContent = `Precipitation probability: ${data.precipProb}%`;
  if (detailWind) detailWind.textContent = `${Math.round(data.windKmh)} km/h`;
  if (detailPressure) detailPressure.textContent = `Surface pressure: ${Math.round(data.pressure)} hPa`;
  if (detailSun) detailSun.textContent = `${data.sunrise} / ${data.sunset}`;
  if (detailRange && data.daily[0]) {
    detailRange.textContent = `High ${formatTemp(data.daily[0].maxC)} / Low ${formatTemp(data.daily[0].minC)}`;
  }

  renderSelectedDayHourly();
  populateForecastGrid(forecastGridEl, data.daily, false);
  populateForecastGrid(forecastGridFullEl, data.daily, true);
}

function extractLocalityDetails(address, fallbackName) {
  if (!address) {
    return { shortName: fallbackName || "Current Location", fullLabel: fallbackName || "Current Location" };
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
  const parts = [villageOrLocality];

  if (districtOrCity && districtOrCity.toLowerCase() !== villageOrLocality.toLowerCase()) {
    parts.push(districtOrCity.replace(/\s+District$/i, ""));
  }
  if (state && state.toLowerCase() !== villageOrLocality.toLowerCase()) {
    parts.push(state);
  }

  return {
    shortName: villageOrLocality,
    fullLabel: parts.join(", ")
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
      fetchWeatherByCoords(place.lat, place.lon, place.shortName, place.fullLabel);
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

async function fetchWeatherByCoords(lat, lon, cityName, locationLabel, statusNote = "") {
  const weatherRes = await fetch(
    `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,surface_pressure&hourly=temperature_2m,weather_code,precipitation_probability&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&forecast_days=7&timezone=auto`
  );
  const weatherJson = await weatherRes.json();

  const currentHourPrefix = weatherJson.current.time.slice(0, 13);
  let startIdx = weatherJson.hourly.time.findIndex((t) => t.startsWith(currentHourPrefix));
  if (startIdx < 0) startIdx = 0;

  // Store all 168 hourly entries (7 days x 24 hours) so any clicked day shows its full 24-hour forecast
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

  selectedDayIndex = 0;

  const formattedData = {
    city: cityName,
    locationLabel,
    currentHourPrefix,
    tempC: weatherJson.current.temperature_2m,
    apparentTempC: weatherJson.current.apparent_temperature ?? weatherJson.current.temperature_2m,
    humidity: weatherJson.current.relative_humidity_2m,
    windKmh: weatherJson.current.wind_speed_10m,
    pressure: weatherJson.current.surface_pressure ?? 1013,
    precipProb: weatherJson.hourly.precipitation_probability?.[startIdx] ?? 0,
    currentCode: weatherJson.current.weather_code,
    sunrise: formatClockTime(weatherJson.daily.sunrise[0]),
    sunset: formatClockTime(weatherJson.daily.sunset[0]),
    allHourly,
    daily
  };

  localStorage.setItem(STORAGE_KEYS.CITY, cityName);
  localStorage.setItem(STORAGE_KEYS.COORDS, JSON.stringify({ lat, lon, cityName, locationLabel }));
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
      await fetchWeatherByCoords(best.lat, best.lon, best.shortName, best.fullLabel, note);
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
      const { shortName, fullLabel } = extractLocalityDetails(hit.address, fallback);
      await fetchWeatherByCoords(parseFloat(hit.lat), parseFloat(hit.lon), shortName, fullLabel);
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
        const { shortName, fullLabel } = extractLocalityDetails(revJson.address, "Current Location");
        await fetchWeatherByCoords(latitude, longitude, shortName, fullLabel);
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
    fetchWeatherByCoords(saved.lat, saved.lon, saved.cityName, saved.locationLabel);
  } catch (e) {
    fetchWeatherForCity("Sitalapalli, Ganjam, Odisha");
  }
} else {
  fetchWeatherForCity("Sitalapalli, Ganjam, Odisha");
}