const app = document.querySelector('#app');
const lineDialog = document.querySelector('#line-dialog');
const lineDialogContent = document.querySelector('#line-dialog-content');
const escapeHtml = value => String(value).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const normalize = value => value.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[’`´]/g,"'").toLocaleLowerCase();
const loadJson = path => fetch(path).then(response => {
  if (!response.ok) throw new Error(`${path}: ${response.status}`);
  return response.json();
});

let fi, en, catalog;
try {
  [fi, en, catalog] = await Promise.all([
    loadJson('data/kalevala_fi.json'),
    loadJson('data/kalevala_en.json'),
    loadJson('data/catalog.json'),
  ]);
} catch (error) {
  app.innerHTML = `<section class="empty"><h1>Loading failed</h1><p>${escapeHtml(error.message)}</p></section>`;
  throw error;
}

const packs = {fi, en};
const initial = {
  lang: localStorage.getItem('kalevala-language') || 'fi',
  theme: localStorage.getItem('kalevala-theme') || 'light',
  fontScale: Number(localStorage.getItem('kalevala-font-scale') || 1),
  lineNumbers: localStorage.getItem('kalevala-line-numbers') !== 'false',
  positions: JSON.parse(localStorage.getItem('kalevala-positions') || '{}'),
  favourites: JSON.parse(localStorage.getItem('kalevala-favourites') || '[]'),
  bookmarks: JSON.parse(localStorage.getItem('kalevala-bookmarks') || '{}'),
};
const state = initial;
const corpus = () => packs[state.lang];
const rune = number => corpus().runes[number - 1];
const localized = (object, field) => object[`${state.lang}${field[0].toUpperCase()}${field.slice(1)}`];
const tr = (finnish, english) => state.lang === 'fi' ? finnish : english;
const positionKey = (lang = state.lang) => lang;
const bookmarkKey = (lang, runeNumber, lineIndex) => `${lang}|${runeNumber}|${lineIndex}`;
const save = () => {
  localStorage.setItem('kalevala-language', state.lang);
  localStorage.setItem('kalevala-theme', state.theme);
  localStorage.setItem('kalevala-font-scale', state.fontScale);
  localStorage.setItem('kalevala-line-numbers', state.lineNumbers);
  localStorage.setItem('kalevala-positions', JSON.stringify(state.positions));
  localStorage.setItem('kalevala-favourites', JSON.stringify(state.favourites));
  localStorage.setItem('kalevala-bookmarks', JSON.stringify(state.bookmarks));
};

function applyChrome() {
  document.documentElement.lang = state.lang;
  document.documentElement.classList.toggle('dark', state.theme === 'dark');
  document.documentElement.style.setProperty('--font-scale', state.fontScale);
  document.querySelectorAll('[data-fi]').forEach(node => node.textContent = node.dataset[state.lang]);
  document.querySelector('#language-button').textContent = state.lang === 'fi' ? 'EN' : 'FI';
  document.querySelector('meta[name=theme-color]').content = state.theme === 'dark' ? '#0d1816' : '#173b34';
}

const categoryName = category => ({
  Character: tr('Henkilö','Character'), Place: tr('Paikka','Place'), Object: tr('Esine','Object'),
  Concept: tr('Käsite','Concept'), Word: tr('Vanha sana','Old word'), Symbol: tr('Symboli','Symbol'),
}[category] || category);

let wordIndexLanguage = '';
let wordIndex = new Map();
function rebuildWordIndex() {
  if (wordIndexLanguage === state.lang) return;
  wordIndex = new Map();
  for (const entry of catalog.entries) {
    const forms = [localized(entry,'name'), ...entry.aliases];
    for (const form of forms) {
      const words = form.match(/[\p{L}'’‑-]+/gu) || [];
      if (words.length === 1) wordIndex.set(normalize(words[0]), entry);
    }
  }
  wordIndexLanguage = state.lang;
}
function termsIn(line) {
  rebuildWordIndex();
  const found = new Map();
  for (const token of line.match(/[\p{L}'’‑-]+/gu) || []) {
    const entry = wordIndex.get(normalize(token));
    if (entry && !found.has(entry.id)) found.set(entry.id, {entry, surface: token});
  }
  return [...found.values()];
}
function highlight(line) {
  rebuildWordIndex();
  let cursor = 0, html = '';
  for (const match of line.matchAll(/[\p{L}'’‑-]+/gu)) {
    html += escapeHtml(line.slice(cursor, match.index));
    const token = match[0];
    html += wordIndex.has(normalize(token)) ? `<span class="keyword">${escapeHtml(token)}</span>` : escapeHtml(token);
    cursor = match.index + token.length;
  }
  return html + escapeHtml(line.slice(cursor));
}

function rawSections(runeNumber, language = state.lang) {
  return catalog.sections
    .filter(section => section.rune === runeNumber && (language === 'fi' ? section.fiStart : section.enStart) !== null)
    .map(section => ({...section, start: language === 'fi' ? section.fiStart : section.enStart}))
    .sort((a,b) => a.start - b.start)
    .filter((section,index,list) => index === 0 || section.start !== list[index - 1].start);
}
function materializeSections(runeObject, language = state.lang) {
  const base = rawSections(runeObject.number, language);
  const result = [];
  base.forEach((section,index) => {
    const end = base[index + 1]?.start ?? runeObject.lines.length;
    const length = Math.max(1, end - section.start);
    const chunks = Math.max(1, Math.ceil(length / 180));
    for (let chunk = 0; chunk < chunks; chunk++) {
      const rawStart = section.start + Math.round(length * chunk / chunks);
      const minimum = (result.at(-1)?.start ?? -1) + 1;
      const start = chunk === 0 ? section.start : Math.max(minimum, Math.min(end - 1, Math.floor(rawStart / 2) * 2));
      if (start < end && start > (result.at(-1)?.start ?? -1)) {
        const baseTitle = language === 'fi' ? section.fiTitle : section.enTitle;
        result.push({...section, start, end, title: chunks === 1 ? baseTitle : `${baseTitle} · ${chunk + 1}/${chunks}`});
      }
    }
  });
  return result.map((section,index,list) => ({...section,end:list[index + 1]?.start ?? runeObject.lines.length}));
}

function currentPosition() {
  return state.positions[positionKey()] || {rune: 1, line: 0};
}
function setPosition(runeNumber, line) {
  state.positions[positionKey()] = {rune:runeNumber,line}; save();
}
function sameFavourite(number) { return state.favourites.includes(`${state.lang}|${number}`); }
function toggleFavourite(number) {
  const key = `${state.lang}|${number}`;
  state.favourites = state.favourites.includes(key) ? state.favourites.filter(item => item !== key) : [...state.favourites,key];
  save(); render();
}

function dailyVerse() {
  const epochDay = Math.floor(Date.now() / 86400000);
  const anchor = catalog.daily[((epochDay * 37) % 50 + 50) % 50];
  const selectedRune = rune(anchor.rune);
  const line = state.lang === 'fi' ? anchor.fiLine : anchor.enLine;
  return {anchor,selectedRune,line,text:selectedRune.lines[line]};
}

function homeView() {
  const daily = dailyVerse();
  const current = currentPosition();
  const currentRune = rune(current.rune);
  return `<section class="hero"><div><p class="eyebrow">${tr('Viisikymmentä runoa — aina mukanasi','Fifty runes — always with you')}</p><h1>Kalevala</h1><p class="lead">${tr('Koko vuoden 1849 Kalevala ja John Martin Crawfordin englanninnos. Seuraa kertomusta selkeinä osina ja avaa otsikko nähdäksesi yksityiskohtaisen yhteenvedon.','The complete 1849 Kalevala and John Martin Crawford translation. Follow the story in clear sections and open a heading for a detailed summary.')}</p><div class="actions"><a class="primary" href="#reader/${state.lang}/${current.rune}/${current.line}">${tr(`Jatka: runo ${current.rune}`,`Continue: Rune ${current.rune}`)}</a><a class="secondary" href="#runes">${tr('Kaikki runot','All runes')}</a></div></div><img class="hero-mark" src="icon.svg" alt="Runonlaulajan kädet"></section>
  <section class="card daily"><p class="eyebrow">${tr('Päivän säe','Verse of the day')}</p><p class="verse">“${escapeHtml(daily.text)}”</p><p class="meta">${escapeHtml(daily.selectedRune.title)} · ${tr('säe','line')} ${daily.line + 1}</p><a class="secondary" href="#reader/${state.lang}/${daily.anchor.rune}/${daily.line}">${tr('Avaa runossa','Open in rune')}</a></section>
  <section><div class="heading-row"><div><p class="eyebrow">${tr('Kertomuksen kaaret','Story arcs')}</p><h2>${tr('Kymmenen kokonaisuutta','Ten connected cycles')}</h2></div></div><div class="grid">${catalog.arcs.map(arc => `<a class="arc-card result" href="#reader/${state.lang}/${arc.first}/0"><h3>${escapeHtml(localized(arc,'title'))}</h3><p>${escapeHtml(localized(arc,'summary'))}</p><span class="meta">${arc.first === arc.last ? tr(`Runo ${arc.first}`,`Rune ${arc.first}`) : tr(`Runot ${arc.first}–${arc.last}`,`Runes ${arc.first}–${arc.last}`)}</span></a>`).join('')}</div></section>`;
}

function runeCards(list) {
  const position = currentPosition();
  return list.map(item => {
    const arc = catalog.arcs.find(value => item.number >= value.first && item.number <= value.last);
    const isCurrent = position.rune === item.number;
    const progress = isCurrent ? Math.round(100 * position.line / Math.max(1,item.lines.length)) : 0;
    return `<article class="rune-card" data-open-rune="${item.number}"><button class="star" data-favourite="${item.number}" aria-label="Favourite">${sameFavourite(item.number) ? '★' : '☆'}</button><p class="eyebrow">${tr('Runo','Rune')} ${item.number}</p><h3>${escapeHtml(item.title)}</h3><p class="muted">${escapeHtml(localized(arc,'title'))}<br>${item.lines.length} ${tr('säettä','lines')}</p>${isCurrent ? `<div class="progress" title="${progress}%"><span style="width:${progress}%"></span></div>` : ''}</article>`;
  }).join('');
}
function runesView() {
  return `<div class="heading-row"><div><p class="eyebrow">${tr('Koko teos','Complete work')}</p><h1>${tr('Viisikymmentä runoa','Fifty runes')}</h1></div><p class="muted">${tr('Puhelimella yksi sarake, tabletilla kaksi.','One column on phones, two on tablets.')}</p></div><input class="search-input" id="rune-filter" type="search" placeholder="${tr('Etsi numerolla tai nimellä','Find by number or title')}" aria-label="${tr('Etsi runoa','Find a rune')}"><div class="grid" id="rune-grid">${runeCards(corpus().runes)}</div>`;
}

function readerView(parts) {
  const number = Math.min(50,Math.max(1,Number(parts[2] || 1)));
  const selectedRune = rune(number);
  const initialLine = Math.min(selectedRune.lines.length - 1,Math.max(0,Number(parts[3] || 0)));
  setPosition(number,initialLine);
  const sections = materializeSections(selectedRune);
  let content = '';
  selectedRune.lines.forEach((line,index) => {
    const section = sections.find(value => value.start === index);
    if (section) {
      content += `<details class="section-card" id="section-${index}"><summary><span><span class="eyebrow">${tr('Osa','Part')} ${sections.indexOf(section)+1}/${sections.length} · ${tr('säkeet','lines')} ${index+1}–${section.end}</span><strong>${escapeHtml(section.title)}</strong></span><span aria-hidden="true">⌄</span></summary><p>${escapeHtml(localized(section,'summary'))}</p></details>`;
    }
    const bookmarked = Boolean(state.bookmarks[bookmarkKey(state.lang,number,index)]);
    content += `<div class="line" data-line="${index}"><span class="line-number">${state.lineNumbers ? index+1 : ''}</span><span>${highlight(line)}</span><span class="bookmark-mark">${bookmarked ? '◆' : ''}</span></div>`;
  });
  return `<article class="reader" data-rune="${number}"><header class="reader-head"><p class="eyebrow">${tr('Runo','Rune')} ${number}</p><h1>${escapeHtml(selectedRune.title)}</h1><div class="reader-controls"><button class="secondary" id="switch-reader-language">${state.lang === 'fi' ? 'English' : 'Suomi'}</button><button class="secondary" data-favourite="${number}">${sameFavourite(number) ? '★' : '☆'} ${tr('Suosikki','Favourite')}</button></div></header><div class="section-nav">${sections.map((section,index) => `<a class="chip" href="#section-${section.start}">${index+1}. ${escapeHtml(section.title)}</a>`).join('')}</div><p class="muted">${tr('Värilliset sanat löytyvät Tietäjästä. Valitse säe nähdäksesi vain sen tunnistetut sanat.','Colored terms are in the Guide. Select a line to see only its recognized terms.')}</p><div class="lines">${content}</div><div class="actions"><a class="secondary" href="#reader/${state.lang}/${number-1}/0" ${number===1?'hidden':''}>← ${tr('Edellinen','Previous')}</a><a class="primary" href="#reader/${state.lang}/${number+1}/0" ${number===50?'hidden':''}>${tr('Seuraava','Next')} →</a></div></article>`;
}

function entryCards(entries) {
  return entries.map(entry => `<article class="entry-card"><span class="category">${escapeHtml(categoryName(entry.category))}</span><h3>${escapeHtml(localized(entry,'name'))}</h3><strong>${escapeHtml(localized(entry,'short'))}</strong>${localized(entry,'detail') !== localized(entry,'short') ? `<p>${escapeHtml(localized(entry,'detail'))}</p>` : ''}</article>`).join('');
}
function guideView() {
  return `<div class="heading-row"><div><p class="eyebrow">${tr('Hakemisto','Reference')}</p><h1>${tr('Tietäjä','Guide')}</h1></div><p class="muted">${catalog.entries.length} ${tr('artikkelia','articles')}</p></div><input class="search-input" id="guide-filter" type="search" placeholder="${tr('Etsi henkilöä, paikkaa, käsitettä tai sanaa','Find a character, place, concept, or word')}" aria-label="${tr('Etsi Tietäjästä','Search the Guide')}"><div id="guide-list">${entryCards(catalog.entries)}</div>`;
}
function searchView() {
  return `<p class="eyebrow">${tr('Koko tekstin haku','Full-text search')}</p><h1>${tr('Etsi säkeistä','Search the verses')}</h1><form id="search-form"><input class="search-input" id="text-query" type="search" minlength="2" required placeholder="${tr('Kirjoita vähintään kaksi merkkiä','Enter at least two characters')}"><div class="tabs"><label class="chip"><input type="checkbox" name="fi" checked> Suomi</label><label class="chip"><input type="checkbox" name="en" checked> English</label><button class="primary" type="submit">${tr('Hae','Search')}</button></div></form><div id="search-results" aria-live="polite"></div>`;
}
function savedView() {
  const favourites = state.favourites.filter(key => key.startsWith(`${state.lang}|`)).map(key => Number(key.split('|')[1]));
  const bookmarks = Object.entries(state.bookmarks).filter(([key]) => key.startsWith(`${state.lang}|`));
  return `<p class="eyebrow">${tr('Oma Kalevala','Your Kalevala')}</p><h1>${tr('Tallennetut','Saved')}</h1><section><h2>${tr('Suosikkirunot','Favourite runes')}</h2>${favourites.length ? `<div class="grid">${runeCards(favourites.map(number => rune(number)))}</div>` : `<div class="empty">${tr('Ei suosikkirunoja.','No favourite runes yet.')}</div>`}</section><section><h2>${tr('Kirjanmerkit ja muistiinpanot','Bookmarks and notes')}</h2>${bookmarks.length ? bookmarks.map(([key,value]) => {const [,number,line]=key.split('|');const item=rune(Number(number));return `<a class="entry-card result" href="#reader/${state.lang}/${number}/${line}"><span class="category">${tr('Runo','Rune')} ${number} · ${tr('säe','line')} ${Number(line)+1}</span><p class="verse">“${escapeHtml(item.lines[Number(line)])}”</p>${value.note?`<p>${escapeHtml(value.note)}</p>`:''}</a>`}).join('') : `<div class="empty">${tr('Ei kirjanmerkkejä.','No bookmarks yet.')}</div>`}</section><section class="card"><h2>${tr('Lukuasetukset','Reading settings')}</h2><label class="setting"><span>${tr('Tekstin koko','Text size')} (${Math.round(state.fontScale*100)}%)</span><input id="font-scale" type="range" min="0.8" max="1.5" step="0.1" value="${state.fontScale}"></label><label class="setting"><span>${tr('Näytä säenumerot','Show line numbers')}</span><input id="line-numbers" type="checkbox" ${state.lineNumbers?'checked':''}></label><p class="muted">${tr('Asetukset, lukukohta ja tallennetut kohdat säilyvät vain tällä laitteella.','Settings, reading position, and saved items remain only on this device.')}</p></section>`;
}

function showLine(runeNumber,lineIndex) {
  const selectedRune = rune(runeNumber), line = selectedRune.lines[lineIndex];
  const key = bookmarkKey(state.lang,runeNumber,lineIndex), record = state.bookmarks[key] || {note:''};
  const matches = termsIn(line);
  lineDialogContent.innerHTML = `<p class="eyebrow">${tr('Runo','Rune')} ${runeNumber} · ${tr('säe','line')} ${lineIndex+1}</p><p class="verse">“${escapeHtml(line)}”</p><div class="dialog-actions"><button class="secondary" id="dialog-bookmark">${state.bookmarks[key] ? tr('Poista kirjanmerkki','Remove bookmark') : tr('Tallenna säe','Save line')}</button><button class="secondary" id="copy-line">${tr('Kopioi','Copy')}</button></div><h3>${tr('Tietäjästä löytyvät sanat','Terms found in the Guide')}</h3>${matches.length ? entryCards(matches.map(item => item.entry)) : `<p class="muted">${tr('Tässä säkeessä ei ole Tietäjä-artikkeliin yhdistettyä sanaa.','This line has no term linked to a Guide article.')}</p>`}<label><strong>${tr('Oma muistiinpano','Personal note')}</strong><textarea id="line-note" rows="3">${escapeHtml(record.note || '')}</textarea></label><button class="primary" id="save-note">${tr('Tallenna muistiinpano','Save note')}</button>`;
  lineDialog.showModal();
  document.querySelector('#dialog-bookmark').onclick = () => {state.bookmarks[key] ? delete state.bookmarks[key] : state.bookmarks[key]={note:record.note||''};save();lineDialog.close();render()};
  document.querySelector('#copy-line').onclick = () => navigator.clipboard?.writeText(line);
  document.querySelector('#save-note').onclick = () => {state.bookmarks[key]={note:document.querySelector('#line-note').value};save();lineDialog.close();render()};
}

function switchReaderLanguage(number,lineIndex) {
  const source = rawSections(number,state.lang);
  const sourceSectionIndex = Math.max(0,source.findLastIndex(section => section.start <= lineIndex));
  const sourceSection = source[sourceSectionIndex];
  const sourceStart = sourceSection?.start || 0;
  const sourceEnd = source[sourceSectionIndex+1]?.start || rune(number).lines.length;
  const fraction = (lineIndex-sourceStart)/Math.max(1,sourceEnd-sourceStart);
  const targetLanguage = state.lang === 'fi' ? 'en' : 'fi';
  const targetRune = packs[targetLanguage].runes[number-1];
  const target = rawSections(number,targetLanguage);
  let targetSectionIndex = target.findIndex(section => section.fiStart === sourceSection?.fiStart);
  if (targetSectionIndex < 0) {
    targetSectionIndex = target.findIndex(section => section.fiStart > (sourceSection?.fiStart ?? -1));
    if (targetSectionIndex < 0) targetSectionIndex = target.length - 1;
  }
  const targetSection = target[targetSectionIndex];
  const targetEnd = target[targetSectionIndex+1]?.start || targetRune.lines.length;
  const targetLine = Math.max(0,Math.min(targetRune.lines.length-1,Math.round(targetSection.start+fraction*(targetEnd-targetSection.start))));
  state.lang=targetLanguage;wordIndexLanguage='';save();location.hash=`reader/${targetLanguage}/${number}/${targetLine}`;
}

function bind(route) {
  document.querySelectorAll('[data-favourite]').forEach(button => button.onclick = event => {event.stopPropagation();toggleFavourite(Number(button.dataset.favourite))});
  document.querySelectorAll('[data-open-rune]').forEach(card => card.onclick = event => {if(!event.target.closest('[data-favourite]')) location.hash=`reader/${state.lang}/${card.dataset.openRune}/0`});
  const runeFilter=document.querySelector('#rune-filter');if(runeFilter)runeFilter.oninput=()=>{const q=normalize(runeFilter.value);document.querySelector('#rune-grid').innerHTML=runeCards(corpus().runes.filter(item=>normalize(`${item.number} ${item.title}`).includes(q)));bind(route)};
  const guideFilter=document.querySelector('#guide-filter');if(guideFilter)guideFilter.oninput=()=>{const q=normalize(guideFilter.value);document.querySelector('#guide-list').innerHTML=entryCards(catalog.entries.filter(entry=>normalize([localized(entry,'name'),localized(entry,'short'),localized(entry,'detail'),...entry.aliases].join(' ')).includes(q)))};
  document.querySelectorAll('.line').forEach(node=>node.onclick=()=>showLine(Number(document.querySelector('.reader').dataset.rune),Number(node.dataset.line)));
  const switchButton=document.querySelector('#switch-reader-language');if(switchButton)switchButton.onclick=()=>switchReaderLanguage(Number(route[2]),Number(route[3]||0));
  const searchForm=document.querySelector('#search-form');if(searchForm)searchForm.onsubmit=event=>{event.preventDefault();const q=normalize(document.querySelector('#text-query').value),languages=[...searchForm.querySelectorAll('input[type=checkbox]:checked')].map(x=>x.name),hits=[];for(const language of languages){for(const item of packs[language].runes){item.lines.forEach((line,index)=>{if(hits.length<250&&normalize(line).includes(q))hits.push({language,item,line,index})})}}document.querySelector('#search-results').innerHTML=hits.length?`<p class="meta">${hits.length}${hits.length===250?'+' : ''} ${tr('osumaa','matches')}</p>`+hits.map(hit=>`<a class="entry-card result" href="#reader/${hit.language}/${hit.item.number}/${hit.index}"><span class="category">${hit.language.toUpperCase()} · ${tr('Runo','Rune')} ${hit.item.number} · ${tr('säe','line')} ${hit.index+1}</span><p class="verse">${escapeHtml(hit.line)}</p></a>`).join(''):`<div class="empty">${tr('Ei osumia.','No matches.')}</div>`};
  const fontScale=document.querySelector('#font-scale');if(fontScale)fontScale.oninput=()=>{state.fontScale=Number(fontScale.value);save();applyChrome();fontScale.previousElementSibling.textContent=`${tr('Tekstin koko','Text size')} (${Math.round(state.fontScale*100)}%)`};
  const lineNumbers=document.querySelector('#line-numbers');if(lineNumbers)lineNumbers.onchange=()=>{state.lineNumbers=lineNumbers.checked;save()};
}

function render() {
  const route=(location.hash.slice(1)||'home').split('/');
  if(route[0]==='reader'&&['fi','en'].includes(route[1])&&state.lang!==route[1]){state.lang=route[1];wordIndexLanguage='';save()}
  applyChrome();
  document.querySelectorAll('nav a').forEach(link=>link.classList.toggle('active',link.hash.slice(1)===route[0]));
  app.innerHTML = route[0]==='runes'?runesView():route[0]==='reader'?readerView(route):route[0]==='guide'?guideView():route[0]==='search'?searchView():route[0]==='saved'?savedView():homeView();
  bind(route); app.focus({preventScroll:true});
}

document.querySelector('#language-button').onclick=()=>{state.lang=state.lang==='fi'?'en':'fi';save();wordIndexLanguage='';render()};
document.querySelector('#theme-button').onclick=()=>{state.theme=state.theme==='light'?'dark':'light';save();applyChrome()};
document.querySelector('.dialog-close').onclick=()=>lineDialog.close();
lineDialog.addEventListener('click',event=>{if(event.target===lineDialog)lineDialog.close()});
window.addEventListener('hashchange',render);
applyChrome();render();
if('serviceWorker' in navigator)navigator.serviceWorker.register('sw.js');
