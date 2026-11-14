// Pastel Galaxy SVG & DOM visualizers for the Sweet Dreams Specialist View (matches src/theme.js & src/components/LineArt.js).

import { smoothPath } from '../src/line.js';

const NS = 'http://www.w3.org/2000/svg';

function el(tag, attrs = {}, text = null) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v !== null && v !== undefined) node.setAttribute(k, String(v));
  }
  if (text !== null) node.textContent = text;
  return node;
}

const tooltip = () => document.getElementById('tooltip');

function attachTip(node, htmlFn) {
  node.style.cursor = 'pointer';
  node.addEventListener('mouseenter', (e) => {
    const tip = tooltip();
    if (!tip) return;
    tip.innerHTML = htmlFn();
    tip.style.display = 'block';
    tip.style.left = `${Math.min(window.innerWidth - 295, e.clientX + 14)}px`;
    tip.style.top = `${Math.max(12, e.clientY - 14)}px`;
  });
  node.addEventListener('mousemove', (e) => {
    const tip = tooltip();
    if (!tip) return;
    tip.style.left = `${Math.min(window.innerWidth - 295, e.clientX + 14)}px`;
    tip.style.top = `${Math.max(12, e.clientY - 14)}px`;
  });
  node.addEventListener('mouseleave', () => {
    const tip = tooltip();
    if (tip) tip.style.display = 'none';
  });
}

