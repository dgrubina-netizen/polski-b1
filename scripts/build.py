from pathlib import Path
from collections import Counter
import json,html,re,sys,base64
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
        first_options = x['questions'][0].get('options')
        if first_options and all(q.get('options') == first_options for q in x['questions']):
            limits = Counter(x.get('wordBank', first_options))
            expected = Counter(q['options'][q['answer']] for q in x['questions'])
            assert set(limits) == set(first_options) and not expected - limits, x['id']
            x['choiceLimits'] = limits
if '--require-complete' in sys.argv:
    sources_check=json.loads((root/'data/sources.json').read_text(encoding='utf-8'))
    missing=[e['label'] for e in sources_check if not any(x['source']==e['source'] for x in exams)]
    assert not missing, f'Missing exams: {missing}'
    required={'I':10,'II':5,'III':5,'IV':10,'V':5,'VI':5,'VII':10,'VIII':5}
    for e in exams:
        if not re.search(r'dim',e['source'],re.I):
            assert {x['number']:len(x['questions']) for x in e['exercises']}==required, f'Incomplete adult exam: {e["label"]}'
esc=lambda s:html.escape(str(s),quote=True)

def answer_field(question, exercise_index, number):
    attrs = f'class="inline-answer" id="gap-{exercise_index}-{number}" aria-label="Пропуск {number}"'
    if question.get('manualReview'):
        return f'<textarea {attrs} lang="pl" rows="2" placeholder="Ответ {number}"></textarea>'
    if question.get('answers'):
        return f'<input {attrs} type="text" lang="pl" autocomplete="off" placeholder="Ответ {number}">'
    options = ''.join(f'<option value="{i}">{esc(option)}</option>' for i, option in enumerate(question['options']))
    return f'<select {attrs}><option value="">{number} · …</option>{options}</select>'

def inline_passage(exercise, fields):
    if exercise['topic'] in ('Вопросительные слова', 'Преобразование предложений'):
        return None
    passage = exercise['passage']
    for number, (question, field) in enumerate(zip(exercise['questions'], fields), 1):
        circle = chr(0x245f + number)
        patterns = [
            rf'<span class="blank">{circle}</span>|{circle}',
            rf'\[{number}\]|〔{number}〕',
            rf'[._…]{{3,}}\s*(?:<sup>\s*)?{number}(?!\d)(?:\s*</sup>)?',
        ]
        if question.get('options'):
            choices = r',\s*'.join(re.escape(option) for option in question['options'])
            patterns.append(rf'\({choices}\)\s*{number}(?!\d)')
        passage, count = re.subn('|'.join(patterns), lambda _: f' {field} ', passage)
        if count != 1:
            return None
    return passage

def prompt_fields(exercise, fields):
    items = []
    for question, field in zip(exercise['questions'], fields):
        prompt = esc(question['sentence'])
        if '___' in prompt and not question.get('manualReview'):
            prompt = prompt.replace('___', f' {field} ', 1)
        else:
            prompt += f' <div class="prompt-answer">{field}</div>'
        items.append(f'<li lang="pl">{prompt}</li>')
    context = f'<details class="original-context" open><summary>Исходный текст задания</summary><div lang="pl">{exercise["passage"]}</div></details>'
    return context + '<ol class="prompt-fields">' + ''.join(items) + '</ol>'

