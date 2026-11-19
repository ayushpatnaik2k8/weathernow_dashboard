const sampleCities = {
  berhampur: {
    city: "Berhampur",
    condition: "Partly Cloudy",
    emoji: "⛅",
    tempC: 29,
    humidity: 68,
    windKmh: 14,
    forecast: [
      { day: "Thu", emoji: "☀️", condition: "Sunny", highC: 31, lowC: 22 },
      { day: "Fri", emoji: "⛅", condition: "Partly Cloudy", highC: 30, lowC: 21 },
      { day: "Sat", emoji: "🌧️", condition: "Rain", highC: 27, lowC: 20 },
      { day: "Sun", emoji: "☁️", condition: "Cloudy", highC: 28, lowC: 21 },
      { day: "Mon", emoji: "☀️", condition: "Sunny", highC: 32, lowC: 23 },
      { day: "Tue", emoji: "🌤️", condition: "Clear", highC: 33, lowC: 23 },
      { day: "Wed", emoji: "🌦️", condition: "Showers", highC: 29, lowC: 22 }
    ]
  },
  pune: {
    city: "Pune",
    condition: "Clear Sky",
    emoji: "☀️",
    tempC: 27,
    humidity: 52,
    windKmh: 12,
    forecast: [
      { day: "Thu", emoji: "☀️", condition: "Sunny", highC: 29, lowC: 18 },
      { day: "Fri", emoji: "☀️", condition: "Sunny", highC: 30, lowC: 19 },
      { day: "Sat", emoji: "⛅", condition: "Partly Cloudy", highC: 28, lowC: 18 },
      { day: "Sun", emoji: "⛅", condition: "Partly Cloudy", highC: 28, lowC: 17 },
      { day: "Mon", emoji: "☀️", condition: "Clear", highC: 29, lowC: 18 },
      { day: "Tue", emoji: "🌤️", condition: "Clear", highC: 30, lowC: 19 },
      { day: "Wed", emoji: "⛅", condition: "Breezy", highC: 27, lowC: 18 }
    ]
  }
};

let currentUnit = "C";
let activeWeather = sampleCities.berhampur;

const searchForm = document.getElementById("search-form");
const cityInput = document.getElementById("city-input");
const unitToggleBtn = document.getElementById("unit-toggle");
const errorMsg = document.getElementById("error-msg");

const cityEl = document.getElementById("current-city");
const conditionEl = document.getElementById("current-condition");
const emojiEl = document.getElementById("current-emoji");
const tempEl = document.getElementById("current-temp");
const humidityEl = document.getElementById("current-humidity");
const windEl = document.getElementById("current-wind");
const forecastGridEl = document.getElementById("forecast-grid");

function formatTemp(tempC) {
  if (currentUnit === "F") {
    return `${Math.round((tempC * 9) / 5 + 32)}°F`;
  }
  return `${Math.round(tempC)}°C`;
}

function renderWeather(data) {
  activeWeather = data;
  cityEl.textContent = data.city;
  conditionEl.textContent = data.condition;
  emojiEl.textContent = data.emoji;
  tempEl.textContent = formatTemp(data.tempC);
  humidityEl.textContent = `${data.humidity}%`;
  windEl.textContent = `${data.windKmh} km/h`;

  forecastGridEl.innerHTML = "";
  data.forecast.forEach((item) => {
    const card = document.createElement("article");
    card.className = "forecast-card";
    card.innerHTML = `
      <div class="forecast-day">${item.day}</div>
      <div class="forecast-emoji" aria-hidden="true">${item.emoji}</div>
      <div class="forecast-condition">${item.condition}</div>
      <div class="forecast-temps">${formatTemp(item.highC)} / ${formatTemp(item.lowC)}</div>
    `;
    forecastGridEl.appendChild(card);
  });
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const query = cityInput.value.trim().toLowerCase();

  if (!query) {
    errorMsg.textContent = "Please enter a city name before searching.";
    return;
  }

  const matchedCity = sampleCities[query];
  if (!matchedCity) {
    errorMsg.textContent = `No sample data for "${cityInput.value.trim()}". Try Berhampur or Pune (live API coming in Week 3).`;
    return;
  }

  errorMsg.textContent = "";
  renderWeather(matchedCity);
});

unitToggleBtn.addEventListener("click", () => {
  currentUnit = currentUnit === "C" ? "F" : "C";
  renderWeather(activeWeather);
});

renderWeather(activeWeather);
