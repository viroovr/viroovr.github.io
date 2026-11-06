// 다크 모드 토글 + 블로그 태그 필터 (의존성 없음)
(function () {
  var root = document.documentElement;
  var btn = document.querySelector(".theme-toggle");
  if (btn) {
    btn.addEventListener("click", function () {
      var dark = root.dataset.theme
        ? root.dataset.theme === "dark"
        : matchMedia("(prefers-color-scheme: dark)").matches;
      root.dataset.theme = dark ? "light" : "dark";
      localStorage.setItem("theme", root.dataset.theme);
    });
  }

  var filter = document.querySelector(".tag-filter");
  if (!filter) return;
  var buttons = filter.querySelectorAll(".tag-btn");
  function apply(tag) {
    buttons.forEach(function (b) { b.setAttribute("aria-pressed", String(b.dataset.tag === tag)); });
    var shown = 0;
    document.querySelectorAll(".year-group").forEach(function (g) {
      var visible = 0;
      g.querySelectorAll(".post-item").forEach(function (li) {
        var ok = !tag || (" " + li.dataset.tags + " ").indexOf(" " + tag + " ") >= 0;
        li.hidden = !ok;
        if (ok) visible++;
      });
      g.hidden = visible === 0;
      shown += visible;
    });
    var empty = document.querySelector(".empty-filter");
    if (empty) empty.hidden = shown > 0;
    var url = new URL(location.href);
    if (tag) url.searchParams.set("tag", tag); else url.searchParams.delete("tag");
    history.replaceState(null, "", url);
  }
  filter.addEventListener("click", function (e) {
    var b = e.target.closest(".tag-btn");
    if (b) apply(b.dataset.tag);
  });
  var initial = new URL(location.href).searchParams.get("tag");
  if (initial) apply(initial);
})();