function shortDate(dateStr) {
  const [, m, d] = dateStr.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/** Multi-layer soft glow stroke matching src/components/LineArt.js GlowLine */
function appendGlowPath(svg, d, stroke, width = 2.6, glowColor = stroke) {
  svg.appendChild(
    el('path', {
      d,
      fill: 'none',
      stroke: glowColor,
      'stroke-opacity': 0.14,
      'stroke-width': width * 3.2,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })
  );
  svg.appendChild(
    el('path', {
      d,
      fill: 'none',
      stroke,
      'stroke-width': width,
      'stroke-linecap': 'round',
      'stroke-linejoin': 'round',
    })
  );
}

/**
 * 1. Dual-line longitudinal chart: Motor Objective Index (0..10) vs Perceived Mood Score (0..10).
 */
export function renderDualLineChart(container, days, onSelectDay, selectedDate = null) {
  container.innerHTML = '';
  if (!days.length) {
    container.textContent = 'No evenings available.';
    return;
  }

  const w = Math.max(600, days.length * 34);
  const h = 240;
  const padL = 36;
  const padR = 18;
  const padT = 20;
  const padB = 28;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h });

  const yFor = (val) => padT + ((10 - val) / 10) * plotH;
  const xFor = (i) => (days.length === 1 ? padL + plotW / 2 : padL + (i / (days.length - 1)) * plotW);

  // Soft pastel peach agitation / accelerated watch zone (> 6.8, i.e., > +1.8 SD)
  svg.appendChild(
    el('rect', {
      x: padL,
      y: yFor(10),
      width: plotW,
      height: yFor(6.8) - yFor(10),
      fill: 'rgba(255, 216, 190, 0.055)',
    })
  );

  // Soft pastel rose slowing zone (< 3.5, i.e., < -1.5 SD)
  svg.appendChild(
    el('rect', {
      x: padL,
      y: yFor(3.5),
      width: plotW,
      height: yFor(0) - yFor(3.5),
      fill: 'rgba(241, 181, 215, 0.055)',
    })
  );

  // Soft lilac +-1 SD personal equilibrium band (4.0 .. 6.0)
  svg.appendChild(
    el('rect', {
      x: padL,
      y: yFor(6),
      width: plotW,
      height: yFor(4) - yFor(6),
      fill: 'rgba(212, 187, 255, 0.085)',
    })
  );

  svg.appendChild(
    el(
      'text',
      { x: w - padR - 6, y: padT + 11, 'text-anchor': 'end', fill: 'rgba(255,216,190,0.62)', 'font-size': 9.5, 'font-weight': 500 },
      'Agitation watch (> 6.8)'
    )
  );
  svg.appendChild(
    el(
      'text',
      { x: w - padR - 6, y: yFor(5) - 6, 'text-anchor': 'end', fill: 'rgba(235,220,255,0.48)', 'font-size': 9.5, 'font-weight': 500 },
      'Equilibrium (4–6)'
    )
  );
  svg.appendChild(
    el(
      'text',
      { x: w - padR - 6, y: yFor(0) - 6, 'text-anchor': 'end', fill: 'rgba(241,181,215,0.58)', 'font-size': 9.5, 'font-weight': 500 },
      'Slowing (< 3.5)'
    )
  );

  // Horizontal grid lines
  for (const tick of [0, 2, 4, 5, 6, 8, 10]) {
    const y = yFor(tick);
    const isCenter = tick === 5;
    svg.appendChild(
      el('line', {
        x1: padL,
        x2: w - padR,
        y1: y,
        y2: y,
        stroke: isCenter ? 'rgba(212,187,255,0.3)' : 'rgba(255,255,255,0.045)',
        'stroke-dasharray': isCenter ? '3 6' : null,
      })
    );
    if (tick % 2 === 0 || isCenter) {
      svg.appendChild(
        el(
          'text',
          { x: padL - 8, y: y + 3.5, 'text-anchor': 'end', fill: isCenter ? '#ebdcff' : 'rgba(203,196,208,0.55)', 'font-size': 10 },
          String(tick)
        )
      );
    }
  }

  // Practice boundary marker
  const lastPracticeIdx = days.reduce((acc, d, idx) => (d.isPractice ? idx : acc), -1);
  if (lastPracticeIdx >= 0 && lastPracticeIdx < days.length - 1) {
    const bx = (xFor(lastPracticeIdx) + xFor(lastPracticeIdx + 1)) / 2;
    svg.appendChild(
      el('line', {
        x1: bx,
        x2: bx,
        y1: padT,
        y2: h - padB,
        stroke: 'rgba(203,196,208,0.18)',
        'stroke-dasharray': '2 5',
      })
    );
    svg.appendChild(
      el('text', { x: (padL + bx) / 2, y: padT + 11, 'text-anchor': 'middle', fill: 'rgba(203,196,208,0.5)', 'font-size': 9.5 }, 'Practice')
    );
  }

  // Selected evening highlight band (matches AnalysisScreen.js Week selection pill)
  const selIdx = days.findIndex((d) => d.date === selectedDate);
  if (selIdx >= 0) {
    const sx = xFor(selIdx);
    svg.appendChild(
      el('rect', {
        x: sx - 10,
        y: padT,
        width: 20,
        height: plotH,
        rx: 8,
        fill: '#d4bbff',
        'fill-opacity': 0.1,
        stroke: '#d4bbff',
        'stroke-opacity': 0.3,
      })
    );
  }

  const objPts = [];
  const subPts = [];
  days.forEach((d, i) => {
    const x = xFor(i);
    const hasObj = typeof d.objectiveIndex === 'number';
    const hasSub = typeof d.subjectiveScore === 'number';
    if (hasObj) objPts.push({ x, y: yFor(d.objectiveIndex), d });
    if (hasSub) subPts.push({ x, y: yFor(d.subjectiveScore), d });

    // Connector only when baseline-normalized mood and signed motor pace diverge by >= 1.5 SD
    const moodZ = d.alignedZ?.dayScoreZ;
    const paceZ = d.domains?.tempoFluency;
    const zDivergent =
      typeof moodZ === 'number' && typeof paceZ === 'number'
        ? Math.abs(moodZ - paceZ) >= 1.5
        : false;
    if (hasObj && hasSub && zDivergent) {
      svg.appendChild(
        el('line', {
          x1: x,
          x2: x,
          y1: yFor(d.objectiveIndex),
          y2: yFor(d.subjectiveScore),
          stroke: 'rgba(241, 181, 215, 0.55)',
          'stroke-width': 1.6,
          'stroke-dasharray': '2 3',
        })
      );
    }

    if (i % Math.max(1, Math.floor(days.length / 10)) === 0 || i === days.length - 1 || d.date === selectedDate) {
      svg.appendChild(
        el(
          'text',
          {
            x,
            y: h - 8,
            'text-anchor': 'middle',
            fill: d.date === selectedDate ? '#ebdcff' : 'rgba(203,196,208,0.6)',
            'font-size': 10,
            'font-weight': d.date === selectedDate ? 600 : 400,
          },
          shortDate(d.date)
        )
      );
    }
  });

  if (objPts.length > 1) {
    appendGlowPath(svg, smoothPath(objPts), '#cde5ff', 2.6, '#cde5ff');
  }
  if (subPts.length > 1) {
    appendGlowPath(svg, smoothPath(subPts), '#f1b5d7', 2.5, '#d4bbff');
  }

  for (const p of objPts) {
    const isSel = p.d.date === selectedDate;
    const isSlow = p.d.objectiveIndex <= 3.5;
    const isAgitated = p.d.objectiveIndex >= 6.8 || p.d.motorState?.code === 'agitation_watch';
    const ptStroke = isSlow ? '#f497c0' : isAgitated ? '#ffd8be' : '#cde5ff';
    if (isSel) {
      svg.appendChild(el('circle', { cx: p.x, cy: p.y, r: 10, fill: ptStroke, 'fill-opacity': 0.22, 'pointer-events': 'none' }));
    }
    const c = el('circle', {
      cx: p.x,
      cy: p.y,
      r: isSel ? 5 : 3.8,
      fill: isSel ? '#ffffff' : '#1b1a27',
      stroke: ptStroke,
      'stroke-width': 2,
    });
    attachTip(
      c,
      () =>
        `<strong>${p.d.date}</strong><br/>Motor Pace: <b>${p.d.objectiveIndex.toFixed(1)} / 10</b> (${
          p.d.motorState?.label ||
          (isSlow ? 'Psychomotor slowing' : isAgitated ? 'Possible agitation / dysregulation' : 'In personal equilibrium')
        })${
          typeof p.d.dysregulationZ === 'number'
            ? `<br/>Dysregulation |z|: <b>${p.d.dysregulationZ.toFixed(2)} SD</b>`
            : ''
        }`
    );
    c.addEventListener('click', () => onSelectDay?.(p.d.date));
    svg.appendChild(c);
  }

  for (const p of subPts) {
    const isSel = p.d.date === selectedDate;
    if (isSel) {
      svg.appendChild(el('circle', { cx: p.x, cy: p.y, r: 10, fill: '#ebdcff', 'fill-opacity': 0.24, 'pointer-events': 'none' }));
    }
    const c = el('circle', {
      cx: p.x,
      cy: p.y,
      r: isSel ? 5 : 3.8,
      fill: isSel ? '#ffffff' : '#1b1a27',
      stroke: '#f1b5d7',
      'stroke-width': 2,
    });
    attachTip(
      c,
      () =>
        `<strong>${p.d.date}</strong>${p.d.isPractice ? ' <span style="opacity:0.7">(Practice evening)</span>' : ''}<br/>Perceived Mood: <b>${p.d.subjectiveScore.toFixed(
          1
        )} / 10</b>${p.d.rationale ? `<br/><span style="opacity:0.78">${p.d.rationale}</span>` : ''}`
    );
    c.addEventListener('click', () => onSelectDay?.(p.d.date));
    svg.appendChild(c);
  }

  container.appendChild(svg);
}

