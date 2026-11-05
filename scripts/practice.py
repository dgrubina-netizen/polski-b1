"""Render the authored speaking practice bank into the standalone trainer."""

from html import escape
from pathlib import Path
import base64
import json


TOPIC_IDS = (
    "people", "work", "travel", "food", "culture", "education", "society",
)
SOURCES = {
    "edu": "materiałów Edu&More",
    "setka": "„Setki na mówienie”",
    "dialogs": "„100 dialogów na poziomie B1”",
}
SECTIONS = (
    ("words", "Zwroty"), ("reading", "Przykłady"), ("photo", "Zdjęcie"),
    ("monologue", "Monolog"), ("dialogue", "Dialog"), ("check", "Samokontrola"),
)


def load_topics(root):
    return {
        key: json.loads((root / "data" / f"practice-{key}.json").read_text(encoding="utf-8-sig"))
        for key in TOPIC_IDS
    }


def source_line(task, kind):
    page = task["page"]
    source = task["source"]
    prefix = "Fotografia z " if kind == "photo" else "Polecenie na podstawie "
    reference = SOURCES[source]
    if source == "edu":
        tens, ones = divmod(page - 3, 10)
        roman = ("", "X", "XX", "XXX", "XL")[tens] + ("", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX")[ones]
        reference += f", zestaw {roman}"
    elif source == "setka":
        reference += f", zestaw {page - 40}"
    return f'<p class="source">{escape(prefix + reference)}, s. {page} PDF.</p>'


def render_task(root, task, kind, number):
    open_first = " open" if number == 1 else ""
    image = ""
    if kind == "photo":
        photo_path = root / "data" / "practice-photos" / f'edu-{task["page"]}.jpeg'
        encoded = base64.b64encode(photo_path.read_bytes()).decode("ascii")
        image = f'\n        <img class="practice-photo" src="data:image/jpeg;base64,{encoded}" alt="{escape(task["alt"])}">'
    answers = task["answer"]
    if kind == "dialogue":
        lines = []
        for turn in answers:
            role, line = turn.split(": ", 1)
            lines.append(f"<strong>{escape(role)}:</strong> {escape(line)}")
        answer_html = "<p>" + "<br>\n".join(lines) + "</p>"
    else:
        answer_html = "".join(f"<p>{escape(paragraph)}</p>" for paragraph in answers)
    return f'''
      <details class="task-option"{open_first}>
        <summary>{number} · {escape(task["title"])}</summary>{image}
        <p>{escape(task["prompt"])}</p>
        {source_line(task, kind)}
        <p><strong>Plan:</strong> {escape(task["plan"])}</p>
        <details class="answer-example">
          <summary>Przykładowa odpowiedź</summary>
          {answer_html}
        </details>
      </details>'''


def render_topic(root: Path, key, topic):
    title = escape(topic["title"])
    nav = "".join(f'<a href="#{key}-{section}">{label}</a>' for section, label in SECTIONS)
    parts = [f'''
    <section class="practice-topic" id="practice-{key}" hidden>
      <div class="practice-intro">
        <p class="cover-kicker">Mówienie · B1</p><h2>{title}</h2>
        <p>{escape(topic["intro"])}</p>
      </div>
      <nav class="practice-index" aria-label="Części tematu">{nav}</nav>
      <section class="practice-block" id="{key}-words">
        <p class="practice-label">01 / Słownictwo</p><h2>Słowa i przydatne zwroty</h2>
        <dl class="phrase-list">''']
    for phrase, translation in topic["phrases"]:
        parts.append(f'<div><dt>{escape(phrase)}</dt><dd lang="ru">{escape(translation)}</dd></div>')
    parts.append(f'''
        </dl>
        <p class="source">Zwroty i plany odpowiedzi opracowane z wykorzystaniem „Setki na mówienie”, s. 3–5 i 11–30 PDF.</p>
      </section>
      <section class="practice-block" id="{key}-reading">
        <p class="practice-label">02 / Czytanie</p><h2>Teksty do czytania</h2>
        <p class="muted">Teksty opracowane do ćwiczeń.</p>''')
    for heading, body, translation in topic["reading"]:
        parts.append(f'''<article class="reading">
          <h3>{escape(heading)}</h3><p>{escape(body)}</p>
          <details><summary>Tłumaczenie</summary><p lang="ru">{escape(translation)}</p></details>
        </article>''')
    parts.append("</section>")
    for number, (kind, heading) in enumerate(
        (("photo", "Opisz fotografię"), ("monologue", "Tematy monologów"), ("dialogue", "Sytuacje do dialogu")), 3
    ):
        tasks = topic[kind]
        if len(tasks) != 3:
            raise ValueError(f"{key}: expected three {kind} tasks")
        parts.append(f'''<section class="practice-block" id="{key}-{kind}">
          <p class="practice-label">0{number} / {heading}</p><h2>{heading}</h2>''')
        parts.extend(render_task(root, task, kind, i) for i, task in enumerate(tasks, 1))
        parts.append("</section>")
    parts.append(f'''
      <section class="practice-block" id="{key}-check">
        <p class="practice-label">06 / Samokontrola</p><h2>Sprawdź się</h2>
        <div class="self-check">
          <label><input type="checkbox"> W opisie zdjęcia podaję szczegóły i zaznaczam przypuszczenia.</label>
          <label><input type="checkbox"> W monologu realizuję polecenie i rozwijam odpowiedź przykładem.</label>
          <label><input type="checkbox"> W dialogu reaguję na rozmówcę i dążę do celu.</label>
          <label><input type="checkbox"> Po odpowiedzi porównuję ją z przykładem i wybieram zwrot do powtórzenia.</label>
        </div>
        <p class="source">Przykładowe odpowiedzi to autorskie teksty do ćwiczeń.</p>
      </section>
    </section>''')
    return "\n".join(parts)
