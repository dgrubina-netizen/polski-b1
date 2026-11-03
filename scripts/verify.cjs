const fs=require('fs'),vm=require('vm');
const html=fs.readFileSync('index.html','utf8'),script=html.match(/<script>([\s\S]*?)<\/script>/)[1];
class Element{constructor(){this.children=[];this.style={};this.listeners={};this.value='';this.disabled=false;this.hidden=false;this.attrs={}}setAttribute(k,v){this.attrs[k]=v}addEventListener(t,f){this.listeners[t]=f}append(...nodes){for(const n of nodes){const i=this.children.indexOf(n);if(i>=0)this.children.splice(i,1);this.children.push(n)}if(this.isSelect&&this.children.length===1)this.value=nodes[0].value}replaceChildren(){this.children=[];if(this.isSelect)this.value=''}querySelector(){return this.selected}querySelectorAll(){return []}click(){this.clicked=true}remove(){}}
const els={},document={body:new Element(),getElementById(id){const e=els[id] ||=new Element();if(id==='category-select')e.isSelect=true;return e},createElement(){return new Element()}};
let downloaded;const URL={createObjectURL(blob){downloaded=blob;return 'blob:test'},revokeObjectURL(){}};class Blob{constructor(parts){this.parts=parts}}
const state=new Function('document','URL','Blob','setTimeout',script+';return {exams,exercises,mistakes,start,buildErrorReport,getScore:()=>score,getIndex:()=>index};')(document,URL,Blob,fn=>fn());
let total=0;
for(const [n,e] of state.exercises.entries()){
 if(!html.includes(`id="passage-${n}"`)||!html.includes(`id="choose-${n}"`))throw Error('Missing UI');
 state.start(n);
 for(const [i,q] of e.questions.entries()){
  if(!q.explain||!q.sentence)throw Error('Missing content');
  if(q.options&&!q.options[q.answer])throw Error('Invalid key');
  const value=q.answers?(i===0?'ошибка':q.answers[0]):String(i===0?(q.answer+1)%q.options.length:q.answer);
  els.form.selected={value};els.form.listeners.submit({preventDefault(){}});
  if(!els.feedback.children.length)throw Error('Missing feedback');
  if(i===0&&q.manualReview){const b=els.feedback.children[2];b.listeners.click();b.listeners.click();}
  els.form.listeners.submit({preventDefault(){}});total++;
 }
 const expected=e.questions.length-1+(e.questions[0].manualReview?1:0);if(state.getScore()!==expected)throw Error('Wrong score '+e.exam+' '+e.number);
 const mistake=state.mistakes.at(-1);if(mistake.source!==e.source||mistake.exercise!==e.number)throw Error('Wrong report provenance');
 els.restart.listeners.click();if(state.getScore()!==0||state.getIndex()!==0)throw Error('Restart failed');
}
els['mode-topic'].listeners.click();els['category-select'].value='Союзы';els['category-select'].listeners.change();const visible=state.exercises.filter((e,i)=>!els['choose-'+i].hidden);if(visible.some(e=>e.topic!=='Союзы')||visible.length<2)throw Error('Topic filter failed');
els['download-errors'].listeners.click();if(!downloaded.parts.join('').includes('Источник:')||!state.buildErrorReport().includes('\nИсточник:'))throw Error('Report download failed');
console.log(`PASS: ${state.exams.length} exams, ${state.exercises.length} exercises, ${total} questions; feedback, scores, self-assessment, restart, navigation, report sources and download`);
