(() => {
  "use strict";
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const STORAGE_KEYS = { prompts: "motionstudio.prompts.v1", settings: "motionstudio.settings.v1", calendar: "motionstudio.calendar.v1", projects: "motionstudio.projects.v1" };
  const viewNames = { repurpose:"Content Repurposer", overview:"Overview", video:"AI Video Studio", shorts:"Viral Shorts Planner", image:"Image & Motion", ugc:"UGC & Ad Studio", script:"Scriptwriter", captions:"Voice & Captions", projects:"Project Dashboard", calendar:"Content Calendar", assets:"Media Asset Library", brand:"Brand Kit", library:"Prompt Library", settings:"Studio settings" };
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


  // Project Dashboard: local-first project tracking, editing, and JSON backup.
  const projectForm = $("#projectForm");
  if (projectForm) {
    const projectStatusOptions = ["Idea", "In progress", "Review", "Completed"];
    const projectTypeView = { "Video":"video", "Shorts":"shorts", "Image":"image", "UGC / Ad":"ugc", "Script":"script", "Campaign":"calendar", "Other":"overview" };
    function loadProjects() {
      try { const data = JSON.parse(localStorage.getItem(STORAGE_KEYS.projects) || "[]"); return Array.isArray(data) ? data.filter(item => item && item.id && item.title) : []; }
      catch { return []; }
    }
    function saveProjects(items) { localStorage.setItem(STORAGE_KEYS.projects, JSON.stringify(items)); renderProjects(); }
    function resetProjectForm() {
      projectForm.reset(); $("#projectId").value = ""; $("#projectFormHeading").textContent = "Create a project";
      $("#saveProjectButton").innerHTML = 'Save project <span>＋</span>'; $("#cancelProjectEdit").classList.add("hidden");
    }
    function renderProjects() {
      const all = loadProjects().sort((a,b) => (b.updatedAt || b.createdAt || "").localeCompare(a.updatedAt || a.createdAt || ""));
      const filter = $("#projectFilter").value;
      const query = $("#projectSearch").value.trim().toLowerCase();
      const visible = all.filter(item => (filter === "All projects" || item.status === filter) && `${item.title} ${item.type} ${item.description}`.toLowerCase().includes(query));
      const countBy = status => all.filter(item => item.status === status).length;
      $("#projectSummary").innerHTML = `<div class="project-stat"><span>Total projects</span><strong>${all.length}</strong></div><div class="project-stat"><span>In progress</span><strong>${countBy("In progress")}</strong></div><div class="project-stat"><span>In review</span><strong>${countBy("Review")}</strong></div><div class="project-stat"><span>Completed</span><strong>${countBy("Completed")}</strong></div>`;
      $("#projectGrid").innerHTML = visible.map(item => {
        const statusClass = item.status.toLowerCase().replace(/[^a-z]+/g,"-");
        const due = item.dueDate ? `Target ${new Date(`${item.dueDate}T12:00:00`).toLocaleDateString(undefined,{month:"short",day:"numeric",year:"numeric"})}` : "No target date";
        return `<article class="project-card"><div class="project-card-top"><span class="project-type">${escapeHTML(item.type || "Other")}</span><span class="project-status status-${escapeHTML(statusClass)}">${escapeHTML(item.status || "Idea")}</span></div><h3>${escapeHTML(item.title)}</h3><p class="project-description">${escapeHTML(item.description || "No notes added yet.")}</p><div class="project-due">◷ ${escapeHTML(due)}</div><div class="project-card-actions"><button class="button button-primary button-small" type="button" data-project-open="${escapeHTML(item.id)}">Open studio ↗</button><button class="text-button" type="button" data-project-edit="${escapeHTML(item.id)}">Edit</button><button class="text-button" type="button" data-project-delete="${escapeHTML(item.id)}">Delete</button></div></article>`;
      }).join("");
      $("#projectEmpty").classList.toggle("hidden", visible.length > 0);
      if (!all.length) { $("#projectEmpty h3").textContent = "Your project space is ready"; $("#projectEmpty p").textContent = "Create a project to keep its goal, type, target date, and status together."; }
      else if (!visible.length) { $("#projectEmpty h3").textContent = "No matching projects"; $("#projectEmpty p").textContent = "Try another search or choose a different status filter."; }
      $$('[data-project-open]', $("#projectGrid")).forEach(button => button.addEventListener("click", () => { const item = loadProjects().find(p => p.id === button.dataset.projectOpen); if (item) { showView(projectTypeView[item.type] || "overview"); toast(`Opened ${item.type} studio for “${item.title}”.`); } }));
      $$('[data-project-edit]', $("#projectGrid")).forEach(button => button.addEventListener("click", () => { const item = loadProjects().find(p => p.id === button.dataset.projectEdit); if (!item) return; $("#projectId").value=item.id; $("#projectTitle").value=item.title; $("#projectType").value=item.type || "Other"; $("#projectStatus").value=item.status || "Idea"; $("#projectDue").value=item.dueDate || ""; $("#projectDescription").value=item.description || ""; $("#projectFormHeading").textContent="Edit project"; $("#saveProjectButton").textContent="Update project"; $("#cancelProjectEdit").classList.remove("hidden"); $("#projectTitle").focus(); }));
      $$('[data-project-delete]', $("#projectGrid")).forEach(button => button.addEventListener("click", () => { const item=loadProjects().find(p=>p.id===button.dataset.projectDelete); if(item && window.confirm(`Delete project “${item.title}”?`)){saveProjects(loadProjects().filter(p=>p.id!==item.id));toast("Project deleted.");} }));
    }
    projectForm.addEventListener("submit", event => {
      event.preventDefault();
      const id = $("#projectId").value;
      const existing = loadProjects();
      const old = existing.find(item => item.id === id);
      const item = { id: id || (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`), title: $("#projectTitle").value.trim(), type: $("#projectType").value, status: $("#projectStatus").value, dueDate: $("#projectDue").value, description: $("#projectDescription").value.trim(), createdAt: old?.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString() };
      if (!item.title) return;
      const next = id ? existing.map(project => project.id === id ? item : project) : [item, ...existing];
      saveProjects(next); resetProjectForm(); toast(id ? "Project updated." : "Project created.");
    });
    $("#cancelProjectEdit").addEventListener("click", resetProjectForm);
    $("#projectSearch").addEventListener("input", renderProjects);
    $("#projectFilter").addEventListener("change", renderProjects);
    $("#exportProjects").addEventListener("click", () => { const items=loadProjects(); if(!items.length){toast("Create a project before exporting.");return;} downloadText("motionstudio-projects-backup.json", JSON.stringify(items,null,2), "application/json;charset=utf-8"); });
    $("#importProjectsButton").addEventListener("click", () => $("#importProjectsFile").click());
    $("#importProjectsFile").addEventListener("change", async event => {
      const file=event.target.files && event.target.files[0]; if(!file)return;
      try { const parsed=JSON.parse(await file.text()); if(!Array.isArray(parsed) || parsed.some(item=>!item || typeof item.title!=="string")) throw new Error("Invalid format"); const current=loadProjects(); const normalized=parsed.map(item=>({id:item.id || `${Date.now()}-${Math.random().toString(16).slice(2)}`,title:item.title.slice(0,100),type:["Video","Shorts","Image","UGC / Ad","Script","Campaign","Other"].includes(item.type)?item.type:"Other",status:projectStatusOptions.includes(item.status)?item.status:"Idea",dueDate:typeof item.dueDate==="string"?item.dueDate:"",description:typeof item.description==="string"?item.description.slice(0,1200):"",createdAt:item.createdAt || new Date().toISOString(),updatedAt:item.updatedAt || new Date().toISOString()})); const merged=[...current]; normalized.forEach(item=>{const index=merged.findIndex(old=>old.id===item.id);if(index>=0)merged[index]=item;else merged.push(item);}); saveProjects(merged); toast(`Imported ${normalized.length} project${normalized.length===1?"":"s"}.`); }
      catch { toast("That file isn't a valid MotionStudio project backup."); }
      event.target.value="";
    });
    renderProjects();
  }

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

  // Media Asset Library — browser-local organizer with JSON export.
  const ASSET_KEY = "motionstudio.assets.v1";
  let assets = loadAssets();
  function loadAssets() {
    try {
      const value = JSON.parse(localStorage.getItem(ASSET_KEY) || "[]");
      return Array.isArray(value) ? value : [];
    } catch { return []; }
  }
  function saveAssets() {
    try {
      localStorage.setItem(ASSET_KEY, JSON.stringify(assets));
      return true;
    } catch {
      toast("Browser storage is full. Try a smaller file or save a web link instead.");
      return false;
    }
  }
  function assetTypeLabel(type) {
    return ({image:"Image",video:"Video",audio:"Audio",thumbnail:"Thumbnail",document:"Document",other:"Other"})[type] || "Other";
  }
  function renderAssets() {
    const query = ($("#assetSearch")?.value || "").trim().toLowerCase();
    const filter = $("#assetFilter")?.value || "all";
    const list = assets.filter(item => (filter === "all" || item.type === filter) &&
      [item.name,item.project,item.tags,item.notes,item.type].join(" ").toLowerCase().includes(query));
    $("#assetCount").textContent = assets.length;
    $("#assetImageCount").textContent = assets.filter(item => ["image","thumbnail"].includes(item.type)).length;
    $("#assetMediaCount").textContent = assets.filter(item => ["video","audio"].includes(item.type)).length;
    const grid = $("#assetGrid");
    if (!list.length) {
      grid.innerHTML = `<div class="empty-state"><h3>${assets.length ? "No matching assets" : "Your library is empty"}</h3><p>${assets.length ? "Try another search or filter." : "Add your first asset using the form above."}</p></div>`;
      return;
    }
    grid.innerHTML = list.map(item => {
      const preview = item.dataUrl && item.type !== "video" && item.type !== "audio"
        ? `<img src="${item.dataUrl}" alt="${escapeHTML(item.name)} preview">`
        : item.dataUrl && item.type === "video"
          ? `<video src="${item.dataUrl}" controls preload="metadata"></video>`
          : ({image:"▧",thumbnail:"▣",video:"▶",audio:"♫",document:"▤",other:"◇"})[item.type] || "◇";
      const tags = (item.tags || "").split(",").map(tag => tag.trim()).filter(Boolean).map(tag => `<span class="asset-tag">${escapeHTML(tag)}</span>`).join("");
      const link = safeUrl(item.url);
      return `<article class="asset-card"><div class="asset-preview">${preview}</div><div class="asset-card-body"><h3>${escapeHTML(item.name)}</h3><p class="asset-meta">${escapeHTML(assetTypeLabel(item.type))}${item.project ? " · " + escapeHTML(item.project) : ""}</p><div class="asset-tags">${tags}</div>${item.notes ? `<p class="asset-notes">${escapeHTML(item.notes)}</p>` : ""}${link ? `<a class="asset-url" href="${escapeHTML(link)}" target="_blank" rel="noopener noreferrer">Open linked asset ↗</a>` : ""}<div class="asset-actions"><button class="button button-secondary" data-asset-edit="${item.id}">Edit</button><button class="button button-secondary" data-asset-copy="${item.id}">Copy details</button><button class="button button-danger" data-asset-delete="${item.id}">Delete</button></div></div></article>`;
    }).join("");
    grid.querySelectorAll("[data-asset-delete]").forEach(button => button.addEventListener("click", () => {
      const item = assets.find(asset => asset.id === button.dataset.assetDelete);
      if (!item || !confirm(`Delete "${item.name}" from your library?`)) return;
      assets = assets.filter(asset => asset.id !== item.id);
      saveAssets(); renderAssets(); toast("Asset deleted.");
    }));
    grid.querySelectorAll("[data-asset-copy]").forEach(button => button.addEventListener("click", () => {
      const item = assets.find(asset => asset.id === button.dataset.assetCopy);
      if (item) copyText(`Name: ${item.name}\nType: ${assetTypeLabel(item.type)}\nProject: ${item.project || ""}\nTags: ${item.tags || ""}\nURL: ${item.url || ""}\nNotes: ${item.notes || ""}`);
    }));
    grid.querySelectorAll("[data-asset-edit]").forEach(button => button.addEventListener("click", () => {
      const item = assets.find(asset => asset.id === button.dataset.assetEdit);
      if (!item) return;
      $("#assetName").value = item.name; $("#assetType").value = item.type;
      $("#assetProject").value = item.project || ""; $("#assetTags").value = item.tags || "";
      $("#assetUrl").value = item.url || ""; $("#assetNotes").value = item.notes || "";
      $("#assetForm").dataset.editing = item.id;
      $("#assetForm").scrollIntoView({behavior:"smooth",block:"start"});
      toast("Edit the fields, then save the asset.");
    }));
  }
  const assetForm = $("#assetForm");
  if (assetForm) {
    assetForm.addEventListener("submit", async event => {
      event.preventDefault();
      const name = $("#assetName").value.trim();
      if (!name) return;
      const file = $("#assetFile").files[0];
      let dataUrl = "";
      if (file) {
        if (file.size > 2 * 1024 * 1024) {
          toast("That file is over 2 MB. Save a cloud link instead to avoid filling browser storage.");
          return;
        }
        dataUrl = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ""));
          reader.onerror = () => reject(new Error("Could not read selected file."));
          reader.readAsDataURL(file);
        }).catch(() => "");
      }
      const editingId = assetForm.dataset.editing;
      const previous = editingId ? assets.find(item => item.id === editingId) : null;
      const entry = {
        id: editingId || (typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : String(Date.now()) + Math.random().toString(16).slice(2)),
        name, type:$("#assetType").value, project:$("#assetProject").value.trim(),
        tags:$("#assetTags").value.trim(), url:safeUrl($("#assetUrl").value.trim()),
        notes:$("#assetNotes").value.trim(), dataUrl:dataUrl || (previous ? previous.dataUrl : ""),
        fileName:file ? file.name : (previous ? previous.fileName : ""),
        updatedAt:new Date().toISOString(), createdAt:previous ? previous.createdAt : new Date().toISOString()
      };
      if (editingId) assets = assets.map(item => item.id === editingId ? entry : item);
      else assets.unshift(entry);
      if (saveAssets()) {
        delete assetForm.dataset.editing;
        assetForm.reset(); renderAssets(); toast(editingId ? "Asset updated." : "Asset saved.");
      }
    });
    assetForm.addEventListener("reset", () => { delete assetForm.dataset.editing; });
    $("#assetSearch").addEventListener("input", renderAssets);
    $("#assetFilter").addEventListener("change", renderAssets);
    $("#assetExport").addEventListener("click", () => {
      downloadText("motionstudio-media-assets.json", JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),assets}, null, 2), "application/json;charset=utf-8");
      toast("Media library exported.");
    });
    renderAssets();
  }

  // Brand Kit — saved in this browser, with JSON export and a reusable text brief.
  const BRAND_KEY = "motionstudio.brand.v1";
  const brandFields = ["Name","Tagline","Logo","Font","Primary","Accent","Audience","Voice","Message","Guidelines"];
  function readBrandForm() {
    return {
      name:$("#brandName").value.trim(), tagline:$("#brandTagline").value.trim(),
      logo:safeUrl($("#brandLogo").value.trim()), font:$("#brandFont").value.trim(),
      primary:validHex($("#brandPrimaryText").value, "#7048e8"),
      accent:validHex($("#brandAccentText").value, "#16b8d4"),
      audience:$("#brandAudience").value.trim(), voice:$("#brandVoice").value.trim(),
      message:$("#brandMessage").value.trim(), guidelines:$("#brandGuidelines").value.trim(),
      updatedAt:new Date().toISOString()
    };
  }
  function validHex(value, fallback) { return /^#[0-9a-fA-F]{6}$/.test(value) ? value : fallback; }
  function updateBrandPreview(data) {
    $("#brandSwatchPrimary").style.background = data.primary || "#7048e8";
    $("#brandSwatchAccent").style.background = data.accent || "#16b8d4";
    $("#brandPreviewName").textContent = data.name || "Your brand name";
    $("#brandPreviewTagline").textContent = data.tagline || "Your tagline will appear here.";
    $("#brandPreviewFont").textContent = "Font: " + (data.font || "not set");
  }
  function fillBrandForm(data) {
    const mapping = {name:"brandName",tagline:"brandTagline",logo:"brandLogo",font:"brandFont",primary:"brandPrimaryText",accent:"brandAccentText",audience:"brandAudience",voice:"brandVoice",message:"brandMessage",guidelines:"brandGuidelines"};
    Object.entries(mapping).forEach(([key,id]) => { if (data[key] != null) $("#"+id).value = data[key]; });
    $("#brandPrimary").value = validHex(data.primary, "#7048e8");
    $("#brandAccent").value = validHex(data.accent, "#16b8d4");
    updateBrandPreview(data);
  }
  const brandForm = $("#brandForm");
  if (brandForm) {
    let savedBrand = {};
    try { savedBrand = JSON.parse(localStorage.getItem(BRAND_KEY) || "{}") || {}; } catch {}
    fillBrandForm(savedBrand);
    [["brandPrimary","brandPrimaryText"],["brandAccent","brandAccentText"]].forEach(([picker,text]) => {
      $("#"+picker).addEventListener("input", () => { $("#"+text).value = $("#"+picker).value; updateBrandPreview(readBrandForm()); });
      $("#"+text).addEventListener("input", () => {
        if (/^#[0-9a-fA-F]{6}$/.test($("#"+text).value)) { $("#"+picker).value = $("#"+text).value; updateBrandPreview(readBrandForm()); }
      });
    });
    brandForm.addEventListener("submit", event => {
      event.preventDefault();
      const data = readBrandForm();
      try {
        localStorage.setItem(BRAND_KEY, JSON.stringify(data));
        savedBrand = data; fillBrandForm(data); toast("Brand Kit saved on this device.");
      } catch { toast("Could not save. Browser storage may be unavailable."); }
    });
    brandForm.addEventListener("reset", () => {
      setTimeout(() => { fillBrandForm({primary:"#7048e8",accent:"#16b8d4"}); }, 0);
    });
    $("#brandExport").addEventListener("click", () => {
      const data = JSON.parse(localStorage.getItem(BRAND_KEY) || "{}");
      downloadText("motionstudio-brand-kit.json", JSON.stringify({schemaVersion:1,exportedAt:new Date().toISOString(),brand:data},null,2), "application/json;charset=utf-8");
      toast("Brand Kit exported.");
    });
    $("#brandCopy").addEventListener("click", () => {
      const data = JSON.parse(localStorage.getItem(BRAND_KEY) || "{}");
      const brief = `BRAND BRIEF\nName: ${data.name || ""}\nTagline: ${data.tagline || ""}\nWebsite/logo: ${data.logo || ""}\nPrimary color: ${data.primary || ""}\nAccent color: ${data.accent || ""}\nFont: ${data.font || ""}\nAudience: ${data.audience || ""}\nBrand voice: ${data.voice || ""}\nKey message: ${data.message || ""}\nGuidelines: ${data.guidelines || ""}`;
      copyText(brief);
    });
  }


  // Version 7: browser-based content repurposing drafts.
  const repurposeForm = $("#repurposeForm");
  let repurposeDrafts = [];
  function sentenceChunks(text) {
    return text.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map(s => s.trim()).filter(s => s.length > 25);
  }
  function makeHook(sentence, tone, index) {
    const clean = sentence.replace(/^[\s\-•\d.)]+/, "").trim();
    const short = clean.length > 135 ? clean.slice(0, 132).replace(/\s+\S*$/, "") + "…" : clean;
    const hooks = {
      Curious: [`Most people overlook this: ${short}`, `What if ${short.charAt(0).toLowerCase()+short.slice(1)}`, `Here's the surprising part: ${short}`],
      Educational: [`Here's a lesson worth remembering: ${short}`, `Try this simple idea: ${short}`, `One useful takeaway: ${short}`],
      Energetic: [`Stop scrolling—this matters: ${short}`, `Save this tip: ${short}`, `Let's make this simple: ${short}`],
      Storytelling: [`It started with one idea: ${short}`, `Here's the moment things clicked: ${short}`, `The lesson I wish I'd known: ${short}`]
    };
    return hooks[tone][index % hooks[tone].length];
  }
  function makeRepurposeDrafts(source, title, platform, count, tone, length) {
    const sentences = sentenceChunks(source);
    const chunks = sentences.length ? sentences : source.split(/\n+/).map(x=>x.trim()).filter(x=>x.length>20);
    const fallback = source.replace(/\s+/g," ").trim();
    const picks = chunks.length ? chunks : [fallback];
    const drafts = [];
    for(let i=0;i<count;i++){
      const base = picks[i % picks.length];
      const second = picks[(i+1) % picks.length];
      const hook = makeHook(base, tone, i);
      const body = base.length > 260 ? base.slice(0,257).replace(/\s+\S*$/,"")+"…" : base;
      const wrap = second && second !== base ? `\n\nKey point: ${second.length>220?second.slice(0,217)+"…":second}` : "";
      const call = ["Follow for more practical takeaways.","Save this for later.","Share this with someone who needs it.","What would you add? Tell me below."][i%4];
      const clipTitle = (title ? title + ": " : "") + base.split(/[.!?]/)[0].slice(0,65).trim();
      drafts.push({number:i+1,platform,length,title:clipTitle || `Short-form idea ${i+1}`,hook,script:`${hook}\n\n${body}${wrap}\n\n${call}`,caption:`${hook}\n\n${call}`,hashtags:"#CreatorTips #ContentCreation #Shorts",source:base});
    }
    return drafts;
  }
  function renderRepurposeDrafts(drafts) {
    const output=$("#repurposeOutput");
    output.innerHTML=drafts.map(d=>`<article class="repurpose-card">
      <div class="repurpose-card-top"><h3>Draft ${d.number} · ${escapeHTML(d.platform)}</h3><span class="nav-tag">${escapeHTML(d.length)}</span></div>
      <div class="draft-label">Suggested title</div><p class="draft-title">${escapeHTML(d.title)}</p>
      <div class="draft-label">Opening hook</div><p>${escapeHTML(d.hook)}</p>
      <div class="draft-label">Script outline</div><p>${escapeHTML(d.script)}</p>
      <div class="draft-label">Caption & hashtags</div><p>${escapeHTML(d.caption)}\n${escapeHTML(d.hashtags)}</p>
      <div class="repurpose-actions"><button class="button button-secondary" type="button" data-copy-draft="${d.number-1}">Copy draft</button></div>
    </article>`).join("");
    $("#repurposeStatus").textContent=`${drafts.length} draft${drafts.length===1?"":"s"} created · review and customize before posting.`;
    $("#repurposeExport").disabled=!drafts.length;
  }
  if(repurposeForm){
    repurposeForm.addEventListener("submit",event=>{
      event.preventDefault();
      const source=$("#repurposeSource").value.trim();
      if(!source){toast("Paste a transcript or notes first.");return;}
      repurposeDrafts=makeRepurposeDrafts(source,$("#repurposeTitle").value.trim(),$("#repurposePlatform").value,Number($("#repurposeCount").value),$("#repurposeTone").value,$("#repurposeLength").value);
      renderRepurposeDrafts(repurposeDrafts);
      toast("Short-form drafts created. Review before publishing.");
    });
    $("#repurposeOutput").addEventListener("click",event=>{
      const button=event.target.closest("[data-copy-draft]");
      if(button){const d=repurposeDrafts[Number(button.dataset.copyDraft)];if(d)copyText(`TITLE: ${d.title}\n\nSCRIPT:\n${d.script}\n\nCAPTION:\n${d.caption}\n${d.hashtags}`);}
    });
    $("#repurposeExport").addEventListener("click",()=>{
      if(!repurposeDrafts.length)return;
      const text=repurposeDrafts.map(d=>`DRAFT ${d.number}\nPLATFORM: ${d.platform}\nDURATION: ${d.length}\nTITLE: ${d.title}\n\nSCRIPT:\n${d.script}\n\nCAPTION:\n${d.caption}\n${d.hashtags}`).join("\n\n"+"=".repeat(48)+"\n\n");
      downloadText("motionstudio-repurposed-content.txt",text);
    });
  }

})();
// MotionStudio AI backend connection test
(async function testMotionStudioBackend() {
  const API_BASE_URL = "https://motionstudio-ai-backend.onrender.com";

  try {
    const response = await fetch(`${API_BASE_URL}/api/health`);
    const data = await response.json();

    console.log("MotionStudio AI backend:", data);
  } catch (error) {
    console.error("MotionStudio AI backend connection failed:", error);
  }
})();
