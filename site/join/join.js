(async () => {
  const joinUrl = location.origin + "/join/";
  document.getElementById("qr").innerHTML = window.QR.toSVG(joinUrl, { fg: "#0e1b2c", bg: "#ede6d3", pad: 2 });

  document.getElementById("print").addEventListener("click", () => window.print());

  try {
    const data = await (await fetch("/data.json", { cache: "no-cache" })).json();
    if (data.title) document.getElementById("title").textContent = data.title;
    const repo = /^[\w.-]+\/[\w.-]+$/.test(data.repo || "") ? data.repo : null;
    if (repo) {
      document.getElementById("go").href =
        `https://github.com/${repo}/issues/new?template=join.yml&title=${encodeURIComponent("Join the crew")}`;
      document.getElementById("leave").href =
        `https://github.com/${repo}/issues/new?template=leave.yml&title=${encodeURIComponent("Leave the crew")}`;
    }
  } catch {}
})();
