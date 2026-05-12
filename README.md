# MyCineverse

A static TMDB movie and TV discovery site built with plain `HTML`, `CSS`, and `JavaScript` for GitHub Pages.

## What It Does

- Browses TMDB sections like popular, top rated, now playing, and upcoming
- Switches between movies and TV shows
- Lets visitors search movies directly from TMDB
- Filters movies by genre
- Opens a movie details modal with cast, genres, runtime, rating, and trailer links
- Shows licensed platform shortcuts above the results grid
- Includes a custom logo, pagination, and a custom GitHub Pages `404.html`
- Includes a custom GitHub Pages `404.html`

## File Layout

- `index.html` main app page
- `styles.css` site styling
- `script.js` app logic and TMDB fetching
- `assets/js/tmdb-config.js` TMDB API key configuration
- `assets/images/logo.svg` site logo
- `404.html` custom not-found page for GitHub Pages

## Setup

1. Open `assets/js/tmdb-config.js`
2. Replace the sample key with your TMDB API key if needed
3. Open `index.html` in a browser to test locally

## Deploy To GitHub Pages

1. Push this folder to a GitHub repository.
2. In GitHub, go to `Settings` > `Pages`.
3. Set the source to your main branch and the root folder.
4. Save and wait for GitHub Pages to publish the site.

## Important Note About The API Key

This project is fully static, so the TMDB key must live in front-end code or a front-end config file.
That means it cannot be truly hidden from someone who inspects the deployed site.
For a public GitHub Pages site, this is the normal tradeoff.

The platform links in the UI are limited to licensed services only.

## Optional Next Steps

- Add pagination
- Add a dark/light theme toggle
- Add TV shows and people search
- Add a custom logo or favicon
