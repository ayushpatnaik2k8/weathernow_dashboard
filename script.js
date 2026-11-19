const STORAGE_KEYS = {
  CITY: "weathernow_last_city",
  UNIT: "weathernow_unit"
};

const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const unitToggle = document.getElementById("unit-toggle");
const errorMsg = document.getElementById("error-msg");

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
const forecastGridEl = document.getElementById("forecast-grid");
const forecastGridFullEl = document.getElementById("forecast-grid-full");

const navButtons = document.querySelectorAll(".nav-bubble");
const viewPanels = {
  overview: document.getElementById("view-overview"),
  forecast: document.getElementById("view-forecast"),
  details: document.getElementById("view-details")
};

let currentUnit = localStorage.getItem(STORAGE_KEYS.UNIT) === "F" ? "F" : "C";
let latestWeatherData = null;

navButtons.forEach((btn) => {
  btn.addEventListener("click", () => {
    const target = btn.dataset.view;
    navButtons.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");

    Object.entries(viewPanels).forEach(([key, panel]) => {
      if (!panel) return;
      panel.hidden = key !== target;
    });
  });
});

function updateGreeting() {
  if (!timeGreetingEl) return;
  const hour = new Date().getHours();
  if (hour < 12) timeGreetingEl.textContent = "Good morning";
  else if (hour < 18) timeGreetingEl.textContent = "Good afternoon";
  else timeGreetingEl.textContent = "Good evening";
}

function mapWeatherCode(code) {
  if (code === 0) return { label: "Clear Sky", emoji: "☀️", theme: "theme-clear" };
  if (code === 1 || code === 2) return { label: "Partly Cloudy", emoji: "⛅", theme: "theme-cloudy" };
  if (code === 3 || code === 45 || code === 48) return { label: "Overcast / Mist", emoji: "☁️", theme: "theme-cloudy" };
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) {
    return { label: "Rain / Drizzle", emoji: "🌧️", theme: "theme-rain" };
  }
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) {
    return { label: "Snow", emoji: "❄️", theme: "theme-snow" };
  }
  if (code >= 95) return { label: "Thunderstorm", emoji: "⛈️", theme: "theme-storm" };
  return { label: "Pleasant", emoji: "🌤️", theme: "theme-cloudy" };
}

function formatTemp(tempC) {
  if (currentUnit === "F") {
    return `${Math.round((tempC * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

function applyTheme(themeClass) {
  document.body.classList.remove(
    "theme-clear",
    "theme-cloudy",
    "theme-rain",
    "theme-storm",
    "theme-snow"
  );
  document.body.classList.add(themeClass);
}

function formatDayLabel(dateStr, index) {
  if (index === 0) return "Today";
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", { weekday: "short" });
}

function populateForecastGrid(container, daily) {
  if (!container) return;
  container.innerHTML = "";
  daily.forEach((day, idx) => {
    const dayInfo = mapWeatherCode(day.code);
    const card = document.createElement("div");
    card.className = "forecast-card";
    card.innerHTML = `
      <div class="forecast-day">${formatDayLabel(day.date, idx)}</div>
      <div class="forecast-emoji" aria-hidden="true">${dayInfo.emoji}</div>
      <div class="forecast-condition">${dayInfo.label}</div>
      <div class="forecast-temps">${formatTemp(day.maxC)} / ${formatTemp(day.minC)}</div>
    `;
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

  if (railCityEl) railCityEl.textContent = data.city;
  if (railTempEl) railTempEl.textContent = formattedTemp;
  if (railEmojiEl) railEmojiEl.textContent = info.emoji;
  if (railRangeEl && data.daily[0]) {
    railRangeEl.textContent = `H ${formatTemp(data.daily[0].maxC)} · L ${formatTemp(data.daily[0].minC)}`;
  }

  const forecastBadge = document.getElementById("forecast-city-badge");
  const detailsBadge = document.getElementById("details-city-badge");
  const detailTemp = document.getElementById("detail-temp");
  const detailHumidity = document.getElementById("detail-humidity");
  const detailWind = document.getElementById("detail-wind");
  const detailCondition = document.getElementById("detail-condition");
  const detailRange = document.getElementById("detail-range");

  if (forecastBadge) forecastBadge.textContent = data.locationLabel;
  if (detailsBadge) detailsBadge.textContent = data.locationLabel;
  if (detailTemp) detailTemp.textContent = formattedTemp;
  if (detailHumidity) detailHumidity.textContent = `${Math.round(data.humidity)}%`;
  if (detailWind) detailWind.textContent = `${Math.round(data.windKmh)} km/h`;
  if (detailCondition) detailCondition.textContent = `${info.emoji} ${info.label}`;
  if (detailRange && data.daily[0]) {
    detailRange.textContent = `High ${formatTemp(data.daily[0].maxC)} / Low ${formatTemp(data.daily[0].minC)}`;
  }

  populateForecastGrid(forecastGridEl, data.daily);
  populateForecastGrid(forecastGridFullEl, data.daily);
}

async function fetchWeatherForCity(cityQuery) {
  const cleanCity = cityQuery.trim();
  if (!cleanCity) {
    errorMsg.textContent = "Please enter a city name.";
    return;
  }

  errorMsg.textContent = "Fetching live weather...";
  try {
    const geoRes = await fetch(
      `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cleanCity)}&count=1&language=en&format=json`
    );
    const geoJson = await geoRes.json();

    if (!geoJson.results || geoJson.results.length === 0) {
      errorMsg.textContent = `City "${cleanCity}" not found. Try another city.`;
      return;
    }

    const place = geoJson.results[0];
    const locationLabel = place.country ? `${place.name}, ${place.country}` : place.name;

    const weatherRes = await fetch(
      `https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=auto`
    );
    const weatherJson = await weatherRes.json();

    const daily = weatherJson.daily.time.slice(0, 7).map((date, i) => ({
      date,
      code: weatherJson.daily.weather_code[i],
      maxC: weatherJson.daily.temperature_2m_max[i],
      minC: weatherJson.daily.temperature_2m_min[i]
    }));

    const formattedData = {
      city: place.name,
      locationLabel,
      tempC: weatherJson.current.temperature_2m,
      humidity: weatherJson.current.relative_humidity_2m,
      windKmh: weatherJson.current.wind_speed_10m,
      currentCode: weatherJson.current.weather_code,
      daily
    };

    localStorage.setItem(STORAGE_KEYS.CITY, place.name);
    errorMsg.textContent = "";
    renderWeather(formattedData);
  } catch (err) {
    errorMsg.textContent = "Unable to load weather right now. Check your connection.";
  }
}

searchForm.addEventListener("submit", (e) => {
  e.preventDefault();
  fetchWeatherForCity(cityInput.value);
});

unitToggle.addEventListener("click", () => {
  currentUnit = currentUnit === "C" ? "F" : "C";
  localStorage.setItem(STORAGE_KEYS.UNIT, currentUnit);
  if (latestWeatherData) {
    renderWeather(latestWeatherData);
  }
});

const savedCity = localStorage.getItem(STORAGE_KEYS.CITY) || "Berhampur";
cityInput.value = savedCity;
fetchWeatherForCity(savedCity);