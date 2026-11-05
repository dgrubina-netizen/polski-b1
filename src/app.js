const $ = id => document.getElementById(id);
const paletteSelect = $('palette-select');
const paletteStorageKey = 'polski-b1-palette';
try {
  const savedPalette = localStorage.getItem(paletteStorageKey);
  if (savedPalette) {
    const defaultPalette = paletteSelect.value;
    paletteSelect.value = savedPalette;
    if (!paletteSelect.value) paletteSelect.value = defaultPalette;
  }
} catch {
  // The trainer also runs when browser storage is unavailable.
}
$('trainer').setAttribute('data-palette', paletteSelect.value);
paletteSelect.addEventListener('change', () => {
  $('trainer').setAttribute('data-palette', paletteSelect.value);
  try {
    localStorage.setItem(paletteStorageKey, paletteSelect.value);
  } catch {
    // The choice still applies for the current page.
  }
});

const exercises = exams.flatMap(exam => exam.exercises.map(exercise => ({...exercise, exam: exam.label, date:exam.date, source:exam.source})));
const mistakes = [];
let current = null;
let matchingExercises = [];
const normalize = value => value.normalize('NFC').trim().toLocaleLowerCase('pl').replace(/[.!?]+$/, '').trim().replace(/\s+/g, ' ');
function start(which) {
  if (current !== null) $('passage-'+current).hidden = true;
  current = which;
  $('passage-'+current).hidden = false;
  resetInline(current);
  updateNavigation();
}

function inlineFields(which) {
  return exercises[which].questions.map((_, i) => $(`gap-${which}-${i+1}`));
}

function updateInlineProgress(which) {
  const exercise = exercises[which];
  const fields = inlineFields(which);
  const filled = fields.filter(field => field.value.trim() !== '').length;
  const limits = exercise.choiceLimits;
  let overLimit = false;
  if (limits) {
    const used = new Map();
    const selections = fields.map((field, i) => field.value === '' ? null : exercise.questions[i].options[Number(field.value)]);
    for (const word of selections) {
      if (word === null) continue;
      used.set(word, (used.get(word) || 0) + 1);
      if (used.get(word) > limits[word]) overLimit = true;
    }
    fields.forEach((field, i) => {
      for (const option of field.options) {
        if (option.value === '') continue;
        const word = exercise.questions[i].options[Number(option.value)];
        option.disabled = word !== selections[i] && (used.get(word) || 0) >= limits[word];
      }
    });
  }
  $(`gap-count-${which}`).textContent = `Заполнено ${filled} из ${fields.length}`;
  $(`gap-progress-${which}`).value = filled;
  $(`gap-check-${which}`).disabled = overLimit;
}

function resetInline(which) {
  inlineFields(which).forEach(field => {
    field.value = '';
    field.disabled = false;
    field.className = 'inline-answer';
  });
  $(`gap-check-row-${which}`).hidden = false;
  $(`gap-check-${which}`).hidden = false;
  const result = $(`gap-result-${which}`);
  result.hidden = true;
  result.replaceChildren();
  $(`gap-restart-${which}`).hidden = true;
  updateInlineProgress(which);
}

