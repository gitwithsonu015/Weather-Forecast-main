# SkyPulse — Modern Weather Dashboard
#### SkyPulse is a lightweight, responsive weather dashboard that detects location, shows a polished 5‑day forecast, and visualizes upcoming hours with a smooth line chart. It blends data from OpenWeatherMap and Open‑Meteo, and ships with a full‑screen hero splash for a premium first-run experience.

# Features
##### Location detection with secure‑origin geolocation, with automatic IP fallback when needed.
##### Search by city with a translucent Loading overlay for professional UX.
##### 5‑day forecast cards with icons, concise labels, and dates.
##### “Upcoming Hours” chart showing the next 8 hours with a responsive, gradient-filled line.
##### “Today’s Highlights” (feels like, humidity, pressure, wind, clouds, visibility).
##### Favorite Travel Destinations rail with compact weather cards.
##### Theme toggle (light/dark) and unit toggle (°C/°F).
##### Full‑screen hero overlay on first load (5 seconds min) that fades out after initial render.

# Tech Stack
#####  HTML, CSS, JavaScript
##### Chart.js for the hourly temperature line
##### Fonts/Icons: Font Awesome
##### APIs: OpenWeatherMap (current, 5‑day forecast), Open‑Meteo (hourly + fallback), ipapi (IP fallback geolocation), REST Countries (country names)

# Project Structure
##### index.html — Markup for header, hero, cards, forecast, chart, favorites, footer, and overlay.
##### style.css — Theme variables, layout, hero overlay styles, chart and favorites UI.
##### script.js — Data fetching, rendering, geolocation logic, search, unit/theme toggles, and Chart.js setup.

# Getting Started
### Download
###### Click Code → Download ZIP, then extract the folder.
### API keys
##### Create a free OpenWeatherMap API key and put it in script.js (const API_KEY = "...").
##### No key needed for Open‑Meteo and REST Countries.
## Run locally
######  Open with Live Server in VS Code

# Location detection
### Secure origin
##### Precise location uses the browser’s Geolocation API, which only works on secure origins. Localhost and 127.0.0.1 count as secure during development.
### Flow
##### First try: Browser geolocation. The browser asks for permission; if granted, SkyPulse uses GPS/Wi‑Fi to get accurate coordinates.
##### Fallback: If permission is denied, unavailable, or times out, the app uses IP‑based lookup to estimate the city. This can be less accurate.

# Tips
###### If the city looks wrong, allow location access in the browser and reload.
###### Run from localhost (not opening index.html with file://) so geolocation works.
###### Mobile devices usually give more accurate readings than desktops.

# How It Works
#### First‑run hero splash
###### A full-screen hero image overlays the UI for at least 5 seconds.
###### It fades when two conditions are met: minimum 5 seconds elapsed AND first successful data render completed.
###### The overlay ignores pointer events so it never blocks the browser’s location prompt.
#### Loading overlay
###### The transparent “Loading…” overlay appears during searches and explicit city fetches, but not during initial geolocation (so the hero remains visible).
#### Forecast
###### The app uses OpenWeatherMap’s forecast; if the primary calls fail, it falls back to Open‑Meteo (normalized shape).
###### Forecast cards display a daily pick around local noon; if missing, they select the closest slot to 12:00.
#### Hourly chart (Chart.js)
###### The upcoming 8 hours render as a smooth line with a responsive gradient fill.
###### The gradient height is derived from the actual canvas height to look correct on mobile and laptop.

# Environment Notes
##### Secure origin is required for geolocation. Localhost/127.0.0.1 is fine for dev.
##### If OpenWeatherMap is intermittently blocked in the region, the app falls back to Open‑Meteo using geocoded coordinates.

# Credits
##### Weather data by OpenWeatherMap and Open‑Meteo.
##### Icons by Font Awesome.
##### Charts by Chart.js.
