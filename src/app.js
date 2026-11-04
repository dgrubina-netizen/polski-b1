const $ = id => document.getElementById(id);
const exercises = exams.flatMap(exam => exam.exercises.map(exercise => ({...exercise, exam: exam.label, date:exam.date, source:exam.source})));
const mistakes = [];
let mode = 'exam', current = 0;
const normalize = value => value.normalize('NFC').trim().toLocaleLowerCase('pl').replace(/[.!?]+$/, '').trim().replace(/\s+/g, ' ');
function start(which) {
  current = which;
  exercises.forEach((e,i) => {
    $('passage-'+i).hidden = i !== current;
    $('choose-'+i).setAttribute('aria-pressed', String(i === current));
  });
  resetInline(current);
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
  $(`gap-check-${which}`).disabled = overLimit;
}

function resetInline(which) {
  inlineFields(which).forEach(field => {
    field.value = '';
    field.disabled = false;
    field.className = 'inline-answer';
  });
  $(`gap-count-${which}`).hidden = false;
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
  $(`gap-count-${which}`).hidden = true;
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
const order=['I','II','III','IV','V','VI','VII','VIII','IX','X'];
function showCategory(){const value=$('category-select').value;const visible=exercises.map((e,i)=>({e,i})).filter(({e})=>e[mode]===value).sort((a,b)=>a.e.exam===b.e.exam?order.indexOf(a.e.number)-order.indexOf(b.e.number):a.i-b.i);
  exercises.forEach((e,i)=>{$('choose-'+i).hidden=true});
  visible.forEach(({e,i})=>{const button=$('choose-'+i);button.hidden=false;button.textContent=mode==='topic'?`${e.exam} · задание ${e.number}`:`${e.number} · ${e.topic}`;$('exercise-list').append(button)});
  if(visible.length)start(visible[0].i);
}
function setMode(next){mode=next;$('mode-exam').setAttribute('aria-pressed',String(mode==='exam'));$('mode-topic').setAttribute('aria-pressed',String(mode==='topic'));const caption=mode==='exam'?'Выберите экзамен':'Выберите тему';$('category-label').textContent=caption;const select=$('category-select');select.setAttribute('aria-label',caption);select.replaceChildren();[...new Set(exercises.map(e=>e[mode]))].forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)});showCategory()}
$('mode-exam').addEventListener('click',()=>setMode('exam'));$('mode-topic').addEventListener('click',()=>setMode('topic'));$('category-select').addEventListener('change',showCategory);
exercises.forEach((e, i) => {
  $('choose-'+i).addEventListener('click', () => start(i));
  inlineFields(i).forEach((field, j) => {
    field.addEventListener(e.questions[j].answers ? 'input' : 'change', () => updateInlineProgress(i));
  });
  $(`gap-check-${i}`).addEventListener('click', () => checkInline(i));
  $(`gap-restart-${i}`).addEventListener('click', () => start(i));
});
setMode('exam');
