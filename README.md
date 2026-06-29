# Schwartz Value Survey

Interactive visualization of Schwartz value scores, sourced from [YourMorals.org](https://yourmorals.org/).

## What it does

The site links to the official [Schwartz Value Survey](https://yourmorals.org/) on YourMorals.org and provides a results page where you can:

- Enter your ten value scores (0–7)
- See them on a grouped bar chart alongside reference scores
- Filter by demographic groups (gender, age, political ideology, education, race, religiosity)
- Select two-way demographic combinations (e.g. Female + Liberal, Liberal + ≥65)
- Mix single-group filters and combinations on the same chart
- Use presets for highest/lowest self-direction or universalism groups

Demographic structure is bundled in `data.js` with placeholder zeros pending API capture — no backend required.

## Pages

| File | Purpose |
|------|---------|
| `index.html` | About the Schwartz value framework and links to the survey |
| `results.html` | Score entry, chart, demographic filters, and combo explorer |
| `values.html` | In-depth breakdown of all ten value facets — motivational goals, empirical correlates, tensions, and a clickable inline SVG recreation of Schwartz's circular model (Figure 1) |

## Data

- `data.js` — demographic singles, two-filter combinations, dimension definitions, and metadata (`DEMOGRAPHIC_COMBOS`, `DEMOGRAPHIC_NO_DATA`, etc.)
- `results.js` — Chart.js rendering, filter logic, color assignment, mass presets
- `styles.css` — layout and typography

Two-filter combos are captured from YourMorals `average1` API responses. Groups with no published data are marked accordingly in the UI.

## Credits

- Survey and demographic data: [YourMorals.org](https://yourmorals.org/) (Jonathan Haidt et al.)
- Scale based on Shalom Schwartz's basic human values research

## License

Personal project, not affiliated with YourMorals.org. Demographic averages sourced from YourMorals.org and their contributors, who hold copyright over the data. Personal results shown on this site are my own and may not be reproduced.
