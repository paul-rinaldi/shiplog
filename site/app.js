// Renders site/data.json. Everything user-supplied goes through textContent,
// never innerHTML, so a weird display name can't inject markup.
(async () => {
  const $ = (s) => document.querySelector(s);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const safeImg = (u) =>
    /^https:\/\/(avatars\.githubusercontent\.com|github\.com)\//.test(u || "") ? u : "";
  const safeLogin = (l) => (/^[A-Za-z0-9-]{1,39}$/.test(l) ? l : "");

  let data;
  try {
    const res = await fetch("/data.json", { cache: "no-cache" });
    data = await res.json();
  } catch {
    $("#empty").hidden = false;
    $("#empty").textContent = "The leaderboard data didn't load. Refresh in a minute.";
    return;
  }

  if (data.title) { $("#title").textContent = data.title; document.title = data.title; }
  if (data.tagline) $("#tagline").textContent = data.tagline;

  const s = data.scoring;
  $("#scoring").textContent =
    `Merged PR ${s.mergedPR} pts, review ${s.review}, opened PR ${s.openedPR}, issue ${s.issue}, ` +
    `commit ${s.commit}, private contribution ${s.private}. Your current streak adds ` +
    `${Math.round(s.streakBonusPerDay * 100)}% per day, up to +${Math.round(s.streakBonusMax * 100)}%. ` +
    `Private work only counts if you turn on "Include private contributions" in your GitHub profile settings.`;

  if (data.updatedAt) {
    const mins = Math.round((Date.now() - new Date(data.updatedAt)) / 60000);
    const ago = mins < 60 ? `${mins} min ago` : mins < 1440 ? `${Math.round(mins / 60)} h ago` : `${Math.round(mins / 1440)} days ago`;
    $("#updated").textContent = `Board updated ${ago}. Refreshes every 3 hours.`;
  }

  const level = (c) => (c === 0 ? 0 : c <= 2 ? 1 : c <= 5 ? 2 : c <= 9 ? 3 : 4);

  function flaps(score) {
    const box = el("div", "flaps");
    box.setAttribute("aria-label", `${score} points`);
    const str = String(score).padStart(4, " ");
    [...str].forEach((ch, i) => {
      const t = el("span", ch === " " ? "blank" : "", ch === " " ? "0" : ch);
      t.style.setProperty("--d", i);
      t.setAttribute("aria-hidden", "true");
      box.append(t);
    });
    return box;
  }

  function stat(v, label, hot) {
    return Object.assign(el("span", "stat" + (v === 0 ? " zero" : hot ? " hot" : ""), String(v)), {
      title: label,
    });
  }

  function renderFlags(win, users) {
    const box = $("#flags");
    box.replaceChildren();
    if (!users.length) return;
    const top = (f) => [...users].sort((a, b) => f(b) - f(a))[0];
    const streak = top((u) => u.streak);
    const shipped = top((u) => u[win].mergedPRs);
    const reviews = top((u) => u[win].reviews);
    const sleepers = users.filter((u) => u[win].score === 0);
    const items = [
      ["Longest streak", streak.streak ? streak.name : "Nobody yet", streak.streak ? `${streak.streak} days` : ""],
      ["Most PRs merged", shipped[win].mergedPRs ? shipped.name : "Nobody yet", shipped[win].mergedPRs ? `${shipped[win].mergedPRs}` : ""],
      ["Most reviews", reviews[win].reviews ? reviews.name : "Nobody yet", reviews[win].reviews ? `${reviews[win].reviews}` : ""],
      ["Needs to touch a keyboard", sleepers.length ? sleepers.map((u) => u.name).join(", ") : "Everyone shipped", "", sleepers.length ? "grass" : ""],
    ];
    for (const [label, who, extra, cls] of items) {
      const d = el("dl", "flag" + (cls ? " " + cls : ""));
      const dd = el("dd", null, who);
      if (extra) dd.append(el("small", null, extra));
      d.append(el("dt", null, label), dd);
      box.append(d);
    }
  }

  function render(win, animate) {
    const users = [...(data.users || [])].sort((a, b) => b[win].score - a[win].score || b.streak - a.streak);
    const list = $("#rows");
    list.replaceChildren();
    $("#empty").hidden = users.length > 0;
    if (!users.length) $("#empty").textContent = "No one on the board yet. Hit Join the crew to be first.";
    renderFlags(win, users);

    users.forEach((u, i) => {
      const w = u[win];
      const li = el("li", "row" + (i < 3 && w.score > 0 ? " top" : ""));

      const pos = el("div", "pos", String(i + 1));
      if (w.rankDelta) {
        const up = w.rankDelta > 0;
        pos.append(el("span", "move " + (up ? "up" : "down"), `${up ? "▲" : "▼"} ${Math.abs(w.rankDelta)}`));
      }

      const login = safeLogin(u.login);
      const crew = el("a", "crew");
      crew.href = `https://github.com/${login}`;
      crew.target = "_blank";
      crew.rel = "noopener noreferrer";
      const img = el("img");
      img.src = safeImg(u.avatar);
      img.alt = "";
      img.loading = "lazy";
      const names = el("span");
      names.append(el("b", null, u.name), el("i", null, "@" + login));
      crew.append(img, names);

      const stats = el("div", "stats-wrap");
      const sMerged = stat(w.mergedPRs, "merged PRs");
      const sRev = stat(w.reviews, "reviews");
      const sCom = stat(w.commits + w.private, "commits");
      const sStreak = stat(u.streak, "day streak", u.streak >= 3);
      sMerged.dataset.label = "shipped";
      sRev.dataset.label = "reviews";
      sCom.dataset.label = "commits";
      sStreak.dataset.label = "day streak";
      stats.append(sMerged, sRev, sCom, sStreak);

      const heat = el("div", "heat");
      heat.setAttribute("aria-label", "Activity over the last 12 weeks");
      for (const c of u.heat || []) {
        const cell = el("i");
        cell.dataset.l = level(c);
        heat.append(cell);
      }

      const score = flaps(w.score);
      if (animate) score.classList.add("flip");
      li.append(pos, crew, stats, heat, score);
      list.append(li);
    });
  }

  const tabs = document.querySelectorAll(".switch button");
  tabs.forEach((b) =>
    b.addEventListener("click", () => {
      tabs.forEach((t) => t.setAttribute("aria-selected", String(t === b)));
      render(b.dataset.win, true);
    })
  );
  render("week", true);
})();