/**
 * 2. Diverging Horizontal Domain Bars:
 * Supports `two_tailed` (Slowing <- Equilibrium -> Agitation Watch),
 * `magnitude` (0 Regulated -> +3 SD Dysregulated), and `directional`.
 */
export function renderDomainBars(container, domains) {
  container.innerHTML = '';
  for (const dom of domains) {
    const z = typeof dom.z === 'number' && Number.isFinite(dom.z) ? dom.z : null;
    const mode = dom.mode || 'directional';
    const clamped = z === null ? 0 : Math.max(-3, Math.min(3, z));

    let statusText = 'Pre-baseline';
    let valColor = 'var(--faint)';
    let fillBg = 'transparent';
    if (z !== null) {
      if (mode === 'magnitude') {
        const magStr = `${z.toFixed(2)} SD`;
        if (z >= 1.6) {
          statusText = `${magStr} · ${dom.highLabel || 'Dysregulated'}`;
          valColor = 'var(--peach)';
          fillBg = 'linear-gradient(90deg, #d4bbff, #ffd8be)';
        } else if (z >= 1.2) {
          statusText = `${magStr} · Mild spread`;
          valColor = 'var(--lilac-pale)';
          fillBg = 'rgba(212, 187, 255, 0.8)';
        } else {
          statusText = `${magStr} · Regulated`;
          valColor = 'var(--blue)';
          fillBg = 'linear-gradient(90deg, #d4bbff, #cde5ff)';
        }
      } else if (mode === 'two_tailed') {
        const signStr = `${z >= 0 ? '+' : ''}${z.toFixed(2)} SD`;
        if (z <= -1.5) {
          statusText = `${signStr} · ${dom.lowLabel || 'Slowing'}`;
          valColor = 'var(--pink)';
          fillBg = 'linear-gradient(90deg, #f497c0, #f1b5d7)';
        } else if (z < -1.0) {
          statusText = `${signStr} · Mildly slower`;
          valColor = 'var(--pink)';
          fillBg = 'rgba(241, 181, 215, 0.78)';
        } else if (z >= 1.8) {
          statusText = `${signStr} · ${dom.agitationLabel || 'Agitation watch'}`;
          valColor = 'var(--peach)';
          fillBg = 'linear-gradient(90deg, #d4bbff, #ffd8be)';
        } else if (z > 1.0) {
          statusText = `${signStr} · Brisk (monitor)`;
          valColor = 'var(--lilac-pale)';
          fillBg = 'rgba(212, 187, 255, 0.8)';
        } else {
          statusText = `${signStr} · In equilibrium`;
          valColor = 'var(--blue)';
          fillBg = z < 0 ? 'rgba(212, 187, 255, 0.7)' : 'rgba(205, 229, 255, 0.78)';
        }
      } else {
        const signStr = `${z >= 0 ? '+' : ''}${z.toFixed(2)} SD`;
        if (z <= -1) {
          statusText = `${signStr} · ${dom.lowLabel || 'Below baseline'}`;
          valColor = 'var(--pink)';
          fillBg = 'linear-gradient(90deg, #f497c0, #f1b5d7)';
        } else if (z >= 1) {
          statusText = `${signStr} · ${dom.highLabel || 'Above baseline'}`;
          valColor = 'var(--blue)';
          fillBg = 'linear-gradient(90deg, #d4bbff, #cde5ff)';
        } else {
          statusText = `${signStr} · Equilibrium`;
          valColor = 'var(--lilac-pale)';
          fillBg = z < 0 ? 'rgba(241, 181, 215, 0.65)' : 'rgba(212, 187, 255, 0.72)';
        }
      }
    }

    const row = document.createElement('div');
    row.className = 'dom-row';

    const head = document.createElement('div');
    head.className = 'dom-head';
    const nameEl = document.createElement('span');
    nameEl.className = 'dom-name';
    nameEl.textContent = dom.label;
    const valEl = document.createElement('span');
    valEl.className = 'dom-val';
    valEl.style.color = valColor;
    valEl.textContent = statusText;
    head.append(nameEl, valEl);

    const track = document.createElement('div');
    track.className = 'dom-track';
    const normalBand = document.createElement('div');
    normalBand.className = 'dom-normal';
    normalBand.title = 'Equilibrium range: −1.0 to +1.0 SD';
    const zeroTick = document.createElement('div');
    zeroTick.className = 'dom-zero';
    track.append(normalBand, zeroTick);

    if (z !== null) {
      const fill = document.createElement('div');
      fill.className = 'dom-fill';
      const widthPct = Math.max(1.8, (Math.abs(clamped) / 3) * 50);
      fill.style.width = `${widthPct}%`;
      fill.style.left = clamped < 0 ? `${50 - widthPct}%` : '50%';
      fill.style.background = fillBg;
      track.appendChild(fill);
    }

    row.append(head, track);
    container.appendChild(row);
  }
}

