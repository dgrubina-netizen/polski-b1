const $ = id => document.getElementById(id);
const exercises = exams.flatMap(exam => exam.exercises.map(exercise => ({...exercise, exam: exam.label, date:exam.date, source:exam.source})));
const mistakes = [];
let mode = 'exam', current = 0, index = 0, score = 0, checked = false;
const normalize = value => value.normalize('NFC').trim().toLocaleLowerCase('pl').replace(/[.!?]+$/, '').trim().replace(/\s+/g, ' ');
function start(which) {
  current = which; index = 0; score = 0; checked = false;
  $('finish').hidden = true; $('quiz').hidden = false;
  exercises.forEach((e,i) => {
    $('passage-'+i).hidden = i !== current;
    $('choose-'+i).setAttribute('aria-pressed', String(i === current));
  });
  render();
}
function render() {
  const e = exercises[current], q = e.questions[index]; checked = false;
  $('counter').textContent = `${index+1} / ${e.questions.length}`;
  $('fill').style.width = `${index/e.questions.length*100}%`;
  $('number').textContent = `Задание ${e.number} · пропуск ${index+1}`;
  $('question').textContent = q.sentence;
  $('answer-instruction').textContent = q.answers ? 'Впишите ответ по-польски.' : 'Выберите правильную форму.';
  $('options').replaceChildren();
  if (q.answers) {
    const input = document.createElement('input'); input.type='text'; input.name='answer-text'; input.className='answer-input'; input.autocomplete='off'; input.setAttribute('aria-label','Ваш ответ на польском'); input.placeholder='Ваш ответ';
    input.addEventListener('input',()=>{$('action').disabled=!input.value.trim()}); $('options').append(input);
  } else q.options.forEach((value,i)=>{
    const label=document.createElement('label');label.className='option';
    const input=document.createElement('input');input.type='radio';input.name='answer';input.value=String(i);input.addEventListener('change',()=>{$('action').disabled=false});
    const span=document.createElement('span');span.textContent=value;label.append(input,span);$('options').append(label);
  });
  $('feedback').className='feedback';$('feedback').hidden=true;$('feedback').replaceChildren();$('action').disabled=true;$('action').textContent='Проверить ответ';
}
$('form').addEventListener('submit',event=>{
  event.preventDefault();const e=exercises[current];
  if(checked){index++;if(index===e.questions.length){$('quiz').hidden=true;$('finish').hidden=false;$('result').textContent=`Правильных ответов: ${score} из ${e.questions.length}.`;}else render();return}
  const q=e.questions[index],input=$('form').querySelector(q.answers?'input[name="answer-text"]':'input[name="answer"]:checked');
  if(!input||!String(input.value).trim())return;
  const correct=q.answers?q.answers.some(a=>normalize(a)===normalize(input.value)):Number(input.value)===q.answer;
  let mistake;
  if(!correct){mistake={exam:e.date||e.exam,source:e.source,exercise:e.number,question:index+1,context:q.sentence,answer:q.answers?input.value:q.options[Number(input.value)],expected:q.answers?q.answers.join(' / '):q.options[q.answer],explanation:q.explain,manualReview:!!q.manualReview,selfAccepted:false};mistakes.push(mistake);updateErrorCount()}
  if(correct)score++;checked=true;$('form').querySelectorAll('input').forEach(i=>{i.disabled=true});
  const fb=$('feedback');fb.hidden=false;fb.className=correct?'feedback':'feedback wrong';
  const heading=document.createElement('strong');heading.textContent=correct?'Верно!':q.manualReview?`Автоматически не распознано. Возможный вариант: ${q.answers[0]}`:`Пока неверно. Правильный ответ: ${q.answers?q.answers.join(' / '):q.options[q.answer]}`;
  const explanation=document.createElement('div');explanation.textContent=q.explain;fb.append(heading,explanation);
  if(q.manualReview&&!correct){const button=document.createElement('button');button.type='button';button.textContent='Мой вариант тоже верный';button.addEventListener('click',()=>{if(mistake.selfAccepted)return;score++;mistake.selfAccepted=true;button.disabled=true;button.textContent='Зачтено по вашей оценке'});fb.append(button)}
  $('action').textContent=index===e.questions.length-1?'Посмотреть результат':'Следующий вопрос';
});
function updateErrorCount(){const b=$('download-errors');b.disabled=!mistakes.length;b.textContent=`Скачать ошибки · ${mistakes.length}`}
function buildErrorReport(){return ['ОШИБКИ И ОТВЕТЫ ДЛЯ ОБСУЖДЕНИЯ','Польский язык B1','Ответы и объяснения подготовлены для учебной проверки.','',...mistakes.flatMap((m,i)=>[`${i+1}. Экзамен ${m.exam}, задание ${m.exercise}, пропуск ${m.question}`,`Источник: ${m.source}`,`Контекст: ${m.context}`,`Мой ответ: ${m.answer}`,`${m.manualReview?'Возможный вариант':'Правильный ответ'}: ${m.expected}`,`Объяснение: ${m.explanation}`,m.manualReview?(m.selfAccepted?'Статус: засчитано пользователем.':'Статус: требуется самостоятельная проверка.'):'Статус: ответ не совпал с проверкой.',''])].join('\n')}
$('download-errors').addEventListener('click',()=>{if(!mistakes.length)return;const url=URL.createObjectURL(new Blob(['\ufeff',buildErrorReport()],{type:'text/plain;charset=utf-8'}));const link=document.createElement('a');link.href=url;link.download='polski-b1-oshibki.txt';document.body.append(link);link.click();link.remove();setTimeout(()=>URL.revokeObjectURL(url),1000)});
const order=['I','II','III','IV','V','VI','VII','VIII','IX','X'];
function showCategory(){const value=$('category-select').value;const visible=exercises.map((e,i)=>({e,i})).filter(({e})=>e[mode]===value).sort((a,b)=>a.e.exam===b.e.exam?order.indexOf(a.e.number)-order.indexOf(b.e.number):a.i-b.i);
  exercises.forEach((e,i)=>{$('choose-'+i).hidden=true});
  visible.forEach(({e,i})=>{const button=$('choose-'+i);button.hidden=false;button.textContent=mode==='topic'?`${e.exam} · задание ${e.number}`:`${e.number} · ${e.topic}`;$('exercise-list').append(button)});
  if(visible.length)start(visible[0].i);
}
function setMode(next){mode=next;$('mode-exam').setAttribute('aria-pressed',String(mode==='exam'));$('mode-topic').setAttribute('aria-pressed',String(mode==='topic'));const caption=mode==='exam'?'Выберите экзамен':'Выберите тему';$('category-label').textContent=caption;const select=$('category-select');select.setAttribute('aria-label',caption);select.replaceChildren();[...new Set(exercises.map(e=>e[mode]))].forEach(value=>{const option=document.createElement('option');option.value=value;option.textContent=value;select.append(option)});showCategory()}
$('mode-exam').addEventListener('click',()=>setMode('exam'));$('mode-topic').addEventListener('click',()=>setMode('topic'));$('category-select').addEventListener('change',showCategory);
exercises.forEach((e,i)=>$('choose-'+i).addEventListener('click',()=>start(i)));$('restart').addEventListener('click',()=>start(current));setMode('exam');
