let chart = null;
let visitorResults = loadVisitorResults();
const selectedDemographics = new Set();
let showPersonalOnly = false;
let massPreset = null;
let massPresetBars = null;
const selectedCombos = new Set();
const barColorMap = new Map();
const demographicColorById = new Map();
let visitorColor = null;
let visitorHue = Math.floor(Math.random() * 360);

const DIMENSION_KEYS = DIMENSIONS.map((d) => d.key);

function hasScores(obj) {
  return DIMENSION_KEYS.some((k) => Number(obj[k]) > 0);
}

function extractScores(obj) {
  const scores = {};
  DIMENSION_KEYS.forEach((k) => { scores[k] = obj[k]; });
  return scores;
}

function formatScoresCompact(scores) {
  return DIMENSIONS.map((d) => `${d.short} ${scores[d.key].toFixed(2)}`).join(' · ');
}

function hslToHex(h, s, l) {
  s /= 100;
  l /= 100;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => {
    const k = (n + h / 30) % 12;
    return l - a * Math.max(Math.min(k - 3, 9 - k, 1), -1);
  };
  const toHex = (x) => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${toHex(f(0))}${toHex(f(8))}${toHex(f(4))}`;
}

function hexToHsl(hex) {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l * 100];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  let h;
  switch (max) {
    case r: h = (g - b) / d + (g < b ? 6 : 0); break;
    case g: h = (b - r) / d + 2; break;
    default: h = (r - g) / d + 4;
  }
  return [h * 60, s * 100, l * 100];
}

function colorDistance(hex1, hex2) {
  const [h1, s1, l1] = hexToHsl(hex1);
  const [h2, s2, l2] = hexToHsl(hex2);
  const dh = Math.min(Math.abs(h1 - h2), 360 - Math.abs(h1 - h2)) / 90;
  const ds = Math.abs(s1 - s2) / 50;
  const dl = Math.abs(l1 - l2) / 35;
  return Math.sqrt(dh * dh + ds * ds + dl * dl);
}

// Greedy farthest-point colour generation. Each call samples a fresh batch of
// random hue/sat/light candidates and keeps whichever maximizes the minimum
// distance to colours already chosen. This guarantees colours stay visually
// separated (no two demographics landing on near-identical colours) while
// still being genuinely random from page load to page load, since every
// candidate is freshly randomized rather than walked from a fixed sequence.
function generateDistinctColors(count, avoidColors = [], samplesPerPick = 60) {
  const chosen = [...avoidColors];
  const result = [];
  const satOptions = [82, 70, 60];
  const lightOptions = [42, 50, 58, 66];

  for (let n = 0; n < count; n++) {
    let best = null;
    let bestScore = -Infinity;

    for (let i = 0; i < samplesPerPick; i++) {
      const hue = Math.random() * 360;
      const sat = satOptions[Math.floor(Math.random() * satOptions.length)];
      const light = lightOptions[Math.floor(Math.random() * lightOptions.length)];
      const candidate = hslToHex(hue, sat, light);

      let minDist = chosen.length === 0 ? Infinity : 0;
      for (const c of chosen) {
        const d = colorDistance(candidate, c);
        if (d < minDist || chosen.length === 0) minDist = d;
      }
      if (chosen.length === 0) minDist = Infinity;

      if (minDist > bestScore) {
        bestScore = minDist;
        best = candidate;
      }
    }

    chosen.push(best);
    result.push(best);
  }

  return result;
}

function initBarColors() {
  barColorMap.clear();
  demographicColorById.clear();
  barColorMap.set(MY_RESULT.label, MY_RESULT.color);

  const used = [MY_RESULT.color];

  // "Your Result" plus every demographic get the strongest separation pass,
  // since these are the colours most likely to be compared side by side.
  const primaryColors = generateDistinctColors(DEMOGRAPHICS.length + 1, used, 60);
  const yourColor = primaryColors[0];
  barColorMap.set('Your Result', yourColor);
  used.push(yourColor);

  DEMOGRAPHICS.forEach((item, i) => {
    const color = primaryColors[i + 1];
    demographicColorById.set(item.id, color);
    barColorMap.set(item.label, color);
    used.push(color);
  });

  // Combos are numerous and rarely all shown at once, so a lighter sampling
  // pass keeps page load fast while still avoiding obvious collisions.
  const comboKeys = Object.keys(DEMOGRAPHIC_COMBOS);
  const comboColors = generateDistinctColors(comboKeys.length, used, 25);
  comboKeys.forEach((key, i) => {
    const label = labelForComboKey(key);
    barColorMap.set(label, comboColors[i]);
  });
}

function colorForGroup(g) {
  if (g.label === MY_RESULT.label) return MY_RESULT.color;
  if (g.label === 'Your Result') return visitorColor || barColorMap.get('Your Result');
  if (g.id && demographicColorById.has(g.id)) return demographicColorById.get(g.id);
  return barColorMap.get(g.label) || MY_RESULT.color;
}

function assignBarColors(groups) {
  return groups.map((g) => ({ ...g, color: colorForGroup(g) }));
}

function cycleVisitorColor() {
  if (!visitorResults) return;
  const previous = visitorColor;
  do {
    visitorHue = (visitorHue + 37) % 360;
    visitorColor = hslToHex(visitorHue, 82, 50);
  } while (visitorColor === MY_RESULT.color || visitorColor === previous);
  renderChart(true);
}

function resetVisitorColor() {
  visitorColor = null;
  visitorHue = Math.floor(Math.random() * 360);
}

function clearComboSelection() {
  selectedCombos.clear();
  document.querySelectorAll('.combo-item-btn.active').forEach((btn) => {
    btn.classList.remove('active');
  });
}

function clearMassPreset() {
  massPreset = null;
  massPresetBars = null;
  document.querySelectorAll('.mass-preset-btn').forEach((btn) => {
    btn.classList.remove('active');
  });
}

function labelForComboKey(key) {
  return key.split(',').map((id) => DEMOGRAPHICS.find((d) => d.id === id).label).join(' + ');
}

function getAllScoredGroups() {
  const groups = DEMOGRAPHICS
    .filter((d) => hasScores(d))
    .map((d) => ({
      label: d.label,
      id: d.id,
      ...extractScores(d),
    }));

  Object.entries(DEMOGRAPHIC_COMBOS).forEach(([key, scores]) => {
    if (!hasScores(scores)) return;
    groups.push({
      label: labelForComboKey(key),
      ...extractScores(scores),
    });
  });

  return groups;
}

function applyMassPreset(preset) {
  const match = preset.match(/^(low|high)-(.+)$/);
  if (!match || !DIMENSION_KEYS.includes(match[2])) return;

  const ascending = match[1] === 'low';
  const field = match[2];
  const scored = getAllScoredGroups();
  if (scored.length === 0) {
    updateFilteredMessage('No demographic scores in data.js yet — run python3 scripts/build_data.py');
    return;
  }
  const sorted = [...scored].sort((a, b) => (
    ascending ? a[field] - b[field] : b[field] - a[field]
  ));

  massPreset = preset;
  massPresetBars = sorted.slice(0, 10);
  showPersonalOnly = false;
  selectedDemographics.clear();
  clearComboSelection();

  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  document.querySelectorAll('.mass-preset-btn').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.preset === preset);
  });

  updateFilteredMessage();
  renderChart();
}

function getPersonalBars() {
  const bars = [];

  if (visitorResults) {
    bars.push({
      label: 'Your Result',
      ...extractScores(visitorResults),
    });
  }

  bars.push({
    label: MY_RESULT.label,
    ...extractScores(MY_RESULT),
  });

  return bars;
}

function getVisibleDemographics() {
  const personal = getPersonalBars();

  if (massPresetBars) {
    return [...personal, ...massPresetBars];
  }

  const selectionBars = [];

  DEMOGRAPHICS.filter((d) => selectedDemographics.has(d.id)).forEach((d) => {
    if (!hasScores(d)) return;
    selectionBars.push({ label: d.label, id: d.id, ...extractScores(d) });
  });

  [...selectedCombos]
    .filter((key) => DEMOGRAPHIC_COMBOS[key] && hasScores(DEMOGRAPHIC_COMBOS[key]))
    .forEach((key) => {
      const combo = DEMOGRAPHIC_COMBOS[key];
      selectionBars.push({
        label: labelForComboKey(key),
        ...extractScores(combo),
      });
    });

  if (selectionBars.length > 0) {
    return [...personal, ...selectionBars];
  }

  if (showPersonalOnly) {
    return personal;
  }

  const DEFAULT_VIEW_IDS = ['male', 'female', 'liberal', 'conservative', 'moderate'];

  const demographicBars = DEMOGRAPHICS
    .filter((d) => DEFAULT_VIEW_IDS.includes(d.id) && hasScores(d))
    .map((d) => ({ label: d.label, id: d.id, ...extractScores(d) }));

  return [...personal, ...demographicBars];
}

function resetToDefaultChart() {
  selectedDemographics.clear();
  clearComboSelection();
  showPersonalOnly = false;
  clearMassPreset();
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  updateFilteredMessage();
  renderChart();
}

function clearDemographics() {
  selectedDemographics.clear();
  clearComboSelection();
  showPersonalOnly = true;
  clearMassPreset();
  document.querySelectorAll('.checkbox-list input[type="checkbox"]').forEach((input) => {
    input.checked = false;
  });
  updateFilteredMessage();
  renderChart();
}

function buildChartData(groups) {
  const colored = assignBarColors(groups);
  return {
    labels: DIMENSIONS.map((d) => d.label),
    datasets: colored.map((g) => ({
      label: g.label,
      data: DIMENSION_KEYS.map((k) => g[k]),
      backgroundColor: g.color + '99',
      borderColor: g.color,
      borderWidth: g.label === 'Your Result' ? 2.5 : 1.5,
      borderRadius: 2,
    })),
  };
}

function renderChart(forceRebuild = false) {
  const canvas = document.getElementById('results-chart');
  const groups = getVisibleDemographics();
  const data = buildChartData(groups);
  const datasetCount = data.datasets.length;

  if (chart && (forceRebuild || chart.data.datasets.length !== datasetCount)) {
    chart.destroy();
    chart = null;
  }

  if (chart) {
    chart.data.labels = data.labels;
    chart.data.datasets = data.datasets;
    chart.update();
    return;
  }

  chart = new Chart(canvas, {
    type: 'bar',
    data,
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'top',
          labels: {
            boxWidth: 12,
            boxHeight: 12,
            padding: 10,
            font: { family: "'Source Sans 3', sans-serif", size: 11 },
          },
        },
        tooltip: {
          callbacks: {
            title(ctx) {
              const dim = DIMENSIONS[ctx[0].dataIndex];
              return dim ? dim.label : ctx[0].label;
            },
            label(ctx) {
              return `${ctx.dataset.label}: ${ctx.parsed.y.toFixed(2)}`;
            },
          },
        },
      },
      scales: {
        y: {
          min: 0,
          max: 7,
          ticks: { stepSize: 1 },
          grid: { color: '#ede4d8' },
          title: {
            display: true,
            text: 'Score',
            font: { family: "'Source Sans 3', sans-serif" },
          },
        },
        x: {
          stacked: false,
          grid: { display: false },
          ticks: {
            font: { family: "'Source Sans 3', sans-serif", size: 10 },
            maxRotation: 45,
            minRotation: 35,
            autoSkip: false,
          },
        },
      },
    },
  });
}

function renderScoreGrid(containerId, scores, empty) {
  const container = document.getElementById(containerId);
  container.innerHTML = DIMENSIONS.map((d) => `
    <div class="score-grid-item">
      <span class="score-dim">${d.short}</span>
      <span class="value">${empty ? '—' : scores[d.key].toFixed(2)}</span>
    </div>
  `).join('');
}

function updateScoreDisplay() {
  const visitorCard = document.getElementById('visitor-score-card');
  const changeColourBtn = document.getElementById('change-colour-btn');

  renderScoreGrid('score-my-grid', MY_RESULT, false);

  if (visitorResults) {
    renderScoreGrid('score-visitor-grid', visitorResults, false);
    visitorCard.classList.add('has-data');
    changeColourBtn.hidden = false;
    DIMENSIONS.forEach((d) => {
      document.getElementById(`input-${d.key}`).value = visitorResults[d.key];
    });
  } else {
    renderScoreGrid('score-visitor-grid', ZERO, true);
    visitorCard.classList.remove('has-data');
    changeColourBtn.hidden = true;
    DIMENSIONS.forEach((d) => {
      document.getElementById(`input-${d.key}`).value = '';
    });
  }
}

function getComboStatus(key) {
  const scores = DEMOGRAPHIC_COMBOS[key];
  if (scores && hasScores(scores)) return 'captured';
  if (DEMOGRAPHIC_NOT_ENOUGH.has(key)) return 'not_enough';
  return 'no_data';
}

function getCombosGroupedByCategory(categoryKey) {
  const inCategory = DEMOGRAPHICS.filter((d) => d.category === categoryKey);
  const otherCategories = [...new Set(
    DEMOGRAPHICS.filter((d) => d.category !== categoryKey).map((d) => d.category),
  )];

  return inCategory.map((anchor) => {
    const combos = [];
    otherCategories.forEach((otherKey) => {
      DEMOGRAPHICS.filter((d) => d.category === otherKey).forEach((partner) => {
        const ids = [anchor.id, partner.id].sort();
        const key = ids.join(',');
        const api = DEMOGRAPHIC_COMBOS[key];
        combos.push({
          key,
          ids,
          partnerLabel: partner.label,
          label: `${anchor.label} + ${partner.label}`,
          ...extractScores(api || ZERO),
          status: getComboStatus(key),
        });
      });
    });
    combos.sort((a, b) => a.partnerLabel.localeCompare(b.partnerLabel));
    return { anchor, combos };
  });
}

function applyComboSelection(combo) {
  showPersonalOnly = false;
  clearMassPreset();

  if (selectedCombos.has(combo.key)) {
    selectedCombos.delete(combo.key);
  } else {
    selectedCombos.add(combo.key);
  }

  document.querySelectorAll('.combo-item-btn').forEach((btn) => {
    btn.classList.toggle('active', selectedCombos.has(btn.dataset.comboKey));
  });

  updateFilteredMessage();
  renderChart();
}

function renderComboPanel(section, categoryKey) {
  const grouped = getCombosGroupedByCategory(categoryKey);
  const allCombos = grouped.flatMap((g) => g.combos);
  const captured = allCombos.filter((c) => c.status === 'captured').length;

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'combo-toggle';
  toggle.textContent = `Show all combos (${captured}/${allCombos.length})`;

  const panel = document.createElement('div');
  panel.className = 'combo-panel';
  panel.hidden = true;

  const columns = document.createElement('div');
  columns.className = grouped.length === 4
    ? 'combo-columns combo-columns-quad'
    : 'combo-columns';

  const statusLabels = {
    no_data: 'no data',
    not_enough: 'not enough data',
    missing: 'no data',
  };

  grouped.forEach(({ anchor, combos }) => {
    const col = document.createElement('div');
    col.className = 'combo-column';

    const header = document.createElement('div');
    header.className = 'combo-column-header';
    header.textContent = `${anchor.label} +`;
    col.appendChild(header);

    const list = document.createElement('ul');
    list.className = 'combo-list';

    combos.forEach((combo) => {
      const li = document.createElement('li');
      li.className = `combo-item ${combo.status}`;

      if (combo.status === 'captured') {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'combo-item-btn';
        btn.dataset.comboKey = combo.key;
        if (selectedCombos.has(combo.key)) btn.classList.add('active');
        btn.textContent = combo.partnerLabel;
        btn.addEventListener('click', () => applyComboSelection(combo));
        li.appendChild(btn);
      } else {
        li.innerHTML = `
          <span class="combo-item-label">${combo.partnerLabel}</span>
          <span class="combo-item-status">${statusLabels[combo.status]}</span>
        `;
      }

      list.appendChild(li);
    });

    col.appendChild(list);
    columns.appendChild(col);
  });

  panel.appendChild(columns);

  toggle.addEventListener('click', () => {
    const open = panel.hidden;
    panel.hidden = !open;
    section.classList.toggle('combos-open', open);
    toggle.textContent = open
      ? `Hide combos (${captured}/${allCombos.length})`
      : `Show all combos (${captured}/${allCombos.length})`;
  });

  section.appendChild(toggle);
  section.appendChild(panel);
}

function renderCategorySection(container, { key, title }) {
  const section = document.createElement('div');
  section.className = 'demographic-category';

  const heading = document.createElement('h3');
  heading.textContent = title;
  section.appendChild(heading);

  const list = document.createElement('ul');
  list.className = 'checkbox-list';

  DEMOGRAPHICS.filter((d) => d.category === key).forEach((d) => {
    const li = document.createElement('li');
    const id = `demo-${d.id}`;
    const available = hasScores(d);
    li.className = available ? 'demo-item' : 'demo-item demo-item-unavailable';
    li.innerHTML = available
      ? `<label for="${id}"><input type="checkbox" id="${id}" value="${d.id}">${d.label}</label>`
      : `<span class="demo-item-label">${d.label}</span><span class="demo-item-status">no data</span>`;
    list.appendChild(li);

    if (!available) return;

    li.querySelector('input').addEventListener('change', (e) => {
      if (e.target.checked) {
        showPersonalOnly = false;
        clearMassPreset();
        selectedDemographics.add(d.id);
      } else {
        selectedDemographics.delete(d.id);
      }
      clearMassPreset();
      updateFilteredMessage();
      renderChart();
    });
  });

  section.appendChild(list);
  renderComboPanel(section, key);
  container.appendChild(section);
}

function renderMassPresets() {
  const container = document.getElementById('mass-presets');
  if (!container) return;

  container.innerHTML = '';
  DIMENSIONS.forEach((dim) => {
    ['low', 'high'].forEach((dir) => {
      const preset = `${dir}-${dim.key}`;
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'btn btn-secondary mass-preset-btn';
      btn.dataset.preset = preset;
      btn.style.setProperty('--preset-color', MASS_PRESET_COLORS[dim.key]);
      btn.textContent = `${dir === 'low' ? 'Lowest' : 'Highest'} ${dim.label.toLowerCase()}`;
      btn.addEventListener('click', () => applyMassPreset(preset));
      container.appendChild(btn);
    });
  });
}

function renderDemographicFilters() {
  const container = document.getElementById('demographic-groups');
  container.innerHTML = '';

  DEMOGRAPHIC_COLUMNS.forEach((column) => {
    const colEl = document.createElement('div');
    colEl.className = 'demographic-column';
    column.categories.forEach((category) => {
      renderCategorySection(colEl, category);
    });
    container.appendChild(colEl);
  });
}

function updateFilteredMessage(override) {
  const el = document.getElementById('filtered-result');
  if (override) {
    el.textContent = override;
    el.classList.add('visible');
    return;
  }

  if (massPreset) {
    const list = massPresetBars.map((g) => `${g.label} (${formatScoresCompact(g)})`).join('<br>');
    el.innerHTML = `<strong>${MASS_PRESET_LABELS[massPreset]}</strong><br><small>${list}</small>`;
    el.classList.add('visible');
    return;
  }

  if (selectedCombos.size > 0 || selectedDemographics.size > 0) {
    const lines = [];

    [...selectedDemographics].forEach((id) => {
      const d = DEMOGRAPHICS.find((item) => item.id === id);
      lines.push(`${d.label}: ${formatScoresCompact(d)}`);
    });

    [...selectedCombos].forEach((key) => {
      const label = labelForComboKey(key);
      const combo = DEMOGRAPHIC_COMBOS[key];
      if (!combo) {
        lines.push(`${label} — not available`);
        return;
      }
      lines.push(`${label}: ${formatScoresCompact(combo)}`);
    });

    let comparison = `My result: ${formatScoresCompact(MY_RESULT)}`;
    if (visitorResults) {
      comparison = `Your result: ${formatScoresCompact(visitorResults)} &nbsp;|&nbsp; ${comparison}`;
    }

    el.innerHTML = `
      <strong>Selection comparison:</strong><br>
      ${lines.join('<br>')}
      <br><small>YourMorals.org API averages for each group shown.</small>
      <br><small>${comparison}</small>
    `;
    el.classList.add('visible');
    return;
  }

  el.classList.remove('visible');
}

function readFormScores() {
  const scores = {};
  for (const d of DIMENSIONS) {
    const val = parseFloat(document.getElementById(`input-${d.key}`).value);
    if (Number.isNaN(val) || val < 0 || val > 7) {
      return null;
    }
    scores[d.key] = val;
  }
  return scores;
}

function initResults() {
  visitorResults = loadVisitorResults();

  document.getElementById('score-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const scores = readFormScores();
    if (!scores) {
      alert('All scores must be between 0.0 and 7.0.');
      return;
    }

    visitorResults = scores;
    saveVisitorResults(scores);
    if (!visitorColor) {
      visitorColor = barColorMap.get('Your Result');
      const [h] = hexToHsl(visitorColor);
      visitorHue = h;
    }
    updateScoreDisplay();
    renderChart();
    updateFilteredMessage();
  });

  document.getElementById('clear-results-btn').addEventListener('click', () => {
    visitorResults = null;
    resetVisitorColor();
    clearVisitorResults();
    updateScoreDisplay();
    renderChart();
    updateFilteredMessage();
  });

  document.getElementById('clear-demographics-btn').addEventListener('click', clearDemographics);
  document.getElementById('reset-chart-btn').addEventListener('click', resetToDefaultChart);
  document.getElementById('change-colour-btn').addEventListener('click', cycleVisitorColor);

  renderMassPresets();
  renderDemographicFilters();
  initBarColors();
  if (visitorResults) {
    visitorColor = barColorMap.get('Your Result');
    const [h] = hexToHsl(visitorColor);
    visitorHue = h;
  }
  updateScoreDisplay();
  renderChart();
}

document.addEventListener('DOMContentLoaded', initResults);