/**
 * 3. Daily Scorecard Heatmap in Pastel Galaxy tones:
 * Pastel Rose (< 0 SD, slower/heavier) <-> Twilight Neutral <-> Pastel Sky (> 0 SD, faster/lighter).
 */
export function renderZHeatmap(container, days, features, onSelectDay, selectedDate = null) {
  container.innerHTML = '';
  if (!days.length) {
    container.textContent = 'No evenings available.';
    return;
  }

  const labelW = 204;
  const cellW = Math.max(28, Math.min(44, Math.floor(820 / days.length)));
  const cellH = 26;
  const padT = 30;
  const w = labelW + days.length * cellW + 14;
  const h = padT + features.length * cellH + 10;

  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h });

  const colorForZ = (z, twoTailed = false) => {
    if (z === null || z === undefined) return 'rgba(255,255,255,0.03)';
    const c = Math.max(-3, Math.min(3, z));
    if (Math.abs(c) < 0.28) return 'rgba(212, 187, 255, 0.09)';
    if (c < 0) {
      const a = Math.min(0.76, 0.14 + (Math.abs(c) / 3) * 0.62);
      return `rgba(244, 151, 192, ${a.toFixed(2)})`;
    }
    if (twoTailed && c >= 1.8) {
      const a = Math.min(0.78, 0.34 + ((c - 1.8) / 1.2) * 0.44);
      return `rgba(255, 216, 190, ${a.toFixed(2)})`;
    }
    const a = Math.min(0.72, 0.14 + (c / 3) * 0.56);
    return `rgba(205, 229, 255, ${a.toFixed(2)})`;
  };

  // Practice header bracket
  const pracCols = days.map((d, i) => (d.isPractice ? i : -1)).filter((i) => i >= 0);
  if (pracCols.length) {
    const x0 = labelW + pracCols[0] * cellW + 2;
    const x1 = labelW + (pracCols[pracCols.length - 1] + 1) * cellW - 2;
    svg.appendChild(
      el('text', { x: (x0 + x1) / 2, y: 11, 'text-anchor': 'middle', fill: 'rgba(203,196,208,0.55)', 'font-size': 9.5, 'font-weight': 500 }, 'Practice (1–5)')
    );
  }

  // Date headers
  const showEvery = days.length <= 16 ? 1 : 2;
  days.forEach((d, col) => {
    const x = labelW + col * cellW + cellW / 2;
    const isSel = d.date === selectedDate;
    if (col % showEvery === 0 || col === days.length - 1 || isSel) {
      svg.appendChild(
        el(
          'text',
          {
            x,
            y: 23,
            'text-anchor': 'middle',
            fill: isSel ? '#ebdcff' : 'rgba(203,196,208,0.62)',
            'font-size': 9.5,
            'font-weight': isSel ? 600 : 400,
          },
          shortDate(d.date)
        )
      );
    }
  });

  features.forEach((feat, row) => {
    const y = padT + row * cellH;
    svg.appendChild(
      el('text', { x: labelW - 10, y: y + 17, 'text-anchor': 'end', fill: '#cbc4d0', 'font-size': 11.5, 'font-weight': 400 }, feat.label)
    );

    days.forEach((d, col) => {
      const val = d.alignedZ?.[feat.key] ?? null;
      const x = labelW + col * cellW;
      const g = el('g');

      const rect = el('rect', {
        x: x + 1.5,
        y: y + 1.5,
        width: cellW - 3,
        height: cellH - 3,
        rx: 6,
        fill: d.isPractice ? 'rgba(255,255,255,0.02)' : colorForZ(val, feat.twoTailed),
        stroke: d.isPractice ? 'rgba(255,255,255,0.05)' : val !== null && Math.abs(val) >= 1.5 ? 'rgba(255,255,255,0.26)' : null,
        'stroke-dasharray': d.isPractice ? '2 3' : null,
      });
      g.appendChild(rect);

      if (cellW >= 28) {
        if (d.isPractice) {
          g.appendChild(
            el('text', { x: x + cellW / 2, y: y + 16.5, 'text-anchor': 'middle', fill: 'rgba(203,196,208,0.28)', 'font-size': 9 }, '·')
          );
        } else if (val !== null) {
          const txt = `${val > 0 ? '+' : ''}${val.toFixed(1)}`;
          const darkInk = val >= 1.35;
          g.appendChild(
            el(
              'text',
              {
                x: x + cellW / 2,
                y: y + 16.5,
                'text-anchor': 'middle',
                fill: darkInk ? '#13121f' : Math.abs(val) >= 1.1 ? '#ffffff' : 'rgba(228,224,243,0.82)',
                'font-size': 9.5,
                'font-weight': Math.abs(val) >= 1.4 ? 600 : 500,
              },
              txt
            )
          );
        } else {
          g.appendChild(
            el('text', { x: x + cellW / 2, y: y + 16.5, 'text-anchor': 'middle', fill: 'rgba(203,196,208,0.25)', 'font-size': 9 }, '—')
          );
        }
      }

      attachTip(g, () => {
        if (d.isPractice) {
          return `<strong>${d.date}</strong><br/>${feat.label}: <b>Practice evening</b> (excluded from baseline)`;
        }
        if (val === null) {
          return `<strong>${d.date}</strong><br/>${feat.label}: <b>Not recorded</b>`;
        }
        const zStr = `${val >= 0 ? '+' : ''}${val.toFixed(2)} SD`;
        const verdict =
          feat.twoTailed && val >= 1.8
            ? 'Abnormally fast (> +1.8 SD · Possible agitation / dysregulation)'
            : val <= -1.5
            ? 'Notably below equilibrium (Slowing / Dysregulated)'
            : val < -1.0
            ? 'Mildly below equilibrium'
            : val > 1.0
            ? feat.twoTailed
              ? 'Brisk pace (monitor equilibrium)'
              : 'Steady / lighter than baseline'
            : 'Within personal equilibrium (±1 SD)';
        const expNote = feat.exploratory
          ? '<br/><span style="opacity:0.68">Exploratory: curve shape &amp; recall pauses affect Day Line speed.</span>'
          : '';
        return `<strong>${d.date}</strong><br/>${feat.label}: <b>${zStr}</b><br/><span style="opacity:0.85">${verdict}</span>${expNote}`;
      });
      g.addEventListener('click', () => onSelectDay?.(d.date));
      svg.appendChild(g);
    });
  });

  // Selected column soft lilac frame
  const selCol = days.findIndex((d) => d.date === selectedDate);
  if (selCol >= 0) {
    svg.appendChild(
      el('rect', {
        x: labelW + selCol * cellW + 0.5,
        y: padT,
        width: cellW - 1,
        height: features.length * cellH,
        rx: 7,
        fill: 'none',
        stroke: '#ebdcff',
        'stroke-opacity': 0.75,
        'stroke-width': 1.6,
        'pointer-events': 'none',
      })
    );
  }

  container.appendChild(svg);
}