function checkInline(which) {
  const button = $(`gap-check-${which}`);
  if (which !== current || button.disabled || button.hidden) return;
  const exercise = exercises[which];
  const result = $(`gap-result-${which}`);
  const summary = document.createElement('h3');
  const review = document.createElement('ol');
  let correctCount = 0;
  let skippedCount = 0;
  const updateSummary = () => {
    const skipped = skippedCount ? `, пропущено ${skippedCount}` : '';
    summary.textContent = `Правильных ответов: ${correctCount} из ${exercise.questions.length}${skipped}.`;
  };

  inlineFields(which).forEach((field, i) => {
    const question = exercise.questions[i];
    const value = field.value.trim();
    const skipped = value === '';
    const choice = Number(value);
    const selected = skipped || question.answers ? value : question.options[choice];
    const expected = question.answers ? question.answers.join(' / ') : question.options[question.answer];
    const correct = !skipped && (question.answers
      ? question.answers.some(answer => normalize(answer) === normalize(selected))
      : choice === question.answer);
    field.disabled = true;
    if (correct) field.className = 'inline-answer correct';
    else if (skipped) field.className = 'inline-answer skipped';
    else if (!question.manualReview) field.className = 'inline-answer wrong';
    const item = document.createElement('li');
    const label = document.createElement('strong');
    if (correct) {
      correctCount++;
      label.className = 'correct-answer';
      label.textContent = `✓ ${selected} — верно`;
      item.append(label);
    } else {
      label.className = skipped || question.manualReview ? 'muted' : 'wrong-answer';
      if (skipped) {
        skippedCount++;
        label.textContent = 'Пропущено';
      } else {
        label.textContent = question.manualReview ? `Требуется сверка: ${selected}` : `Ошибка: ${selected}`;
      }
      const correction = document.createElement('span');
      correction.className = question.manualReview ? '' : 'correct-answer';
      correction.textContent = `${question.manualReview ? 'Возможный вариант' : 'Правильный ответ'}: ${expected}`;
      const explanation = document.createElement('p');
      explanation.textContent = question.explain;
      item.append(label, correction, explanation);
      const mistake = recordMistake(exercise, i, selected, expected, skipped);
      if (question.manualReview && !skipped) {
        const accept = document.createElement('button');
        accept.type = 'button';
        accept.className = 'accept-answer';
        accept.textContent = 'Мой вариант тоже верный';
        accept.addEventListener('click', () => {
          if (mistake.selfAccepted) return;
          mistake.selfAccepted = true;
          correctCount++;
          updateSummary();
          field.className = 'inline-answer correct';
          label.className = 'correct-answer';
          label.textContent = `✓ ${selected} — зачтено по вашей оценке`;
          accept.hidden = true;
        });
        item.append(accept);
      }
    }
    review.append(item);
  });

  updateSummary();
  result.replaceChildren();
  result.append(summary, review);
  result.hidden = false;
  button.hidden = true;
  $(`gap-check-row-${which}`).hidden = true;
  $(`gap-restart-${which}`).hidden = false;
}
function recordMistake(exercise, index, answer, expected, skipped) {
  const question = exercise.questions[index];
  const mistake = {
    exam: exercise.date || exercise.exam, source: exercise.source, exercise: exercise.number,
    question: index+1, context: question.sentence, answer, expected,
    explanation: question.explain, manualReview: !!question.manualReview, selfAccepted: false, skipped,
  };
  mistakes.push(mistake);
  updateErrorCount();
  return mistake;
}
function updateErrorCount(){const b=$('download-errors');b.disabled=!mistakes.length;b.textContent=`Скачать ошибки · ${mistakes.length}`}
function buildErrorReport() {
  const entries = mistakes.flatMap((mistake, i) => {
    let status = 'Ответ не совпал с проверкой';
    if (mistake.skipped) status = 'Пропущено';
    else if (mistake.selfAccepted) status = 'Засчитано пользователем';
    else if (mistake.manualReview) status = 'Требуется самостоятельная проверка';
    return [
      `${i+1}. Экзамен ${mistake.exam}, задание ${mistake.exercise}, пропуск ${mistake.question}`,
      `Источник: ${mistake.source}`,
      `Контекст: ${mistake.context}`,
      `Мой ответ: ${mistake.skipped ? 'Пропущено' : mistake.answer}`,
      `${mistake.manualReview ? 'Возможный вариант' : 'Правильный ответ'}: ${mistake.expected}`,
      `Объяснение: ${mistake.explanation}`,
      `Статус: ${status}`,
      '',
    ];
  });
  return ['ОШИБКИ И ОТВЕТЫ ДЛЯ ОБСУЖДЕНИЯ', 'Польский язык B1',
    'Ответы и объяснения подготовлены для учебной проверки.', '', ...entries].join('\n');
}
$('download-errors').addEventListener('click',()=>{if(!mistakes.length)return;const url=URL.createObjectURL(new Blob(['\ufeff',buildErrorReport()],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='polski-b1-oshibki.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});
const order = ['I','II','III','IV','V','VI','VII','VIII','IX','X'];
function updateNavigation() {
  const navigation = $('exercise-navigation');
  const position = matchingExercises.indexOf(current);
  navigation.hidden = position === -1 || matchingExercises.length < 2;
  if (navigation.hidden) return;
  $(`exercise-nav-slot-${current}`).append(navigation);
  $('previous-exercise').disabled = position === 0;
  $('next-exercise').disabled = position === matchingExercises.length - 1;
}

function moveExercise(offset) {
  const position = matchingExercises.indexOf(current);
  const next = matchingExercises[position + offset];
  if (position < 0 || next === undefined) return;
  start(next);
  $(`exercise-title-${next}`).focus();
}

function filterExercises() {
  const exam = $('exam-filter').value;
  const topic = $('topic-filter').value;
  matchingExercises = exercises.map((exercise, i) => ({exercise, i}))
    .filter(({exercise}) => (!exam || exercise.exam === exam) && (!topic || exercise.topic === topic))
    .sort((a, b) => a.exercise.exam === b.exercise.exam
      ? order.indexOf(a.exercise.number) - order.indexOf(b.exercise.number) : a.i - b.i)
    .map(({i}) => i);

  $('no-exercises').hidden = matchingExercises.length !== 0;
  if (!matchingExercises.length) {
    if (current !== null) {
      $('passage-'+current).hidden = true;
      current = null;
    }
  } else if (!matchingExercises.includes(current)) {
    start(matchingExercises[0]);
  }
  updateNavigation();
}

function populateFilter(id, key, allLabel, initialValue) {
  const select = $(id);
  const values = [...new Set(exercises.map(exercise => exercise[key]))];
  for (const value of ['', ...values]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = value || allLabel;
    select.append(option);
  }
  select.value = initialValue;
  select.addEventListener('change', filterExercises);
}

exercises.forEach((e, i) => {
  inlineFields(i).forEach((field, j) => {
    field.addEventListener(e.questions[j].answers ? 'input' : 'change', () => updateInlineProgress(i));
  });
  $(`gap-check-${i}`).addEventListener('click', () => checkInline(i));
  $(`gap-restart-${i}`).addEventListener('click', () => start(i));
});
$('previous-exercise').addEventListener('click', () => moveExercise(-1));
$('next-exercise').addEventListener('click', () => moveExercise(1));
populateFilter('exam-filter', 'exam', 'Все экзамены', exercises[0].exam);
populateFilter('topic-filter', 'topic', 'Все темы', '');
filterExercises();

// Switching modes preserves the current grammar exercise and its answers.
function showMode(practice) {
  $('cover-mode').textContent = practice ? 'Самопрактика · B1' : 'Грамматика · B1';
  $('grammar-mode').hidden = practice;
  $('practice-mode').hidden = !practice;
  $('show-grammar').setAttribute('aria-pressed', String(!practice));
  $('show-practice').setAttribute('aria-pressed', String(practice));
}
$('show-grammar').addEventListener('click', () => showMode(false));
$('show-practice').addEventListener('click', () => showMode(true));
