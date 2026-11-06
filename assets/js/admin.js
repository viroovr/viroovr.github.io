// 블로그 어드민 — GitHub REST API 로 레포에 직접 커밋한다. 서버 없음.
// 토큰은 브라우저 저장소(local/session)에만 두고 api.github.com 으로만 보낸다.
(() => {
  "use strict";

  const REPO = { owner: "viroovr", name: "viroovr.github.io", branch: "master" };
  const API = "https://api.github.com";
  const RAW = `https://raw.githubusercontent.com/${REPO.owner}/${REPO.name}/${REPO.branch}`;
  const TOKEN_KEY = "viroovr-admin-token";
  const IMG_DIR = "assets/img/posts";

  // 타입별 설정: 폼에서 다루는 front matter 키(순서 = 저장 순서)
  const TYPES = {
    posts: {
      dir: "_posts",
      label: "글",
      keys: ["layout", "title", "date", "description", "tags", "categories", "published"],
      url: (fm, file) => {
        const m = file.match(/^(\d{4})-\d{2}-\d{2}-(.+)\.md$/);
        return m ? `/blog/${m[1]}/${m[2]}/` : "/blog/";
      },
    },
    projects: {
      dir: "_projects",
      label: "프로젝트",
      keys: ["layout", "title", "description", "img", "importance", "category", "stack"],
      url: (fm, file) => `/projects/${file.replace(/\.md$/, "")}/`,
    },
  };

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => [...document.querySelectorAll(s)];

  const state = {
    token: null,
    readonly: false,
    type: "posts",
    items: { posts: null, projects: null },
    cur: null,          // { type, path, sha, isNew }
    dirty: false,
    deployTimer: null,
  };

  // ---------------------------------------------------------------- utils
  const b64encode = (str) => {
    const bytes = new TextEncoder().encode(str);
    let bin = "";
    for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
    return btoa(bin);
  };
  const b64decode = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
  const pad = (n) => String(n).padStart(2, "0");
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  function toast(text, kind = "") {
    const t = $("#toast");
    t.textContent = text;
    t.className = `toast ${kind}`;
    t.hidden = false;
    clearTimeout(toast._t);
    toast._t = setTimeout(() => (t.hidden = true), 3500);
  }

  // ---------------------------------------------------------------- GitHub API
  async function gh(path, opts = {}) {
    const headers = { Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28" };
    if (state.token) headers.Authorization = `Bearer ${state.token}`;
    if (opts.body) headers["Content-Type"] = "application/json";
    const res = await fetch(API + path, { ...opts, headers, cache: "no-store" });
    if (!res.ok) {
      let msg = `${res.status}`;
      try { msg += ` ${(await res.json()).message}`; } catch (_) { /* ignore */ }
      const err = new Error(msg);
      err.status = res.status;
      throw err;
    }
    return res.status === 204 ? null : res.json();
  }
  const repoPath = (p = "") => `/repos/${REPO.owner}/${REPO.name}${p}`;
  const contentsPath = (path) => repoPath(`/contents/${path.split("/").map(encodeURIComponent).join("/")}`);

  const getFile = async (path) => {
    const j = await gh(`${contentsPath(path)}?ref=${REPO.branch}`);
    return { sha: j.sha, text: b64decode(j.content) };
  };
  // 목록용: 같은 sha 면 내용이 같으므로 세션 동안 캐시해 API 호출(시간당 한도)을 아낀다.
  const BLOB_CACHE = "viroovr-admin-blobs";
  const blobCache = (() => { try { return JSON.parse(sessionStorage.getItem(BLOB_CACHE)) || {}; } catch (_) { return {}; } })();
  const getBlobText = async (sha) => {
    if (blobCache[sha] == null) {
      blobCache[sha] = b64decode((await gh(repoPath(`/git/blobs/${sha}`))).content);
      try { sessionStorage.setItem(BLOB_CACHE, JSON.stringify(blobCache)); } catch (_) { /* quota — 캐시 없이 동작 */ }
    }
    return blobCache[sha];
  };
  const putFile = (path, contentB64, message, sha) =>
    gh(contentsPath(path), { method: "PUT", body: JSON.stringify({ message, content: contentB64, branch: REPO.branch, ...(sha ? { sha } : {}) }) });
  const deleteFile = (path, sha, message) =>
    gh(contentsPath(path), { method: "DELETE", body: JSON.stringify({ message, sha, branch: REPO.branch }) });

  // ---------------------------------------------------------------- front matter
  // 최상위 키 단위로 자른다. 들여쓰기/리스트 줄은 앞 키에 붙인다(값 보존).
  function parseDoc(text) {
    const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
    if (!m) return { blocks: [], body: text };
    const blocks = [];
    for (const line of m[1].split(/\r?\n/)) {
      const k = line.match(/^([A-Za-z0-9_-]+):\s?(.*)$/);
      if (k) blocks.push({ key: k[1], value: k[2], raw: [line] });
      else if (blocks.length) blocks[blocks.length - 1].raw.push(line);
      else blocks.push({ key: null, raw: [line] });
    }
    return { blocks, body: m[2] };
  }
  const unquote = (v) => {
    v = v.replace(/\s+#.*$/, "").trim();
    if (/^".*"$/.test(v)) { try { return JSON.parse(v); } catch (_) { return v.slice(1, -1); } }
    if (/^'.*'$/.test(v)) return v.slice(1, -1).replace(/''/g, "'");
    return v;
  };
  const yamlStr = (v) => (v === "" || /^[\s>|!&*%@`'"[\]{},#?-]|[:#]\s|:$|\s$/.test(v) ? JSON.stringify(v) : v);
  const parseList = (v) => {
    v = unquote(v);
    if (/^\[.*\]$/.test(v)) return v.slice(1, -1).split(",").map((s) => unquote(s.trim())).filter(Boolean);
    return v ? v.split(/\s+/) : [];
  };

  // "2026-11-06 09:00:00+0900" ↔ datetime-local
  const fmDateToInput = (v) => {
    const m = unquote(v || "").match(/^(\d{4}-\d{2}-\d{2})(?:[ T](\d{2}):(\d{2}))?/);
    return m ? `${m[1]}T${m[2] || "09"}:${m[3] || "00"}` : "";
  };
  const inputToFmDate = (v) => `${v.replace("T", " ")}:00+0900`;
  const inputToDateObj = (v) => new Date(`${v}:00+09:00`);
  const nowKstInput = () => {
    const d = new Date(Date.now() + 9 * 3600e3);
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}T${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}`;
  };

  // ---------------------------------------------------------------- list
  async function loadList(type, force = false) {
    if (state.items[type] && !force) return renderList();
    $("#list").innerHTML = `<li class="muted pad">불러오는 중…</li>`;
    try {
      const files = (await gh(`${contentsPath(TYPES[type].dir)}?ref=${REPO.branch}`)).filter((f) => f.type === "file" && f.name.endsWith(".md"));
      // 제목·공개여부를 보여주려면 각 파일 front matter 가 필요하다 (글 수가 적어 병렬 조회).
      const items = await Promise.all(files.map(async (f) => {
        try {
          const text = await getBlobText(f.sha);
          const fm = Object.fromEntries(parseDoc(text).blocks.filter((b) => b.key).map((b) => [b.key, b.value]));
          return { path: f.path, name: f.name, sha: f.sha, title: unquote(fm.title || f.name), published: unquote(fm.published || "true") !== "false", date: unquote(fm.date || ""), category: unquote(fm.category || ""), importance: Number(unquote(fm.importance || "99")) };
        } catch (_) {
          return { path: f.path, name: f.name, sha: f.sha, title: f.name, published: true };
        }
      }));
      items.sort(type === "posts" ? (a, b) => b.name.localeCompare(a.name) : (a, b) => (a.category || "").localeCompare(b.category || "") || a.importance - b.importance);
      state.items[type] = items;
    } catch (e) {
      state.items[type] = e.status === 404 ? [] : null;
      if (e.status !== 404) { $("#list").innerHTML = `<li class="msg err pad">목록을 못 불러왔어요: ${esc(e.message)}</li>`; return; }
    }
    renderList();
  }

  function renderList() {
    const q = $("#search").value.trim().toLowerCase();
    const items = (state.items[state.type] || []).filter((i) => !q || `${i.title} ${i.name}`.toLowerCase().includes(q));
    $("#list").innerHTML = items.length
      ? items.map((i) => `
        <li><button class="item${state.cur && state.cur.path === i.path ? " active" : ""}" data-path="${esc(i.path)}">
          <span class="t">${esc(i.title)}</span>
          <span class="meta">${i.published ? "" : '<span class="pill draft">임시저장</span>'}${esc(state.type === "posts" ? i.name.slice(0, 10) : `${i.category || "-"} · ${i.importance ?? ""}`)}</span>
        </button></li>`).join("")
      : `<li class="muted pad">${q ? "검색 결과 없음" : "아직 없어요. 새로 만들어 보세요."}</li>`;
  }

  // ---------------------------------------------------------------- editor
  function setType(type) {
    state.type = type;
    $$(".tab").forEach((t) => t.classList.toggle("active", t.dataset.type === type));
    loadList(type);
  }

  function showFieldsFor(type) {
    $$("#form [data-for]").forEach((el) => (el.hidden = el.dataset.for !== type));
  }

  function fillForm(type, doc, file) {
    const f = $("#form");
    const get = (k) => doc.blocks.find((b) => b.key === k);
    const known = new Set(TYPES[type].keys);
    f.reset();
    showFieldsFor(type);
    f.title.value = unquote(get("title")?.value || "");
    f.description.value = unquote(get("description")?.value || "");
    if (type === "posts") {
      f.date.value = fmDateToInput(get("date")?.value) || nowKstInput();
      f.slug.value = (file || "").replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
      f.slug.readOnly = !!file;
      f.tags.value = parseList(get("tags")?.value || "").join(" ");
      f.categories.value = parseList(get("categories")?.value || "").join(" ");
      f.published.checked = unquote(get("published")?.value || "true") !== "false";
    } else {
      f.category.value = unquote(get("category")?.value || "side");
      f.importance.value = unquote(get("importance")?.value || "1");
      f.img.value = unquote(get("img")?.value || "");
      const st = get("stack");
      f.stack.value = st ? (st.raw.length > 1 ? st.raw.slice(1).map((l) => l.replace(/^\s*-\s*/, "")).filter(Boolean) : parseList(st.value)).join(", ") : "";
    }
    // 폼에서 다루지 않는 키는 원문 그대로 보존
    f.extra.value = doc.blocks.filter((b) => !b.key || !known.has(b.key)).map((b) => b.raw.join("\n")).join("\n");
    f.extra.dataset.layout = unquote(get("layout")?.value || (type === "posts" ? "post" : "page"));
    $("#body").value = doc.body.replace(/^\n/, "");
    checkDate();
    renderPreview();
  }

  function buildDoc(type) {
    const f = $("#form");
    const lines = [`layout: ${f.extra.dataset.layout || (type === "posts" ? "post" : "page")}`, `title: ${yamlStr(f.title.value.trim())}`];
    if (type === "posts") {
      lines.push(`date: ${inputToFmDate(f.date.value)}`);
      if (f.description.value.trim()) lines.push(`description: ${yamlStr(f.description.value.trim())}`);
      const tags = f.tags.value.trim().split(/[\s,]+/).filter(Boolean);
      const cats = f.categories.value.trim().split(/[\s,]+/).filter(Boolean);
      if (tags.length) lines.push(`tags: ${tags.join(" ")}`);
      if (cats.length) lines.push(`categories: ${cats.join(" ")}`);
      if (!f.published.checked) lines.push("published: false");
    } else {
      lines.push(`description: ${yamlStr(f.description.value.trim())}`);
      if (f.img.value.trim()) lines.push(`img: ${yamlStr(f.img.value.trim())}`);
      lines.push(`importance: ${parseInt(f.importance.value, 10) || 1}`);
      lines.push(`category: ${f.category.value}`);
      const stack = f.stack.value.split(",").map((s) => s.trim()).filter(Boolean);
      if (stack.length) lines.push(`stack: [${stack.map(yamlStr).join(", ")}]`);
    }
    const extra = f.extra.value.replace(/\s+$/, "");
    if (extra) lines.push(extra);
    const body = $("#body").value.replace(/\s+$/, "");
    return `---\n${lines.join("\n")}\n---\n\n${body}\n`;
  }

  async function openItem(path) {
    if (!confirmDiscard()) return;
    $("#formMsg").textContent = "";
    try {
      const { sha, text } = await getFile(path);
      const file = path.split("/").pop();
      state.cur = { type: state.type, path, sha, isNew: false, file };
      fillForm(state.type, parseDoc(text), file);
      showEditor();
      renderList();
      closeSidebar();
    } catch (e) {
      toast(`열기 실패: ${e.message}`, "err");
    }
  }

  function newItem() {
    if (!confirmDiscard()) return;
    const type = state.type;
    state.cur = { type, path: null, sha: null, isNew: true, file: null };
    const starter = type === "posts"
      ? "## 증상\n\n\n## 관측한 사실\n\n\n## 원인\n\n\n## 수정\n\n\n## 검증\n\n"
      : "## 무엇을 만들었나\n\n\n## 주요 기능\n\n- \n\n## 설계에서 신경 쓴 점\n\n- \n";
    fillForm(type, { blocks: [], body: starter }, null);
    if (type === "projects") {
      const used = (state.items.projects || []).map((i) => i.importance).filter(Number.isFinite);
      $("#form").importance.value = used.length ? Math.max(...used) + 1 : 1;
    }
    $("#form").title.focus();
    showEditor();
    renderList();
    closeSidebar();
  }

  function showEditor() {
    $("#empty").hidden = true;
    $("#form").hidden = false;
    const c = state.cur;
    $("#filePath").textContent = c.isNew ? `새 ${TYPES[c.type].label}` : c.path;
    $("#deleteBtn").hidden = c.isNew || state.readonly;
    $("#saveBtn").disabled = state.readonly;
    const v = $("#viewBtn");
    v.hidden = c.isNew;
    if (!c.isNew) v.href = TYPES[c.type].url({}, c.file);
    setDirty(false);
  }

  function newPath(type) {
    const f = $("#form");
    if (type === "posts") {
      const slug = f.slug.value.trim();
      if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) throw new Error("주소(slug)는 영문 소문자·숫자·하이픈만 쓸 수 있어요. 예: jvm-memory-leak");
      return `${TYPES.posts.dir}/${f.date.value.slice(0, 10)}-${slug}.md`;
    }
    const n = (state.items.projects || []).map((i) => parseInt(i.name, 10)).filter(Number.isFinite);
    return `${TYPES.projects.dir}/${(n.length ? Math.max(...n) : 0) + 1}_project.md`;
  }

  async function save(ev) {
    ev.preventDefault();
    if (state.readonly || !state.cur) return;
    const c = state.cur;
    const f = $("#form");
    const msg = $("#formMsg");
    msg.className = "msg";
    if (!f.title.value.trim()) { msg.textContent = "제목을 입력하세요."; msg.classList.add("err"); return; }
    if (c.type === "posts" && !f.date.value) { msg.textContent = "공개 시각을 입력하세요."; msg.classList.add("err"); return; }
    let path = c.path;
    try {
      if (c.isNew) {
        path = newPath(c.type);
        if ((state.items[c.type] || []).some((i) => i.path === path)) throw new Error(`같은 파일이 이미 있어요: ${path}`);
      }
    } catch (e) { msg.textContent = e.message; msg.classList.add("err"); return; }

    const text = buildDoc(c.type);
    const verb = c.isNew ? "add" : "update";
    const title = f.title.value.trim();
    $("#saveBtn").disabled = true;
    msg.textContent = "저장 중…";
    try {
      const res = await putFile(path, b64encode(text), `admin: ${verb} ${c.type === "posts" ? "post" : "project"} — ${title}`, c.sha);
      state.cur = { ...c, path, sha: res.content.sha, isNew: false, file: path.split("/").pop() };
      showEditor();
      msg.textContent = "저장했어요. 1~2분 뒤 사이트에 반영됩니다.";
      msg.classList.add("ok");
      toast("저장 완료 · 배포 시작", "ok");
      await loadList(c.type, true);
      watchDeploy();
    } catch (e) {
      msg.classList.add("err");
      msg.textContent = e.status === 409 || e.status === 422 && /sha/i.test(e.message)
        ? "다른 곳에서 먼저 수정됐어요. 내용을 복사해 두고 항목을 다시 열어 주세요."
        : e.status === 401 || e.status === 403
          ? `권한이 없어요(${e.status}). 토큰 권한(Contents: Read and write)과 만료일을 확인하세요.`
          : `저장 실패: ${e.message}`;
    } finally {
      $("#saveBtn").disabled = state.readonly;
    }
  }

  async function remove() {
    const c = state.cur;
    if (!c || c.isNew || state.readonly) return;
    const title = $("#form").title.value.trim() || c.file;
    if (!confirm(`'${title}' 을(를) 삭제할까요?\n레포에서 파일이 지워지고 사이트에서 사라집니다. (git 기록에서는 되살릴 수 있음)`)) return;
    try {
      await deleteFile(c.path, c.sha, `admin: delete ${c.type === "posts" ? "post" : "project"} — ${title}`);
      toast("삭제했어요", "ok");
      state.cur = null;
      setDirty(false);
      $("#form").hidden = true;
      $("#empty").hidden = false;
      await loadList(c.type, true);
      watchDeploy();
    } catch (e) {
      toast(`삭제 실패: ${e.message}`, "err");
    }
  }

  // ---------------------------------------------------------------- image upload
  async function uploadImage(file) {
    if (!file || state.readonly) return;
    if (file.size > 5 * 1024 * 1024) { toast("5MB 이하 이미지만 올릴 수 있어요", "err"); return; }
    const d = new Date(Date.now() + 9 * 3600e3);
    const stamp = `${d.getUTCFullYear()}${pad(d.getUTCMonth() + 1)}${pad(d.getUTCDate())}-${pad(d.getUTCHours())}${pad(d.getUTCMinutes())}${pad(d.getUTCSeconds())}`;
    const ext = (file.name.match(/\.[a-z0-9]+$/i) || [".png"])[0].toLowerCase();
    const path = `${IMG_DIR}/${stamp}${ext}`;
    toast("이미지 올리는 중…");
    try {
      const b64 = await new Promise((ok, fail) => {
        const r = new FileReader();
        r.onload = () => ok(String(r.result).split(",")[1]);
        r.onerror = fail;
        r.readAsDataURL(file);
      });
      await putFile(path, b64, `admin: upload image ${path.split("/").pop()}`);
      insertAtCursor(`![${file.name.replace(/\.[^.]+$/, "")}](/${path})`);
      toast("이미지를 넣었어요", "ok");
    } catch (e) {
      toast(`업로드 실패: ${e.message}`, "err");
    }
  }

  function insertAtCursor(text) {
    const ta = $("#body");
    const { selectionStart: s, selectionEnd: e, value } = ta;
    ta.value = `${value.slice(0, s)}${text}${value.slice(e)}`;
    ta.selectionStart = ta.selectionEnd = s + text.length;
    ta.focus();
    setDirty(true);
    renderPreview();
  }

  // ---------------------------------------------------------------- preview
  function renderPreview() {
    if (!window.marked || !window.DOMPurify) { $("#preview").textContent = "미리보기 라이브러리를 불러오지 못했어요."; return; }
    // Liquid 태그는 Jekyll 이 빌드할 때만 해석되므로 미리보기에서는 표시만 한다.
    const src = $("#body").value.replace(/\{%.*?%\}/g, (m) => `\`${m}\``);
    const html = DOMPurify.sanitize(marked.parse(src));
    const box = $("#preview");
    box.innerHTML = `<h1>${esc($("#form").title.value)}</h1>${html}`;
    // 아직 배포 전인 이미지도 보이게 레포 원본 주소로 바꿔서 보여준다.
    box.querySelectorAll("img[src^='/assets/']").forEach((img) => (img.src = RAW + img.getAttribute("src")));
  }

  function setView(view) {
    $$(".seg button").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
    $("#bodyWrap").className = `body-wrap view-${view}`;
    if (view !== "edit") renderPreview();
  }

  // ---------------------------------------------------------------- deploy status
  async function refreshDeploy() {
    const el = $("#deploy");
    try {
      const { workflow_runs: runs } = await gh(repoPath("/actions/runs?per_page=5"));
      const run = runs.find((r) => r.name !== "Docker Image CI") || runs[0];
      if (!run) { el.textContent = "배포 기록 없음"; el.className = "deploy"; return false; }
      const when = new Date(run.created_at).toLocaleString("ko-KR", { month: "numeric", day: "numeric", hour: "2-digit", minute: "2-digit" });
      const busy = run.status !== "completed";
      const label = busy ? "배포 중" : run.conclusion === "success" ? "배포 완료" : `배포 실패(${run.conclusion})`;
      el.textContent = `${label} · ${when}`;
      el.className = `deploy ${busy ? "busy" : run.conclusion === "success" ? "ok" : "err"}`;
      el.href = run.html_url;
      return busy;
    } catch (e) {
      el.textContent = e.status === 403 || e.status === 401 ? "배포 상태: 토큰에 Actions 읽기 권한 필요" : "배포 상태 확인 실패";
      el.className = "deploy";
      el.removeAttribute("href");
      return false;
    }
  }
  function watchDeploy() {
    clearInterval(state.deployTimer);
    let n = 0;
    const tick = async () => {
      const busy = await refreshDeploy();
      if ((++n > 3 && !busy) || n > 30) clearInterval(state.deployTimer);
    };
    setTimeout(tick, 3000);
    state.deployTimer = setInterval(tick, 10000);
  }

  // ---------------------------------------------------------------- dirty / layout
  function setDirty(v) {
    state.dirty = v;
    $("#dirty").hidden = !v;
  }
  function confirmDiscard() {
    return !state.dirty || confirm("저장하지 않은 변경이 있어요. 버리고 이동할까요?");
  }
  function checkDate() {
    const f = $("#form");
    $("#dateWarn").hidden = !(state.cur?.type === "posts" && f.date.value && inputToDateObj(f.date.value) > new Date());
  }
  const closeSidebar = () => document.body.classList.remove("side-open");

  // ---------------------------------------------------------------- auth
  let loginSeq = 0;
  async function login(token, remember) {
    const seq = ++loginSeq; // 나중에 시작한 로그인만 화면에 반영
    state.token = token || null;
    state.readonly = !token;
    const msg = $("#loginMsg");
    msg.textContent = token ? "확인 중…" : "";
    try {
      const repo = await gh(repoPath());
      if (token && !repo.permissions?.push) throw Object.assign(new Error("이 토큰에는 레포 쓰기 권한이 없어요 (Contents: Read and write 필요)."), { status: 403 });
      if (token) {
        (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, token);
        (remember ? sessionStorage : localStorage).removeItem(TOKEN_KEY);
      }
    } catch (e) {
      if (seq !== loginSeq) return;
      state.token = null;
      if (e.status === 401 || e.status === 403) { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); }
      $("#login").hidden = false;
      msg.className = "msg err";
      msg.textContent = e.status === 401 ? "토큰이 올바르지 않거나 만료됐어요." : e.message;
      return;
    }
    if (seq !== loginSeq) return;
    $("#token").value = "";
    $("#login").hidden = true;
    $("#app").hidden = false;
    $("#mode").textContent = state.readonly ? "읽기 전용" : "편집 가능";
    $("#mode").className = `badge ${state.readonly ? "" : "ok"}`;
    $("#newBtn").hidden = state.readonly;
    $(".upload").hidden = state.readonly;
    setType("posts");
    loadList("projects"); // 프로젝트 번호 계산용으로 미리 받아 둔다
    refreshDeploy();
  }

  function logout() {
    if (!confirmDiscard()) return;
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(TOKEN_KEY);
    location.reload();
  }

  // ---------------------------------------------------------------- wire up
  $("#loginBtn").addEventListener("click", () => {
    const t = $("#token").value.trim();
    if (!t) { $("#loginMsg").className = "msg err"; $("#loginMsg").textContent = "토큰을 붙여넣으세요."; return; }
    login(t, $("#remember").checked);
  });
  $("#token").addEventListener("keydown", (e) => { if (e.key === "Enter") $("#loginBtn").click(); });
  $("#readonlyBtn").addEventListener("click", () => login(null, false));
  $("#logoutBtn").addEventListener("click", logout);
  $$(".tab").forEach((t) => t.addEventListener("click", () => { if (confirmDiscard()) { setDirty(false); state.cur = null; $("#form").hidden = true; $("#empty").hidden = false; setType(t.dataset.type); } }));
  $("#list").addEventListener("click", (e) => { const b = e.target.closest(".item"); if (b) openItem(b.dataset.path); });
  $("#search").addEventListener("input", renderList);
  $("#newBtn").addEventListener("click", newItem);
  $("#form").addEventListener("submit", save);
  $("#form").addEventListener("input", (e) => {
    setDirty(true);
    if (e.target.name === "date") checkDate();
    if (e.target.id === "body" || e.target.name === "title") { clearTimeout(renderPreview._t); renderPreview._t = setTimeout(renderPreview, 250); }
  });
  $("#form").title.addEventListener("blur", () => {
    const f = $("#form");
    // 새 글이고 slug 가 비었으면 제목의 영문/숫자로 제안 (한글 제목이면 날짜 기반)
    if (state.cur?.isNew && state.cur.type === "posts" && !f.slug.value) {
      const s = f.title.value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
      f.slug.value = s || `post-${f.date.value.slice(11, 16).replace(":", "")}`;
    }
  });
  $("#deleteBtn").addEventListener("click", remove);
  $$(".seg button").forEach((b) => b.addEventListener("click", () => setView(b.dataset.view)));
  $("#imgFile").addEventListener("change", (e) => { uploadImage(e.target.files[0]); e.target.value = ""; });
  $("#menuBtn").addEventListener("click", () => document.body.classList.toggle("side-open"));
  document.addEventListener("keydown", (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key === "s" && !$("#form").hidden) { e.preventDefault(); $("#form").requestSubmit(); }
  });
  window.addEventListener("beforeunload", (e) => { if (state.dirty) { e.preventDefault(); e.returnValue = ""; } });

  const saved = localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
  if (saved) login(saved, !!localStorage.getItem(TOKEN_KEY));
  else $("#login").hidden = false;
})();
