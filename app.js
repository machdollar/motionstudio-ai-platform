(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEYS = { prompts: "motionstudio.prompts.v1", settings: "motionstudio.settings.v1", calendar: "motionstudio.calendar.v1" };
  const viewNames = { overview:"Overview", video:"AI Video Studio", shorts:"Viral Shorts Planner", image:"Image & Motion", ugc:"UGC & Ad Studio", script:"Scriptwriter", captions:"Voice & Captions", calendar:"Content Calendar", library:"Prompt Library", settings:"Studio settings" };
  let toastTimer;
  let currentScript = "";
  let currentImageUrl = "";

  function toast(message) {
    const node = $("#toast");
    node.textContent = message;
    node.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => node.classList.remove("show"), 2600);
  }
  function escapeHTML(value) {
    return String(value ?? "").replace(/[&<>"']/g, char => ({ "&":"&amp;", "<":"&lt;", ">":"&gt;", '"':"&quot;", "'":"&#39;" }[char]));
  }
  function safeUrl(value) {
    try { const url = new URL(value); return ["http:", "https:"].includes(url.protocol) ? url.href : ""; } catch { return ""; }
  }
  function downloadText(filename, content, mime = "text/plain;charset=utf-8") {
    const blob = new Blob([content], { type:mime });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url; link.download = filename; document.body.appendChild(link); link.click(); link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function copyText(text) {
    try {
      await navigator.clipboard.writeText(text);
      toast("Copied to clipboard.");
    } catch {
      const area = document.createElement("textarea");
      area.value = text; area.style.position = "fixed"; area.style.opacity = "0";
      document.body.appendChild(area); area.select();
      const success = document.execCommand("copy"); area.remove();
      toast(success ? "Copied to clipboard." : "Copy failed. Select and copy the output manually.");
    }
  }
  function outputHTML(target, title, body, actions = true) {
    const node = typeof target === "string" ? $(target) : target;
    node.innerHTML = `<div class="result-content"><h3>${escapeHTML(title)}</h3>${body}</div>${actions ? '<div class="result-actions"><button class="button button-secondary" data-output-copy>Copy output</button><button class="button button-secondary" data-output-download>Download .txt</button></div>' : ""}`;
    if (actions) {
      const text = `${title}\n\n${node.querySelector(".result-content").innerText}`;
      node.querySelector("[data-output-copy]").addEventListener("click", () => copyText(text));
      node.querySelector("[data-output-download]").addEventListener("click", () => downloadText("motionstudio-brief.txt", text));
    }
  }
  function showView(name) {
    if (!viewNames[name]) name = "overview";
    $$(".view").forEach(view => view.classList.toggle("active", view.id === `view-${name}`));
    $$(".nav-item[data-view]").forEach(button => button.classList.toggle("active", button.dataset.view === name));
    $("#pageCrumb").textContent = viewNames[name];
    $("#sidebar").classList.remove("open");
    window.scrollTo({ top:0, behavior:document.body.classList.contains("reduce-motion") ? "auto" : "smooth" });
  }
  $$("[data-view]").forEach(button => button.addEventListener("click", () => showView(button.dataset.view)));
  $$("[data-go]").forEach(button => button.addEventListener("click", () => showView(button.dataset.go)));
  $("#menuToggle").addEventListener("click", () => $("#sidebar").classList.toggle("open"));
  document.addEventListener("click", event => {
    if (window.innerWidth <= 850 && $("#sidebar").classList.contains("open") && !$("#sidebar").contains(event.target) && !$("#menuToggle").contains(event.target)) $("#sidebar").classList.remove("open");
  });
  $("#year").textContent = new Date().getFullYear();
  $("#helpButton").addEventListener("click", () => $("#helpDialog").showModal());
  $("#closeHelp").addEventListener("click", () => $("#helpDialog").close());
  $("#closeHelpBottom").addEventListener("click", () => $("#helpDialog").close());
  $("#helpDialog").addEventListener("click", event => { if (event.target === $("#helpDialog")) $("#helpDialog").close(); });

  $("#videoForm").addEventListener("submit", event => {
    event.preventDefault();
    const prompt = $("#videoPrompt").value.trim();
    if (!prompt) return;
    const style = $("#videoStyle").value, ratio = $("#videoRatio").value, duration = $("#videoDuration").value;
    const model = $("#videoModel").value, camera = $("#videoCamera").value, details = $("#videoDetails").value.trim();
    const full = `Create a ${duration} video in ${ratio} aspect ratio.\n\nCORE SCENE\n${prompt}\n\nVISUAL STYLE\n${style}\n\nCAMERA\n${camera}\n\nTARGET WORKFLOW\n${model}\n\nADDITIONAL DIRECTION\n${details || "Use cohesive lighting, clear subject separation, natural motion, and consistent visual continuity."}\n\nQUALITY NOTES\nKeep the subject visually consistent throughout the shot. Use deliberate composition, plausible movement, coherent lighting, and clean transitions. Avoid visual glitches, warped details, random text, and abrupt camera changes unless intentionally requested.\n\nThis is a production brief for use with a compatible media-generation service; this website does not render the video itself.`;
    outputHTML("#videoOutput", "Production-ready video prompt", `<p>${escapeHTML(full)}</p>`);
    toast("Video brief created.");
  });

  function splitSentences(text) {
    const normalized = text.replace(/\r/g, "\n").replace(/[ \t]+/g, " ").trim();
    let parts = normalized.split(/\n+|(?<=[.!?])\s+(?=[A-Z0-9“"'(])/).map(part => part.trim()).filter(Boolean);
    if (parts.length <= 1 && normalized.length > 260) {
      parts = normalized.match(/.{1,230}(?:\s|$)/g)?.map(part => part.trim()).filter(Boolean) || [normalized];
    }
    return parts;
  }
  function parseTimecode(value) {
    const match = String(value).match(/(?:\[|\()?\b(\d{1,2}):(\d{2})(?::(\d{2}))?(?:\]|\))?/);
    if (!match) return null;
    if (match[3] !== undefined) return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
    return Number(match[1]) * 60 + Number(match[2]);
  }
  function formatTimecode(seconds) {
    const total = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(total / 3600), m = Math.floor((total % 3600) / 60), s = total % 60;
    return h ? `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}` : `${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  }
  function transcriptSegments(transcript) {
    const lines = transcript.replace(/\r/g, "\n").split("\n").map(line => line.trim()).filter(Boolean);
    const hasTimedLines = lines.some(line => parseTimecode(line) !== null);
    if (hasTimedLines) {
      let current = null;
      const segments = [];
      for (const line of lines) {
        const time = parseTimecode(line);
        if (time !== null) {
          const text = line.replace(/(?:\[|\()?\b\d{1,2}:\d{2}(?::\d{2})?(?:\]|\))?/, "").replace(/^\s*[-–—:|]+\s*/, "").trim();
          if (text) segments.push({ text, startSeconds: time, timecodeSource: true });
          else current = { startSeconds: time, text: "", timecodeSource: true };
          if (current) { segments.push(current); current = null; }
        } else if (segments.length && segments[segments.length - 1].timecodeSource) {
          segments[segments.length - 1].text += (segments[segments.length - 1].text ? " " : "") + line;
        } else {
          segments.push({ text: line, startSeconds: null, timecodeSource: false });
        }
      }
      const usable = segments.filter(segment => segment.text.trim());
      if (usable.length) return usable;
    }
    return splitSentences(transcript).map(text => ({ text, startSeconds: null, timecodeSource: false }));
  }
  function estimateClipScore(text) {
    const words = text.trim().split(/\s+/).filter(Boolean);
    const lower = text.toLowerCase();
    let hook = 35, share = 30, clarity = 35;
    if (/\b(how|why|secret|mistake|never|best|worst|truth|learn|stop|before|after|surprising|because|finally|revealed|changed|three|five|first)\b/i.test(text)) hook += 22;
    if (/[?!]/.test(text)) hook += 9;
    if (/\d/.test(text)) hook += 8;
    if (words.length >= 12 && words.length <= 55) clarity += 35;
    else if (words.length < 12) clarity += 18;
    else clarity += 12;
    if (/\b(you|your|we|I|my|ours|everyone|people)\b/i.test(text)) share += 13;
    if (/\b(result|lesson|surprise|fail|win|saved|lost|realized|changed|tested|challenge|problem|learned|discovered)\b/i.test(lower)) share += 17;
    if (/\b(but|however|until|instead|then|because)\b/i.test(lower)) hook += 6;
    hook = Math.min(95, hook); share = Math.min(95, share); clarity = Math.min(95, clarity);
    return { hook, share, clarity, total:Math.round((hook + share + clarity) / 3) };
  }
  function makeTitle(text, index, tone) {
    const clean = text.replace(/^[\s"'“”]+|[\s"'“”]+$/g, "").replace(/[.!?]+$/, "");
    const words = clean.split(/\s+/).filter(Boolean);
    let title = words.slice(0, 9).join(" ");
    if (title.length > 68) title = title.slice(0, 65).replace(/\s+\S*$/, "") + "…";
    if (tone === "Educational" && !/^(how|why|what|the|3|5|first|one)\b/i.test(title)) title = `Why ${title}`;
    if (tone === "Motivational" && !/^(how|why|you|your|never|stop)\b/i.test(title)) title = `You need to hear this: ${title}`;
    if (title.length > 75) title = title.slice(0,72).replace(/\s+\S*$/, "") + "…";
    if (!/[?!]$/.test(title)) title += "?";
    return title || `Clip idea ${index}`;
  }
  function csvEscape(value) { return `"${String(value ?? "").replace(/"/g, '""')}"`; }
  let currentShortsExport = [];
  let currentShortsMeta = {};
  function buildClipPack(clip, index, meta) {
    const title = makeTitle(clip.text, index + 1, meta.tone);
    const hashtags = meta.platform === "YouTube Shorts" ? "#Shorts #CreatorTips" : meta.platform === "Instagram Reels" ? "#Reels #CreatorTips" : meta.platform === "TikTok" ? "#TikTok #CreatorTips" : "#Shorts #Reels #TikTok #CreatorTips";
    const audienceLine = meta.audience ? `Made for ${meta.audience}.` : "";
    const description = [clip.text, audienceLine, `From: ${meta.sourceTitle}`, meta.cta, hashtags].filter(Boolean).join("\n\n");
    return { ...clip, title, description, hashtags, duration:Math.max(15, Math.min(55, Math.round(clip.text.split(/\s+/).filter(Boolean).length / 2.5))), index:index + 1 };
  }
  function srtTimestamp(seconds) {
    const ms = Math.max(0, Math.floor(seconds * 1000));
    const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), s = Math.floor((ms % 60000) / 1000), milli = ms % 1000;
    return `${String(h).padStart(2,"0")}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")},${String(milli).padStart(3,"0")}`;
  }
  $("#shortsForm").addEventListener("submit", event => {
    event.preventDefault();
    const sourceTitle = $("#shortsTitle").value.trim() || "Untitled source video";
    const transcript = $("#shortsTranscript").value.trim();
    if (!transcript) return;
    const count = Number($("#shortCount").value);
    const platform = $("#shortPlatform").value;
    const tone = $("#shortTone").value;
    const audience = $("#shortAudience").value.trim();
    const cta = $("#shortCTA").value.trim();
    const sourceUrl = safeUrl($("#youtubeUrl").value);
    const segments = transcriptSegments(transcript);
    let elapsed = 0;
    let clips = segments.map((segment, i) => {
      const words = segment.text.split(/\s+/).filter(Boolean).length;
      const startSeconds = segment.startSeconds === null ? elapsed : segment.startSeconds;
      elapsed = startSeconds + Math.max(2, Math.round(words / 2.5));
      return { text:segment.text, index:i, startSeconds, timecodeSource:segment.timecodeSource, score:estimateClipScore(segment.text) };
    }).filter(clip => clip.text.trim().length > 15);
    clips.sort((a,b) => b.score.total - a.score.total);
    clips = clips.slice(0, count).map((clip, index) => buildClipPack(clip, index, { sourceTitle, platform, tone, audience, cta }));
    currentShortsExport = clips;
    currentShortsMeta = { sourceTitle, platform, tone, audience, cta, sourceUrl };
    const best = clips.reduce((sum, clip) => sum + clip.score.total, 0) / Math.max(clips.length,1);
    const cards = clips.map((clip, i) => {
      const timecodeNote = clip.timecodeSource ? "Source timestamp" : "Estimated timestamp";
      return `<article class="clip-card shorts-pack-card"><div class="clip-top"><span class="clip-number">CLIP ${String(i+1).padStart(2,"0")} · ${escapeHTML(formatTimecode(clip.startSeconds))} · ${clip.duration}s</span><span class="clip-score">Score ${clip.score.total}/100</span></div><h3>${escapeHTML(clip.title)}</h3><div class="shorts-score-bars"><span>Hook <b>${clip.score.hook}</b></span><span>Shareability <b>${clip.score.share}</b></span><span>Clarity <b>${clip.score.clarity}</b></span></div><p><strong>Source excerpt</strong><br>${escapeHTML(clip.text)}</p><p><strong>Opening hook idea</strong><br>${escapeHTML(clip.text.split(/[.!?]/)[0].trim() || clip.text)}</p><p><strong>Post description</strong><br>${escapeHTML(clip.description)}</p><p class="clip-meta">${timecodeNote} · ${escapeHTML(platform)} · ${escapeHTML(tone)}</p><div class="result-actions"><button class="button button-secondary" data-copy-clip="${i}">Copy complete clip pack</button></div></article>`;
    }).join("");
    const note = `<p>Source: ${escapeHTML(sourceTitle)}${sourceUrl ? ` · <a href="${escapeHTML(sourceUrl)}" target="_blank" rel="noopener noreferrer">Open source video</a>` : ""}</p><div class="score-row"><div class="score-box"><strong>${Math.round(best)}</strong><span>Average planning score</span></div><div class="score-box"><strong>${clips.length}</strong><span>Ranked clip opportunities</span></div><div class="score-box"><strong>${clips.filter(clip => clip.timecodeSource).length}</strong><span>Exact source timestamps</span></div></div><p>Clips are ranked using text-based heuristics. Timestamps are exact only when supplied in your transcript; otherwise they are rough estimates. These scores do not predict or guarantee views.</p>`;
    const exportActions = `<div class="result-actions shorts-export-actions"><button class="button button-secondary" id="downloadAllClips">Download production pack (.txt)</button><button class="button button-secondary" id="downloadClipsCsv">Export clip plan (.csv)</button><button class="button button-secondary" id="downloadClipSrt">Export caption draft (.srt)</button></div>`;
    $("#shortsOutput").innerHTML = `<div class="result-content">${note}</div>${cards || '<p class="helper-text">Add a longer transcript with complete sentences to find clip opportunities.</p>'}${exportActions}`;
    $$('[data-copy-clip]', $("#shortsOutput")).forEach(button => button.addEventListener("click", () => {
      const clip = currentShortsExport[Number(button.dataset.copyClip)];
      if (!clip) return;
      copyText(`CLIP ${clip.index}\nSource start: ${formatTimecode(clip.startSeconds)}\nTitle: ${clip.title}\nDuration estimate: ${clip.duration}s\n\nExcerpt:\n${clip.text}\n\nDescription:\n${clip.description}\n\nScores (heuristic): ${clip.score.total}/100 · Hook ${clip.score.hook} · Shareability ${clip.score.share} · Clarity ${clip.score.clarity}`);
    }));
    $("#downloadAllClips").addEventListener("click", () => {
      const text = `${sourceTitle}\nPlatform: ${platform}\nStyle: ${tone}\nAudience: ${audience || "Not specified"}\n\n${clips.map(clip => `CLIP ${clip.index}\nSource start: ${formatTimecode(clip.startSeconds)}\nDuration estimate: ${clip.duration}s\nTitle: ${clip.title}\nExcerpt: ${clip.text}\nDescription:\n${clip.description}\nScore: ${clip.score.total}/100 (heuristic)\nHook: ${clip.score.hook} · Shareability: ${clip.score.share} · Clarity: ${clip.score.clarity}\n`).join("\n")}`;
      downloadText("motionstudio-shorts-production-pack.txt", text);
    });
    $("#downloadClipsCsv").addEventListener("click", () => {
      const rows = [["Clip","Start time","Estimated duration (seconds)","Title","Excerpt","Description","Planning score","Hook score","Shareability score","Clarity score"], ...clips.map(clip => [clip.index, formatTimecode(clip.startSeconds), clip.duration, clip.title, clip.text, clip.description, clip.score.total, clip.score.hook, clip.score.share, clip.score.clarity])];
      downloadText("motionstudio-shorts-clip-plan.csv", rows.map(row => row.map(csvEscape).join(",")).join("\r\n"), "text/csv;charset=utf-8");
    });
    $("#downloadClipSrt").addEventListener("click", () => {
      const srt = clips.map((clip, i) => `${i+1}\n${srtTimestamp(i * clip.duration)} --> ${srtTimestamp(i * clip.duration + clip.duration)}\n${clip.text}\n`).join("\n");
      downloadText("motionstudio-caption-draft.srt", srt, "application/x-subrip;charset=utf-8");
    });
    toast("Shorts production pack created.");
  });

  $("#imageFile").addEventListener("change", event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!["image/jpeg","image/png","image/webp"].includes(file.type)) { toast("Choose a JPG, PNG, or WEBP image."); event.target.value=""; return; }
    if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = URL.createObjectURL(file);
    $("#imagePreview").src = currentImageUrl;
    $("#imagePreviewWrap").classList.remove("hidden");
  });
  function removeImage() {
    if (currentImageUrl) URL.revokeObjectURL(currentImageUrl);
    currentImageUrl = ""; $("#imageFile").value = ""; $("#imagePreview").removeAttribute("src"); $("#imagePreviewWrap").classList.add("hidden");
  }
  $("#removeImage").addEventListener("click", removeImage);
  $("#imageForm").addEventListener("submit", event => {
    event.preventDefault();
    const prompt = $("#imagePrompt").value.trim() || "Preserve the main subject and overall composition of the reference image.";
    const task = $("#imageTask").value, movement = $("#imageMovement").value;
    const full = `CREATIVE TASK\n${task}\n\nSCENE / SUBJECT\n${prompt}\n\nMOTION OR TREATMENT\n${movement}\n\nREFERENCE IMAGE GUIDANCE\nUse the uploaded image as a visual reference. Preserve the recognizable subject, key shapes, important details, and overall art direction. Keep lighting and perspective coherent. Do not introduce unrelated objects, text, logos, or extra people. Avoid flicker, warping, and sudden changes between frames.\n\nDELIVERY NOTES\nChoose the aspect ratio and duration in your media-generation tool. Review output for visual consistency before publishing.\n\nThis brief does not upload or transmit your reference image. Connect a compatible image/video provider to generate media.`;
    outputHTML("#imageOutput", "Visual direction brief", `<p>${escapeHTML(full)}</p>`);
    toast("Visual brief created.");
  });

  $("#ugcForm").addEventListener("submit", event => {
    event.preventDefault();
    const product = $("#ugcProduct").value.trim(), audience = $("#ugcAudience").value.trim() || "people who could benefit from the product";
    const benefit = $("#ugcBenefit").value.trim(), length = $("#ugcLength").value, tone = $("#ugcTone").value, cta = $("#ugcCta").value.trim() || "Learn more";
    if (!product || !benefit) return;
    const scenes = [
      ["0–3 sec · HOOK", `Open with a relatable moment for ${audience}. Show the problem or a curiosity gap immediately. Spoken hook: “I wanted a simpler way to deal with this…”`],
      ["3–8 sec · CONTEXT", `Show the everyday situation that makes ${benefit.toLowerCase()} relevant. Keep it specific and believable.`],
      ["8–18 sec · DEMONSTRATION", `Introduce ${product}. Show the product/service in use, with clear close-ups and natural creator-style delivery. Explain the benefit: ${benefit}`],
      ["18–25 sec · PROOF / TAKEAWAY", `Summarize what the viewer should understand. Use only truthful, supportable claims and real evidence; do not invent reviews or results.`],
      [`FINAL SCENE · CTA`, `Close warmly: “${cta}.” Keep the product visible and make the next step clear.`]
    ];
    const body = `<p><strong>Product:</strong> ${escapeHTML(product)} · <strong>Audience:</strong> ${escapeHTML(audience)} · <strong>Length:</strong> ${escapeHTML(length)} · <strong>Tone:</strong> ${escapeHTML(tone)}</p>${scenes.map(([title,desc])=>`<h3>${escapeHTML(title)}</h3><p>${escapeHTML(desc)}</p>`).join("")}<h3>Production notes</h3><ul><li>Use vertical 9:16 framing for short-form social ads.</li><li>Add captions and keep spoken lines concise.</li><li>Disclose sponsorships or affiliate relationships when required.</li><li>Only make claims you can substantiate.</li></ul>`;
    outputHTML("#ugcOutput", "UGC ad storyboard", body);
    toast("Ad storyboard created.");
  });

  $("#scriptForm").addEventListener("submit", event => {
    event.preventDefault();
    const topic = $("#scriptTopic").value.trim();
    if (!topic) return;
    const type = $("#scriptType").value, length = $("#scriptLength").value, tone = $("#scriptTone").value, audience = $("#scriptAudience").value.trim() || "a curious general audience";
    const seconds = parseInt(length,10) * (length.includes("minute") ? 60 : 1);
    const wordTarget = Math.round(seconds * 2.3);
    currentScript = `${type.toUpperCase()} SCRIPT DRAFT\nTopic: ${topic}\nAudience: ${audience}\nTarget length: ${length}\nVoice: ${tone}\n\nHOOK\nStart with a clear, specific line that makes the audience curious about ${topic.toLowerCase()}. Promise a useful takeaway without exaggerating what the video can deliver.\n\nINTRODUCTION\nSet up why ${topic.toLowerCase()} matters to ${audience}. Tell viewers what they will understand by the end, then move quickly into the main point.\n\nMAIN POINT 1 — THE CONTEXT\nExplain the core idea in plain language. Give one concrete example, and define any terms a new viewer might not know.\n\nMAIN POINT 2 — THE PRACTICAL DETAIL\nWalk through the most useful part step by step. Use a short story, demonstration, comparison, or example that makes the point memorable. Keep the narration ${tone.toLowerCase()} and avoid repeating the same claim.\n\nMAIN POINT 3 — THE TAKEAWAY\nAddress a likely question or mistake. Explain what the viewer can do next and where uncertainty or limitations remain.\n\nCLOSING\nRecap the main lesson in one or two sentences. Invite the viewer to comment with a relevant question or follow for more content on this topic.\n\nPRODUCTION NOTES\n- Format: ${type}\n- Estimated target: about ${wordTarget} spoken words, depending on delivery pace.\n- Audience: ${audience}\n- Tone: ${tone}\n- Add B-roll or on-screen examples whenever a concept would be clearer visually.\n\nEDITOR NOTE\nThis is a structured starter draft, not a fully researched script. Add verified facts, examples, and your own perspective before publishing.`;
    const body = currentScript.split("\n").map(line => line ? `<p>${escapeHTML(line)}</p>` : "").join("");
    outputHTML("#scriptOutput", "Script draft", body, false);
    $("#scriptOutput").insertAdjacentHTML("beforeend", '<div class="result-actions"><button class="button button-secondary" id="copyScriptResult">Copy script</button><button class="button button-secondary" id="downloadScriptResult">Download .txt</button></div>');
    $("#copyScriptResult").addEventListener("click", () => copyText(currentScript));
    $("#downloadScriptResult").addEventListener("click", () => downloadText("motionstudio-script.txt", currentScript));
    $("#copyScript").disabled = false;
    $("#copyScript").onclick = () => copyText(currentScript);
    toast("Script draft created.");
  });

  function populateVoices() {
    if (!("speechSynthesis" in window)) return;
    const select = $("#voiceSelect"), selected = select.value;
    const voices = window.speechSynthesis.getVoices();
    select.innerHTML = '<option value="">Default browser voice</option>';
    voices.forEach((voice, index) => {
      const option = document.createElement("option");
      option.value = String(index); option.textContent = `${voice.name} (${voice.lang})${voice.default ? " · default" : ""}`;
      select.appendChild(option);
    });
    if (selected) select.value = selected;
  }
  if ("speechSynthesis" in window) {
    populateVoices();
    window.speechSynthesis.addEventListener?.("voiceschanged", populateVoices);
  }
  $("#speakButton").addEventListener("click", () => {
    const text = $("#voiceText").value.trim();
    if (!text) { toast("Enter some text to preview."); return; }
    if (!("speechSynthesis" in window)) { toast("Speech preview is not supported by this browser."); return; }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    const voices = window.speechSynthesis.getVoices();
    const voiceIndex = $("#voiceSelect").value;
    if (voiceIndex !== "" && voices[Number(voiceIndex)]) utterance.voice = voices[Number(voiceIndex)];
    utterance.rate = Number($("#voiceRate").value);
    utterance.pitch = Number($("#voicePitch").value);
    window.speechSynthesis.speak(utterance);
  });
  $("#stopSpeakButton").addEventListener("click", () => { if ("speechSynthesis" in window) window.speechSynthesis.cancel(); });
  function formatSrtTime(totalSeconds) {
    const ms = Math.round((totalSeconds % 1) * 1000);
    const whole = Math.floor(totalSeconds);
    const hours = String(Math.floor(whole / 3600)).padStart(2,"0");
    const minutes = String(Math.floor((whole % 3600) / 60)).padStart(2,"0");
    const seconds = String(whole % 60).padStart(2,"0");
    return `${hours}:${minutes}:${seconds},${String(ms).padStart(3,"0")}`;
  }
  function getCaptionLines() {
    return $("#captionText").value.split(/\r?\n/).map(line => line.trim()).filter(Boolean);
  }
  function refreshCaptionPreview() {
    const lines = getCaptionLines();
    const preview = $("#captionPreview .caption-screen");
    if (!lines.length) preview.innerHTML = '<span>YOUR CAPTIONS</span><p>Add transcript lines to preview how your subtitle file will be structured.</p>';
    else preview.innerHTML = `<span>CAPTION ${1} / ${lines.length}</span><p>${escapeHTML(lines[0])}</p>`;
  }
  $("#captionText").addEventListener("input", refreshCaptionPreview);
  $("#downloadSrt").addEventListener("click", () => {
    const lines = getCaptionLines();
    if (!lines.length) { toast("Paste at least one caption line first."); return; }
    const duration = Number($("#captionSeconds").value);
    const srt = lines.map((line,index) => `${index+1}\n${formatSrtTime(index*duration)} --> ${formatSrtTime((index+1)*duration)}\n${line}`).join("\n\n");
    downloadText("motionstudio-captions.srt", srt, "application/x-subrip;charset=utf-8");
    toast("SRT captions downloaded.");
  });

  function loadPrompts() {
    try { const parsed = JSON.parse(localStorage.getItem(STORAGE_KEYS.prompts) || "[]"); return Array.isArray(parsed) ? parsed : []; }
    catch { return []; }
  }
  function savePrompts(prompts) { localStorage.setItem(STORAGE_KEYS.prompts, JSON.stringify(prompts)); renderPrompts(); }
  function renderPrompts() {
    const prompts = loadPrompts();
    $("#libraryCount").textContent = `${prompts.length} saved ${prompts.length === 1 ? "item" : "items"}`;
    $("#libraryEmpty").classList.toggle("hidden", prompts.length > 0);
    $("#savedPrompts").innerHTML = prompts.map(item => `<article class="saved-card" data-id="${escapeHTML(item.id)}"><span class="saved-type">${escapeHTML(item.type.toUpperCase())}</span><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.text)}</p><div class="saved-actions"><button class="text-button" data-use-prompt="${escapeHTML(item.id)}">Copy prompt</button><button class="text-button" data-delete-prompt="${escapeHTML(item.id)}">Delete</button></div></article>`).join("");
    $$("[data-use-prompt]", $("#savedPrompts")).forEach(button => button.addEventListener("click", () => {
      const item = loadPrompts().find(entry => entry.id === button.dataset.usePrompt);
      if (item) copyText(item.text);
    }));
    $$("[data-delete-prompt]", $("#savedPrompts")).forEach(button => button.addEventListener("click", () => {
      savePrompts(loadPrompts().filter(item => item.id !== button.dataset.deletePrompt));
      toast("Prompt removed.");
    }));
  }
  $("#savePromptForm").addEventListener("submit", event => {
    event.preventDefault();
    const title = $("#savedPromptTitle").value.trim(), text = $("#savedPromptText").value.trim();
    if (!title || !text) return;
    const prompts = loadPrompts();
    prompts.unshift({ id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`, title, text, type:$("#savedPromptType").value, createdAt:new Date().toISOString() });
    savePrompts(prompts);
    event.target.reset();
    toast("Prompt saved to this browser.");
  });
  $("#exportLibrary").addEventListener("click", () => downloadText("motionstudio-prompt-library.json", JSON.stringify(loadPrompts(), null, 2), "application/json;charset=utf-8"));
  renderPrompts();

  function loadSettings() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEYS.settings) || "{}"); } catch { return {}; }
  }
  function applySettings(settings) {
    if (settings.reduceMotion) document.body.classList.add("reduce-motion"); else document.body.classList.remove("reduce-motion");
    if (settings.style) $("#videoStyle").value = settings.style;
    if (settings.ratio) $("#videoRatio").value = settings.ratio;
    $("#settingStyle").value = settings.style || "Cinematic realism";
    $("#settingRatio").value = settings.ratio || "16:9";
    $("#reduceMotion").checked = Boolean(settings.reduceMotion);
  }
  applySettings(loadSettings());
  $("#saveSettings").addEventListener("click", () => {
    const settings = { style:$("#settingStyle").value, ratio:$("#settingRatio").value, reduceMotion:$("#reduceMotion").checked };
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(settings));
    applySettings(settings);
    $("#settingsMessage").textContent = "Settings saved.";
    toast("Studio settings saved.");
    setTimeout(() => $("#settingsMessage").textContent = "", 3000);
  });
  $("#clearData").addEventListener("click", () => {
    if (!window.confirm("Clear saved prompts and studio settings from this browser? This cannot be undone.")) return;
    localStorage.removeItem(STORAGE_KEYS.prompts);
    localStorage.removeItem(STORAGE_KEYS.settings);
    applySettings({});
    renderPrompts();
    $("#settingsMessage").textContent = "Local data cleared.";
    toast("Local data cleared.");
  });


  // Content Calendar: local-first scheduling and exports.
  const calendarDate = $("#calendarDate");
  if (calendarDate) {
    const today = new Date();
    calendarDate.value = `${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,"0")}-${String(today.getDate()).padStart(2,"0")}`;
    function loadCalendar() {
      try { const value = JSON.parse(localStorage.getItem(STORAGE_KEYS.calendar) || "[]"); return Array.isArray(value) ? value : []; }
      catch { return []; }
    }
    function saveCalendar(items) { localStorage.setItem(STORAGE_KEYS.calendar, JSON.stringify(items)); renderCalendar(); }
    function renderCalendar() {
      const all = loadCalendar().sort((a,b) => `${a.date}T${a.time}`.localeCompare(`${b.date}T${b.time}`));
      const status = $("#calendarFilter").value;
      const query = $("#calendarSearch").value.trim().toLowerCase();
      const visible = all.filter(item => (status === "All" || item.status === status) && `${item.title} ${item.platform} ${item.caption} ${item.format}`.toLowerCase().includes(query));
      const published = all.filter(item => item.status === "Published").length;
      const ready = all.filter(item => item.status === "Ready").length;
      const upcoming = all.filter(item => item.status !== "Published" && item.date >= todayString()).length;
      $("#calendarSummary").innerHTML = `<div class="calendar-stat"><span>Planned posts</span><strong>${all.length}</strong></div><div class="calendar-stat"><span>Upcoming</span><strong>${upcoming}</strong></div><div class="calendar-stat"><span>Ready to publish</span><strong>${ready}</strong></div><div class="calendar-stat"><span>Published</span><strong>${published}</strong></div>`;
      $("#calendarCount").textContent = `${all.length} ${all.length === 1 ? "POST" : "POSTS"}`;
      $("#calendarEmpty").classList.toggle("hidden", visible.length > 0);
      $("#calendarPosts").innerHTML = visible.map(item => `<article class="calendar-post"><div class="calendar-post-date"><strong>${escapeHTML(new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined,{day:"2-digit"}))}</strong><span>${escapeHTML(new Date(`${item.date}T12:00:00`).toLocaleDateString(undefined,{month:"short"}))}</span></div><div class="calendar-post-body"><div class="calendar-post-meta"><span>${escapeHTML(item.platform)}</span><span>${escapeHTML(item.time)}</span><span class="calendar-status status-${item.status.toLowerCase().replace(/[^a-z]+/g,"-")}">${escapeHTML(item.status)}</span></div><h3>${escapeHTML(item.title)}</h3><p>${escapeHTML(item.format)}${item.caption ? ` · ${escapeHTML(item.caption)}` : ""}</p><div class="calendar-post-actions"><label class="sr-only" for="status-${escapeHTML(item.id)}">Update status</label><select id="status-${escapeHTML(item.id)}" data-calendar-status="${escapeHTML(item.id)}"><option ${item.status==="Idea"?"selected":""}>Idea</option><option ${item.status==="In production"?"selected":""}>In production</option><option ${item.status==="Ready"?"selected":""}>Ready</option><option ${item.status==="Published"?"selected":""}>Published</option></select><button class="text-button" data-calendar-edit="${escapeHTML(item.id)}">Edit</button><button class="text-button" data-calendar-delete="${escapeHTML(item.id)}">Delete</button></div></div></article>`).join("");
      $$('[data-calendar-status]', $("#calendarPosts")).forEach(control => control.addEventListener("change", () => { const items=loadCalendar(); const item=items.find(entry=>entry.id===control.dataset.calendarStatus); if(item){item.status=control.value;saveCalendar(items);toast("Post status updated.");} }));
      $$('[data-calendar-delete]', $("#calendarPosts")).forEach(button => button.addEventListener("click", () => { const item=loadCalendar().find(entry=>entry.id===button.dataset.calendarDelete); if(item && window.confirm(`Delete “${item.title}” from your calendar?`)){saveCalendar(loadCalendar().filter(entry=>entry.id!==item.id));toast("Post removed from calendar.");} }));
      $$('[data-calendar-edit]', $("#calendarPosts")).forEach(button => button.addEventListener("click", () => { const item=loadCalendar().find(entry=>entry.id===button.dataset.calendarEdit); if(!item)return; $("#calendarTitle").value=item.title; calendarDate.value=item.date; $("#calendarTime").value=item.time; $("#calendarPlatform").value=item.platform; $("#calendarFormat").value=item.format; $("#calendarCaption").value=item.caption; $("#calendarStatus").value=item.status; saveCalendar(loadCalendar().filter(entry=>entry.id!==item.id)); $("#calendarTitle").focus(); toast("Post loaded into the form. Save it to confirm your edits."); }));
    }
    function todayString(){const d=new Date();return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
    $("#calendarForm").addEventListener("submit", event => {
      event.preventDefault();
      const item={id:crypto.randomUUID?crypto.randomUUID():`${Date.now()}-${Math.random().toString(16).slice(2)}`,title:$("#calendarTitle").value.trim(),date:calendarDate.value,time:$("#calendarTime").value,platform:$("#calendarPlatform").value,format:$("#calendarFormat").value,caption:$("#calendarCaption").value.trim(),status:$("#calendarStatus").value,createdAt:new Date().toISOString()};
      if(!item.title||!item.date||!item.time)return;
      const items=loadCalendar();items.push(item);saveCalendar(items);event.target.reset();calendarDate.value=todayString();$("#calendarTime").value="12:00";toast("Post added to your content calendar.");
    });
    $("#calendarFilter").addEventListener("change",renderCalendar);
    $("#calendarSearch").addEventListener("input",renderCalendar);
    $("#exportCalendar").addEventListener("click",()=>{const items=loadCalendar();if(!items.length){toast("Add a post before exporting.");return;}const cols=["title","date","time","platform","format","status","caption"];const csv=[cols.join(","),...items.map(item=>cols.map(key=>`"${String(item[key]||"").replace(/"/g,'""')}"`).join(","))].join("\r\n");downloadText("motionstudio-content-calendar.csv",csv,"text/csv;charset=utf-8");});
    $("#exportCalendarJson").addEventListener("click",()=>downloadText("motionstudio-content-calendar-backup.json",JSON.stringify(loadCalendar(),null,2),"application/json;charset=utf-8"));
    renderCalendar();
  }

  refreshCaptionPreview();
})();