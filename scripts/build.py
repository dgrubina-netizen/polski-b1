from pathlib import Path
import json,html,re,sys
root=Path(__file__).resolve().parent.parent
exams=json.loads((root/'data/legacy.json').read_text(encoding='utf-8'))
for path in sorted((root/'data').glob('content-*.json')):
    incoming=json.loads(path.read_text(encoding='utf-8-sig'))
    if isinstance(incoming,dict):incoming=incoming.get('exams',[])
    for new in incoming:
        old=next((e for e in exams if e['source']==new['source']),None)
        if old:
            by_num={e['number']:e for e in old['exercises']}
            by_num.update({e['number']:e for e in new['exercises']})
            old.update({k:v for k,v in new.items() if k!='exercises'});old['exercises']=list(by_num.values())
        else:exams.append(new)
source_order={e['source']:i for i,e in enumerate(json.loads((root/'data/sources.json').read_text(encoding='utf-8')))}
exams.sort(key=lambda e:source_order.get(e['source'],999))
for e in exams:
    assert e['source'].startswith('https://certyfikatpolski.pl/')
    assert e['exercises']
    for x in e['exercises']:
        assert x['questions'] and x['passage'] and x['topic']
        for q in x['questions']:
            assert q['sentence'] and q['explain']
            assert q.get('answers') or (q.get('options') and 0<=q['answer']<len(q['options']))
if '--require-complete' in sys.argv:
    sources_check=json.loads((root/'data/sources.json').read_text(encoding='utf-8'))
    missing=[e['label'] for e in sources_check if not any(x['source']==e['source'] for x in exams)]
    assert not missing, f'Missing exams: {missing}'
    required={'I':10,'II':5,'III':5,'IV':10,'V':5,'VI':5,'VII':10,'VIII':5}
    for e in exams:
        if not re.search(r'dim',e['source'],re.I):
            assert {x['number']:len(x['questions']) for x in e['exercises']}==required, f'Incomplete adult exam: {e["label"]}'
esc=lambda s:html.escape(str(s),quote=True)
parts=[(root/'src/head.html').read_text(encoding='utf-8'),'''<div class="browse-controls"><div class="browse-modes" role="group" aria-label="Способ выбора"><button type="button" id="mode-exam" aria-pressed="true">По экзамену</button><button type="button" id="mode-topic" aria-pressed="false">По теме</button></div><label class="browse-category"><span id="category-label">Выберите экзамен</span><select id="category-select" aria-label="Выберите экзамен"></select></label></div><nav id="exercise-list" class="exercise-select" aria-label="Выбор задания">''']
flat=[(e,x) for e in exams for x in e['exercises']]
for i,(e,x) in enumerate(flat):parts.append(f'<button type="button" id="choose-{i}" aria-pressed="false">{esc(e["label"])} · {esc(x["number"])}</button>')
parts.append('</nav><div class="error-export"><button type="button" id="download-errors" disabled>Скачать ошибки · 0</button><span>Ошибки хранятся до закрытия или обновления страницы.</span></div>')
questions=sum(len(x['questions']) for _,x in flat)
parts.append(f'<p class="muted">Варианты: {len(exams)} · Задания: {len(flat)} · Вопросы: {questions}.</p><div class="grid"><div>')
for i,(e,x) in enumerate(flat):parts.append(f'<article class="card" id="passage-{i}" hidden><div class="exam"><div class="label">{esc(e["label"])}</div><span class="pill">B1 · задание {esc(x["number"])}</span></div><h2>{esc(x.get("title",x["topic"]))}</h2><div class="passage">{x["passage"]}</div><hr class="divider"><div class="source"><a href="{esc(e["source"])}" target="_blank" rel="noopener noreferrer">Оригинальный экзамен ↗</a><br>{esc(e.get("note",""))}<br>Материал Государственной комиссии по подтверждению знания польского языка. Ответы подготовлены для учебной проверки.</div></article>')
parts.append('''</div><section class="card" aria-label="Практика"><div id="quiz"><div class="progress-top"><span class="label">Ваше задание</span><span class="counter" id="counter"></span></div><div class="track"><div class="fill" id="fill"></div></div><div class="eyebrow" id="number"></div><h2 class="question" id="question"></h2><p class="muted" id="answer-instruction"></p><form id="form"><div class="options" id="options"></div><div id="feedback" class="feedback" role="status" aria-live="polite" hidden></div><button class="button" id="action" type="submit" disabled>Проверить ответ</button></form></div><div id="finish" hidden aria-live="polite"><div class="eyebrow">Задание завершено</div><h2>Практика завершена</h2><p class="muted" id="result"></p><button class="button" id="restart" type="button">Пройти ещё раз</button></div></section></div>''')
sources=json.loads((root/'data/sources.json').read_text(encoding='utf-8'));parts.append(f'<details class="catalog"><summary>Все опубликованные экзамены B1 · {len(sources)} источников</summary><ul>')
for item in sources:
    e=next((e for e in exams if e['source']==item['source']),None)
    status=f'В квизе: {len(e["exercises"])} заданий' if e else 'В квиз ещё не добавлен'
    parts.append(f'<li><a href="{esc(item["source"])}" target="_blank" rel="noopener noreferrer">{esc(item["label"])} ↗</a><span>{status}</span></li>')
parts.append('</ul></details><div class="footer">Маленькие шаги каждый день · Powodzenia!</div></main>')
payload=json.dumps(exams,ensure_ascii=False).replace('</','<\\/')
parts.append('<script>\nconst exams='+payload+';\n'+(root/'src/app.js').read_text(encoding='utf-8-sig')+'\n</script></body></html>')
output='\n'.join(parts).replace('</style>','[hidden]{display:none!important}</style>')
(root/'index.html').write_text(output,encoding='utf-8');(root/'data/coverage.json').write_text(json.dumps(dict(exams=len(exams),exercises=len(flat),questions=questions,missing=[i['label'] for i in sources if not any(e['source']==i['source'] for e in exams)]),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Built {len(exams)} exams, {len(flat)} exercises, {questions} questions')
