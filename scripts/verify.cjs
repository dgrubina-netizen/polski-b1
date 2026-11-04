const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
class Element{constructor(){this.children=[];this.style={};this.listeners={};this.value='';this.disabled=false;this.hidden=false;this.attrs={}}setAttribute(k,v){this.attrs[k]=v}addEventListener(t,f){this.listeners[t]=f}append(...nodes){for(const n of nodes){const i=this.children.indexOf(n);if(i>=0)this.children.splice(i,1);this.children.push(n)}if(this.isSelect&&this.children.length===1)this.value=nodes[0].value}replaceChildren(){this.children=[];if(this.isSelect)this.value=''}querySelector(){return this.selected}querySelectorAll(){return []}click(){this.clicked=true}focus(){this.focused=true}remove(){}}
const els={},document={body:new Element(),getElementById(id){const e=els[id] ||=new Element();if(id==='category-select')e.isSelect=true;return e},createElement(){return new Element()}};
let downloaded;const URL={createObjectURL(blob){downloaded=blob;return 'blob:test'},revokeObjectURL(){}};class Blob{constructor(parts){this.parts=parts}}
const state=new Function('document','URL','Blob','setTimeout',script+';return {exams,exercises,mistakes,start,buildErrorReport,getMatches:()=>matchingExercises,getCurrent:()=>current};')(document,URL,Blob,fn=>fn());
let total = 0;
for (const [n, exercise] of state.exercises.entries()) {
 const questions = exercise.questions;
 const fields = questions.map((q, i) => {
  const id = `gap-${n}-${i+1}`;
  if (!html.includes(`id="${id}"`)) throw Error(`Missing field ${id}`);
  const field = els[id];
  field.options = q.options?.map((_, j) => ({value:String(j),disabled:false}));
  return field;
 });
 state.start(n);
 const check = els[`gap-check-${n}`];
 const result = els[`gap-result-${n}`];
 const before = state.mistakes.length;
 if (check.disabled || !result.hidden) throw Error('Invalid starting state');
 const limits = exercise.choiceLimits;
 const first = questions[0];
 let wrongChoice;
 if (first.options) wrongChoice = first.options.findIndex((word,i) => i!==first.answer && (!limits || questions.slice(1).filter(q=>q.options[q.answer]===word).length < limits[word]));
 const makeMistake = !!first.answers || wrongChoice >= 0;
 for (const [i, q] of questions.entries()) {
  if (!q.explain || !q.sentence) throw Error('Missing content');
  if (q.options && !q.options[q.answer]) throw Error('Invalid key');
  fields[i].value = q.answers ? (i===0 ? 'ошибка' : q.answers[0]) : String(i===0 && makeMistake ? wrongChoice : q.answer);
  fields[i].listeners[q.answers ? 'input' : 'change']();
 }
 if (check.disabled || !result.hidden || state.mistakes.length !== before) throw Error('Answers checked early or unable to submit');
 check.listeners.click();
 check.listeners.click();
 const expected = questions.length - Number(makeMistake);
 if (result.hidden || !result.children[0].textContent.includes(`${expected} из ${questions.length}`)) throw Error('Incorrect total');
 if (state.mistakes.length !== before+Number(makeMistake)) throw Error('Mistake count or duplicate submission');
 if (makeMistake && state.mistakes.at(-1).source !== exercise.source) throw Error('Wrong mistake provenance');
 if (first.manualReview) {
  const accept = result.children[1].children[0].children[3];
  accept.listeners.click();
  accept.listeners.click();
  if (!result.children[0].textContent.includes(`${questions.length} из ${questions.length}`)) throw Error('Incorrect self-assessment total');
 }
 els[`gap-restart-${n}`].listeners.click();
 if (check.disabled || !result.hidden || fields.some(field=>field.value!=='')) throw Error('Restart failed');
 total += questions.length;
}
const feb = state.exercises.findIndex(e => e.exam==='Февраль 2024' && e.topic==='Предлоги');
const bank = state.exercises[feb];
const position = word => bank.questions[0].options.indexOf(word);
const fields = bank.questions.map((_,i)=>els[`gap-${feb}-${i+1}`]);
const choose = (i, word) => { fields[i].value = word ? String(position(word)) : ''; fields[i].listeners.change(); };
state.start(feb);
choose(0, 'z');
if (!fields[1].options[position('z')].disabled || fields[0].options[position('z')].disabled) throw Error('Single copy not reserved');
choose(0, 'na');
if (fields[1].options[position('z')].disabled || fields[1].options[position('na')].disabled) throw Error('Copy not freed or second copy unavailable');
choose(1, 'na');
if (!fields[2].options[position('na')].disabled) throw Error('Third copy available');
choose(1, '');
if (fields[2].options[position('na')].disabled) throw Error('Second copy not freed');
state.start(feb);
for (const [i, q] of bank.questions.entries()) {
 if (i !== 1) choose(i, q.options[q.answer]);
}
els[`gap-check-${feb}`].listeners.click();
if (!els[`gap-result-${feb}`].children[0].textContent.includes('4 из 5, пропущено 1')) throw Error('Skipped choice affected score');
const skipped = state.mistakes.at(-1);
if (!skipped.skipped || skipped.question!==2 || skipped.expected!=='z' || skipped.answer!=='') throw Error('Incorrect skipped choice');
const written = state.exercises.findIndex(e=>e.questions[0].manualReview);
state.start(written);
els[`gap-${written}-1`].value = '   ';
els[`gap-${written}-1`].listeners.input();
els[`gap-check-${written}`].listeners.click();
const writtenResult = els[`gap-result-${written}`];
const writtenCount = state.exercises[written].questions.length;
if (!writtenResult.children[0].textContent.includes(`0 из ${writtenCount}, пропущено ${writtenCount}`)) throw Error('Incorrect empty written total');
if (writtenResult.children[1].children[0].children.some(child=>child.type==='button')) throw Error('Empty answer available for self-assessment');
const visible = () => state.getMatches().map(i=>state.exercises[i]);
const changeFilter = (id, value) => { els[id].value = value; els[id].listeners.change(); };
changeFilter('exam-filter', 'Февраль 2024');
if (visible().length !== 8 || visible().some(e=>e.exam!=='Февраль 2024')) throw Error('Exam filter failed');
changeFilter('topic-filter', 'Предлоги');
if (visible().length !== 1 || visible()[0]!==bank || !els['exercise-navigation'].hidden) throw Error('Filter intersection failed');
choose(1, 'z');
changeFilter('exam-filter', '');
if (visible().length !== 15 || visible().some(e=>e.topic!=='Предлоги') || els['exercise-navigation'].hidden) throw Error('Topic filter failed');
if (els[`passage-${feb}`].hidden || fields[1].value !== String(position('z'))) throw Error('Filter cleared active answer');
const matching = state.getMatches();
if (!els['previous-exercise'].disabled || els['next-exercise'].disabled) throw Error('Incorrect first navigation state');
els['previous-exercise'].listeners.click();
if (state.getCurrent()!==feb) throw Error('Navigated before first exercise');
els['next-exercise'].listeners.click();
if (state.getCurrent()!==matching[1] || !els[`passage-${feb}`].hidden) throw Error('Next exercise failed');
els['previous-exercise'].listeners.click();
if (state.getCurrent()!==feb) throw Error('Previous exercise failed');
for (let i=1; i<matching.length; i++) els['next-exercise'].listeners.click();
if (!els['next-exercise'].disabled || state.getCurrent()!==matching.at(-1)) throw Error('Incorrect last navigation state');
changeFilter('topic-filter', '');
if (visible().length !== state.exercises.length) throw Error('All/all filter failed');
changeFilter('exam-filter', 'Февраль 2024');
changeFilter('topic-filter', 'Структура предложения');
if (visible().length || els['no-exercises'].hidden || !els['exercise-navigation'].hidden || !els[`passage-${feb}`].hidden) throw Error('Empty filter state failed');
changeFilter('topic-filter', 'Предлоги');
if (els[`passage-${feb}`].hidden || !els['no-exercises'].hidden) throw Error('Filter did not recover from empty state');
els['download-errors'].listeners.click();if(!downloaded.parts.join('').includes('Статус: Пропущено')||!state.buildErrorReport().includes('\nИсточник:'))throw Error('Report download failed');
console.log(`PASS: ${state.exams.length} exams, ${state.exercises.length} exercises, ${total} questions; batch feedback, shared word bank, self-assessment, restart, navigation and error export`);