/** 4. Daily smooth GlowLine sparkline for a single modality metric. */
export function renderModalityTrend(container, days, { valueFn, unit = '', color = '#d4bbff', onSelectDay, selectedDate = null }) {
  container.innerHTML = '';
  const pts = days.map((d, i) => ({ d, i, v: valueFn(d) })).filter((p) => typeof p.v === 'number' && Number.isFinite(p.v));
  if (!pts.length) {
    container.textContent = 'No valid sessions in selected range.';
    return;
  }

  const w = 360;
  const h = 128;
  const padL = 38;
  const padR = 12;
  const padT = 14;
  const padB = 22;
  const plotW = w - padL - padR;
  const plotH = h - padT - padB;

  const minV = Math.min(...pts.map((p) => p.v));
  const maxV = Math.max(...pts.map((p) => p.v));
  const span = Math.max(1e-3, maxV - minV);

  const xFor = (i) => (days.length === 1 ? padL + plotW / 2 : padL + (i / (days.length - 1)) * plotW);
  const yFor = (v) => padT + (1 - (v - minV) / span) * plotH;

  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h });

  // Soft IQR band + dashed median line
  const sortedVals = pts.map((p) => p.v).sort((a, b) => a - b);
  const q25 = sortedVals[Math.floor(0.25 * (sortedVals.length - 1))];
  const q50 = sortedVals[Math.floor(0.5 * (sortedVals.length - 1))];
  const q75 = sortedVals[Math.floor(0.75 * (sortedVals.length - 1))];
  if (sortedVals.length >= 3) {
    svg.appendChild(
      el('rect', {
        x: padL,
        y: yFor(q75),
        width: plotW,
        height: Math.max(2, yFor(q25) - yFor(q75)),
        rx: 4,
        fill: 'rgba(212, 187, 255, 0.06)',
      })
    );
    svg.appendChild(
      el('line', {
        x1: padL,
        x2: w - padR,
        y1: yFor(q50),
        y2: yFor(q50),
        stroke: 'rgba(203,196,208,0.2)',
        'stroke-dasharray': '3 5',
      })
    );
  }

  svg.appendChild(el('text', { x: padL - 6, y: padT + 5, 'text-anchor': 'end', fill: 'rgba(203,196,208,0.6)', 'font-size': 9.5 }, maxV.toFixed(1)));
  svg.appendChild(el('text', { x: padL - 6, y: h - padB + 2, 'text-anchor': 'end', fill: 'rgba(203,196,208,0.6)', 'font-size': 9.5 }, minV.toFixed(1)));

  svg.appendChild(el('text', { x: padL, y: h - 5, 'text-anchor': 'start', fill: 'rgba(203,196,208,0.5)', 'font-size': 9 }, shortDate(days[0].date)));
  if (days.length > 1) {
    svg.appendChild(
      el('text', { x: w - padR, y: h - 5, 'text-anchor': 'end', fill: 'rgba(203,196,208,0.5)', 'font-size': 9 }, shortDate(days[days.length - 1].date))
    );
  }

  const xyPts = pts.map((p) => ({ x: xFor(p.i), y: yFor(p.v), p }));
  if (xyPts.length > 1) {
    appendGlowPath(svg, smoothPath(xyPts), color, 2.3, color);
  }

  for (const pt of xyPts) {
    const isSel = pt.p.d.date === selectedDate;
    if (isSel) {
      svg.appendChild(el('circle', { cx: pt.x, cy: pt.y, r: 9, fill: color, 'fill-opacity': 0.22, 'pointer-events': 'none' }));
    }
    const c = el('circle', {
      cx: pt.x,
      cy: pt.y,
      r: isSel ? 4.5 : 3.2,
      fill: isSel ? '#ffffff' : '#1b1a27',
      stroke: color,
      'stroke-width': 1.8,
    });
    attachTip(c, () => `<strong>${pt.p.d.date}</strong><br/><b>${pt.p.v.toFixed(1)} ${unit}</b> (median ${q50.toFixed(1)})`);
    c.addEventListener('click', () => onSelectDay?.(pt.p.d.date));
    svg.appendChild(c);
  }

  container.appendChild(svg);
}