parts=[(root/'src/head.html').read_text(encoding='utf-8'),'''<nav class="mode-navigation" aria-label="Раздел приложения"><button type="button" id="show-grammar" aria-controls="grammar-mode" aria-pressed="true">Грамматика</button><button type="button" id="show-practice" aria-controls="practice-mode" aria-pressed="false">Samodzielna praktyka</button></nav><div id="grammar-mode"><div class="browse-controls">
    <label class="browse-category">Экзамен<select id="exam-filter"></select></label>
    <label class="browse-category">Тема<select id="topic-filter"></select></label>
</div>
<p class="muted" id="no-exercises" role="status" hidden>Нет заданий для этого экзамена и темы. Попробуйте изменить фильтры.</p>
<nav id="exercise-navigation" class="exercise-navigation" aria-label="Переход между заданиями" hidden>
    <button id="previous-exercise" type="button">← Предыдущее задание</button>
    <button id="next-exercise" type="button">Следующее задание →</button>
</nav>''']
flat=[(e,x) for e in exams for x in e['exercises']]
questions=sum(len(x['questions']) for _,x in flat)
for i, (e, x) in enumerate(flat):
    fields = [answer_field(q, i, n) for n, q in enumerate(x['questions'], 1)]
    passage = inline_passage(x, fields) or prompt_fields(x, fields)
    instructions = '<p class="muted">Заполняй поля в любом порядке. Пропуски можно оставить пустыми.</p>'
    limits = x.get('choiceLimits')
    if limits:
        words = ' · '.join(esc(word) + (f' ×{count}' if count > 1 else '') for word, count in limits.items())
        instructions += f'<div class="word-bank"><span>Слова из рамки</span><span lang="pl">{words}</span></div>'
    controls = (f'<div class="inline-controls"><div class="check-row" id="gap-check-row-{i}">'
                f'<div class="check-progress"><p class="muted" id="gap-count-{i}"></p>'
                f'<progress id="gap-progress-{i}" value="0" max="{len(fields)}" aria-label="Заполнено пропусков"></progress></div>'
                f'<button class="button" type="button" id="gap-check-{i}"><span aria-hidden="true">✓</span> Проверить</button></div>'
                f'<div id="gap-result-{i}" class="inline-results" role="status" aria-live="polite" hidden></div>'
                f'<button class="button" type="button" id="gap-restart-{i}" hidden>Пройти ещё раз</button></div>')
    note = f'<p>{esc(e["note"])}</p>' if e.get("note") else ''
    parts.append(
        f'<article class="card" id="passage-{i}" hidden>'
        f'<div class="exam-meta"><span>{esc(e["label"])}</span><span>Задание {esc(x["number"])}</span></div>'
        f'<h2 id="exercise-title-{i}" tabindex="-1">{esc(x.get("title",x["topic"]))}</h2>{instructions}'
        f'<div class="passage">{passage}</div>{controls}<hr class="divider">'
        f'<div class="source"><a href="{esc(e["source"])}" target="_blank" rel="noopener noreferrer">Оригинальный экзамен ↗</a>{note}'
        '<p>Материал Государственной комиссии по подтверждению знания польского языка. Ответы подготовлены для учебной проверки.</p></div>'
        f'<div id="exercise-nav-slot-{i}"></div></article>'
    )
parts.append('<div class="error-export"><button type="button" id="download-errors" disabled>Скачать ошибки · 0</button><span>Ошибки хранятся до закрытия или обновления страницы.</span></div>')
sources=json.loads((root/'data/sources.json').read_text(encoding='utf-8'))
parts.append(f'<details class="catalog"><summary>Все опубликованные экзамены B1 · {len(sources)} источников</summary>'
             f'<p class="muted">Варианты: {len(exams)} · Задания: {len(flat)} · Вопросы: {questions}.</p><ul>')
for item in sources:
    e=next((e for e in exams if e['source']==item['source']),None)
    status=f'В квизе: {len(e["exercises"])} заданий' if e else 'В квиз ещё не добавлен'
    parts.append(f'<li><a href="{esc(item["source"])}" target="_blank" rel="noopener noreferrer">{esc(item["label"])} ↗</a><span>{status}</span></li>')
parts.append('</ul></details></div>')
parts.append('''<section class="practice" id="practice-mode" lang="pl" hidden>
  <div class="browse-controls">
    <label class="browse-category">Temat ćwiczeń
      <select id="practice-topic-select">
        <option value="practice-housing">Dom i mieszkanie</option>
        <option value="practice-health">Zdrowie i sport</option>
      </select>
    </label>
  </div>''')
for topic in ('housing', 'health'):
    practice = (root/f'src/practice-{topic}.html').read_text(encoding='utf-8-sig')
    for photo_path in sorted((root/'data').glob(f'{topic}-photo*.jpeg')):
        placeholder = '__' + photo_path.stem.upper().replace('-', '_') + '__'
        image = base64.b64encode(photo_path.read_bytes()).decode('ascii')
        practice = practice.replace(placeholder, 'data:image/jpeg;base64,' + image)
    assert not re.search(r'__[A-Z_]+PHOTO(?:_\d+)?__', practice), f'Missing photo in {topic}'
    parts.append(practice)
parts.append('</section></main></div>')
payload=json.dumps(exams,ensure_ascii=False).replace('</','<\\/')
parts.append('<script>\nconst exams='+payload+';\n'+(root/'src/app.js').read_text(encoding='utf-8-sig')+'\n</script></body></html>')
output='\n'.join(parts).replace('</style>','[hidden]{display:none!important}</style>')
(root/'index.html').write_text(output,encoding='utf-8');(root/'data/coverage.json').write_text(json.dumps(dict(exams=len(exams),exercises=len(flat),questions=questions,missing=[i['label'] for i in sources if not any(e['source']==i['source'] for e in exams)]),ensure_ascii=False,indent=2),encoding='utf-8')
print(f'Built {len(exams)} exams, {len(flat)} exercises, {questions} questions')