/**
 * 5. Day Line Trajectory Inspector — authentic Sweet Dreams GlowLine + Overlay ghost trails
 * (matches src/components/LineArt.js & AnalysisScreen.js Overlay).
 */
export function renderDayLineSvg(container, line, allDays = [], selectedDate = null) {
  container.innerHTML = '';
  if (!line?.points?.length) {
    container.textContent = 'No Day Line recorded.';
    return;
  }
  const w = Math.max(360, Math.round(container.clientWidth || 560));
  const h = 176;
  const pad = 14;
  const plotBottom = h - 26;
  const svg = el('svg', { viewBox: `0 0 ${w} ${h}`, width: '100%', height: h });

  // 4-stop Pastel Galaxy LineGradient (matches src/theme.js lineStops)
  const defs = el('defs');
  const grad = el('linearGradient', { id: 'dayLineGrad', gradientUnits: 'userSpaceOnUse', x1: pad, y1: 0, x2: w - pad, y2: 0 });
  for (const [offset, stopColor] of [
    ['0%', '#f1b5d7'],
    ['48%', '#d4bbff'],
    ['85%', '#cde5ff'],
    ['100%', '#ffffff'],
  ]) {
    grad.appendChild(el('stop', { offset, 'stop-color': stopColor }));
  }
  defs.appendChild(grad);
  svg.appendChild(defs);

  const midY = (pad + plotBottom) / 2;
  svg.appendChild(el('line', { x1: pad, x2: w - pad, y1: midY, y2: midY, stroke: '#cbc4d0', 'stroke-opacity': 0.14, 'stroke-dasharray': '3 6' }));
  svg.appendChild(el('text', { x: pad, y: 14, fill: '#cde5ff', 'font-size': 9.5, 'font-weight': 500 }, '+ Light'));
  svg.appendChild(el('text', { x: pad, y: plotBottom - 4, fill: '#f1b5d7', 'font-size': 9.5, 'font-weight': 500 }, '− Heavy'));

  const toPx = (pts) => {
    const minX = pts.length > 1 ? pts[0].x : 0;
    const maxX = pts.length > 1 ? pts[pts.length - 1].x : 1;
    const rangeX = maxX - minX > 1e-4 ? maxX - minX : 1;
    return pts.map((p) => ({
      x: pad + ((p.x - minX) / rangeX) * (w - pad * 2),
      y: pad + p.y * (plotBottom - pad * 1.4),
    }));
  };

  // Faint historical ghost trails (matches AnalysisScreen.js "All evenings" Overlay)
  const others = allDays.filter((d) => d.date !== selectedDate && d.entry?.line?.points?.length).slice(-14);
  others.forEach((o, idx) => {
    const od = smoothPath(toPx(o.entry.line.points));
    svg.appendChild(
      el('path', {
        d: od,
        fill: 'none',
        stroke: '#d4bbff',
        'stroke-opacity': (0.06 + 0.16 * ((idx + 1) / Math.max(1, others.length))).toFixed(2),
        'stroke-width': 1.4,
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
      })
    );
  });

  // Active evening GlowLine
  const pxPts = toPx(line.points);
  const d = smoothPath(pxPts);
  svg.appendChild(el('path', { d, fill: 'none', stroke: '#d4bbff', 'stroke-opacity': 0.14, 'stroke-width': 11, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  svg.appendChild(el('path', { d, fill: 'none', stroke: '#d4bbff', 'stroke-opacity': 0.18, 'stroke-width': 6.5, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));
  svg.appendChild(el('path', { d, fill: 'none', stroke: 'url(#dayLineGrad)', 'stroke-width': 3.2, 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

  const last = pxPts[pxPts.length - 1];
  svg.appendChild(el('circle', { cx: last.x, cy: last.y, r: 13, fill: '#ebdcff', 'fill-opacity': 0.16 }));
  svg.appendChild(el('circle', { cx: last.x, cy: last.y, r: 8, fill: '#ebdcff', 'fill-opacity': 0.3 }));
  svg.appendChild(el('circle', { cx: last.x, cy: last.y, r: 4.5, fill: '#ffffff' }));

  // Bottom axis divider ("Morning" ... "Night", matching AnalysisScreen.js axisRow)
  svg.appendChild(el('line', { x1: pad, x2: w - pad, y1: plotBottom + 6, y2: plotBottom + 6, stroke: 'rgba(255,255,255,0.05)' }));
  svg.appendChild(el('text', { x: pad, y: h - 4, fill: 'rgba(203,196,208,0.6)', 'font-size': 10.5, 'font-weight': 500 }, 'Morning'));
  svg.appendChild(el('text', { x: w - pad, y: h - 4, 'text-anchor': 'end', fill: 'rgba(203,196,208,0.6)', 'font-size': 10.5, 'font-weight': 500 }, 'Night'));

  container.appendChild(svg);
}
