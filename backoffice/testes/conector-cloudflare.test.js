'use strict';

// Todos os ficheiros, pedidos HTTPS, relógios e processos são simulados em memória.
// Mesmo os caminhos fictícios ficam sob TESTES-CODEX. Não instala nem executa binários.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const crypto = require('node:crypto');
const { EventEmitter } = require('node:events');
const { Readable, PassThrough } = require('node:stream');
const { criarConector } = require('../conector-cloudflare');

const DADOS = path.resolve(__dirname, '..', '..', '..', '..', 'TESTES-CODEX', 'conector-cloudflare-unit');
const BIN = path.join(DADOS, 'bin', 'cloudflared.exe'), META = path.join(DADOS, 'bin', 'cloudflared.json');
const API = 'https://api.github.com/repos/cloudflare/cloudflared/releases/latest';
const URL_BIN = 'https://github.com/cloudflare/cloudflared/releases/download/2026.10.7/cloudflared-windows-amd64.exe';
const TOKEN = 'token_ficticio_apenas_para_testes_1234567890';
const EXE = Buffer.from('MZ' + 'ficheiro ficticio, nunca executavel;'.repeat(3));
const sha = b => crypto.createHash('sha256').update(b).digest('hex');
const vez = () => new Promise(resolve => setImmediate(resolve));

function erroFs(code) { const e = new Error('Erro fictício'); e.code = code; return e; }
function disco(instalado = false) {
  const ficheiros = new Map(), pastas = new Set([DADOS]), escritas = [], renomeacoes = [];
  function stat(p) {
    if (ficheiros.has(p)) return { size: ficheiros.get(p).length, isFile: () => true, isDirectory: () => false, isSymbolicLink: () => false };
    if (pastas.has(p)) return { size: 0, isFile: () => false, isDirectory: () => true, isSymbolicLink: () => false };
    throw erroFs('ENOENT');
  }
  const fs = {
    lstatSync: stat,
    realpathSync(p) { stat(p); return p; },
    readFileSync(p, codificacao) { if (!ficheiros.has(p)) throw erroFs('ENOENT'); const b = ficheiros.get(p); return codificacao ? b.toString(codificacao) : Buffer.from(b); },
    promises: {
      async mkdir(p) { pastas.add(p); },
      async writeFile(p, dados, opcoes) { if (opcoes?.flag === 'wx' && ficheiros.has(p)) throw erroFs('EEXIST'); escritas.push(p); ficheiros.set(p, Buffer.from(dados)); },
      async rename(a, b) { if (!ficheiros.has(a)) throw erroFs('ENOENT'); renomeacoes.push([a,b]); ficheiros.set(b, ficheiros.get(a)); ficheiros.delete(a); },
      async unlink(p) { if (!ficheiros.delete(p)) throw erroFs('ENOENT'); },
    },
  };
  if (instalado) {
    pastas.add(path.dirname(BIN)); ficheiros.set(BIN, Buffer.from(EXE));
    ficheiros.set(META, Buffer.from(JSON.stringify({ versao:'2026.10.7', sha256:sha(EXE), bytes:EXE.length })));
  }
  return { fs, ficheiros, pastas, escritas, renomeacoes };
}
function relogio() {
  let tempo = 0, seguinte = 1; const timers = new Map();
  return {
    agora: () => tempo,
    setTimeout(fn, ms) { const id = seguinte++; timers.set(id,{ fn, em:tempo+ms }); return id; },
    clearTimeout(id) { timers.delete(id); },
    avancar(ms) {
      const fim = tempo+ms;
      for (;;) { const proximo = [...timers].filter(([,t])=>t.em<=fim).sort((a,b)=>a[1].em-b[1].em)[0]; if(!proximo)break; tempo=proximo[1].em; timers.delete(proximo[0]); proximo[1].fn(); }
      tempo=fim;
    },
    pendentes: () => timers.size,
  };
}
function release(alterar = () => {}) {
  const r={ tag_name:'2026.10.7', draft:false, prerelease:false, assets:[{name:'cloudflared-windows-amd64.exe',size:EXE.length,digest:'sha256:'+sha(EXE),browser_download_url:URL_BIN}] };
  alterar(r); return r;
}
function rede(planos) {
  const chamadas=[];
  return { chamadas, https:{ get(u, opcoes, cb) {
    const url=String(u), plano=planos[chamadas.length]; chamadas.push({url,opcoes});
    if(!plano)throw new Error('Pedido HTTPS não simulado: '+url);
    if(plano.url)assert.equal(url,plano.url);
    const pedido=new EventEmitter(); pedido.destroyed=false;
    pedido.destroy=()=>{pedido.destroyed=true;};
    queueMicrotask(()=>{
      if(plano.erro){pedido.emit('error',new Error(plano.erro));return;}
      const resposta=plano.pendente?new PassThrough():Readable.from(plano.partes||[Buffer.isBuffer(plano.corpo)?plano.corpo:Buffer.from(plano.corpo||'')]);
      resposta.statusCode=plano.status||200; resposta.headers=plano.headers||{};
      pedido.resposta=resposta; cb(resposta);
    });
    return pedido;
  } } };
}
function filhoFicticio() {
  const filho=new EventEmitter(); filho.pid=9876; filho.stdout=new PassThrough(); filho.stderr=new PassThrough(); filho.sinais=[]; filho.terminarAoMatar=true;
  filho.fechar=()=>{if(filho.fechado)return;filho.fechado=true;filho.emit('close',0,null);};
  filho.kill=sinal=>{filho.sinais.push(sinal);if(filho.terminarAoMatar)queueMicrotask(filho.fechar);return true;};
  return filho;
}
function preparar({ instalado=false, planos, ...extras } = {}) {
  const d=disco(instalado), r=relogio(), n=rede(planos||[{url:API,corpo:JSON.stringify(release())},{url:URL_BIN,corpo:EXE}]);
  const pai=new EventEmitter(), spawns=[], filhos=[];
  const spawn=(ficheiro,args,opcoes)=>{
    spawns.push({ficheiro,args:[...args],opcoes:{...opcoes,env:{...opcoes.env}},ambienteOriginal:opcoes.env});
    if(extras.spawnThrows)throw new Error(TOKEN);
    const filho=filhoFicticio(); filhos.push(filho);
    if(!extras.semSpawn)queueMicrotask(()=>{
      if(extras.spawnError){filho.emit('error',new Error(TOKEN));filho.fechar();}
      else filho.emit('spawn');
    });
    return filho;
  };
  const conector=criarConector({pastaDados:DADOS,fs:d.fs,https:n.https,spawn,processoPai:pai,plataforma:'win32',arquitetura:'x64',ambiente:{PATH:'caminho-ficticio',TUNNEL_TOKEN:TOKEN,TUNNEL_LOGFILE:'nao-usar.log',OUTRO_SEGREDO:TOKEN},agora:r.agora,setTimeout:r.setTimeout,clearTimeout:r.clearTimeout,...extras});
  return {conector,d,r,n,pai,spawns,filhos};
}
function semSegredos(h) {
  assert.equal(JSON.stringify(h.conector.estado()).includes(TOKEN),false);
  assert.equal([...h.d.ficheiros.values()].some(b=>b.includes(Buffer.from(TOKEN))),false);
}

test('criar/estado não inicia pedidos, instalação, processos nem ficheiros',()=>{
  const h=preparar(); const s=h.conector.estado(); assert.equal(s.instalado,false);assert.equal(s.estado,'nao_instalado');assert.equal(s.pid,null);
  assert.equal(h.n.chamadas.length,0);assert.equal(h.spawns.length,0);assert.equal(h.d.escritas.length,0);
  s.erro=TOKEN; assert.equal(h.conector.estado().erro,null);assert.equal(h.pai.listenerCount('exit'),0);
});
test('instala o asset oficial depois do SHA-256, por temporário e rename',async()=>{
  const h=preparar(); const s=await h.conector.instalar();
  assert.equal(s.instalado,true);assert.equal(s.versao,'2026.10.7');assert.equal(s.estado,'desligado');
  assert.deepEqual(h.d.ficheiros.get(BIN),EXE);assert.equal(h.d.renomeacoes.length,2);
  assert.equal([...h.d.ficheiros.keys()].some(k=>k.includes('.part')),false);
  assert.equal(h.n.chamadas[0].opcoes.rejectUnauthorized,true);assert.equal(h.spawns.length,0);semSegredos(h);
});
test('instalar é idempotente e deduplica pedidos simultâneos',async()=>{
  const h=preparar();await Promise.all([h.conector.instalar(),h.conector.instalar()]);assert.equal(h.n.chamadas.length,2);
  await h.conector.instalar();assert.equal(h.n.chamadas.length,2);
});
test('recupera versão de manifesto validado, mas não aceita um binário adulterado',async()=>{
  const h=preparar({instalado:true});assert.equal(h.conector.estado().versao,'2026.10.7');
  h.d.ficheiros.set(BIN,Buffer.from('MZ'+'x'.repeat(EXE.length-2)));
  await assert.rejects(h.conector.ligar(TOKEN),{code:'CF_INSTALAR'});assert.equal(h.spawns.length,0);
  await h.conector.instalar();assert.deepEqual(h.d.ficheiros.get(BIN),EXE);
});
for(const [nome,alterar,codigo] of [
  ['digest ausente',r=>delete r.assets[0].digest,'CF_RELEASE'],
  ['digest inválido',r=>r.assets[0].digest='sha256:abc','CF_RELEASE'],
  ['asset errado',r=>r.assets[0].name='cloudflared-linux-amd64','CF_RELEASE'],
  ['tag insegura',r=>r.tag_name='../outra','CF_RELEASE'],
  ['pré-release',r=>r.prerelease=true,'CF_RELEASE'],
  ['tamanho excessivo',r=>r.assets[0].size=129*1024*1024,'CF_TAMANHO'],
  ['origem falsa',r=>r.assets[0].browser_download_url='https://github.com/atacante/programa.exe','CF_ORIGEM'],
])test('recusa metadata: '+nome,async()=>{
  const h=preparar({planos:[{corpo:JSON.stringify(release(alterar))}]});
  await assert.rejects(h.conector.instalar(),{code:codigo});assert.equal(h.n.chamadas.length,1);assert.equal(h.d.escritas.length,0);semSegredos(h);
});
test('não grava nem renomeia se o hash, comprimento ou cabeçalho MZ diferir',async()=>{
  for(const dados of [Buffer.from('MZ'+ 'x'.repeat(EXE.length-2)),EXE.subarray(0,20),Buffer.from('xx'+EXE.subarray(2).toString())]){
    const h=preparar({planos:[{corpo:JSON.stringify(release())},{corpo:dados}]});
    await assert.rejects(h.conector.instalar(),{code:'CF_HASH'});assert.equal(h.d.escritas.length,0);assert.equal(h.d.renomeacoes.length,0);
  }
});
test('segue um redirect HTTPS para o CDN GitHub permitido',async()=>{
  const url='https://release-assets.githubusercontent.com/github-production-release-asset/123?assinatura=ficticia';
  const h=preparar({planos:[{corpo:JSON.stringify(release())},{status:302,headers:{location:url}},{url,corpo:EXE}]});
  assert.equal((await h.conector.instalar()).instalado,true);assert.equal(h.n.chamadas.length,3);
});
for(const url of ['http://release-assets.githubusercontent.com/a','https://github.com.evil.example/a','https://user:pass@github.com/cloudflare/cloudflared/releases/download/a','https://release-assets.githubusercontent.com:444/a','https://127.0.0.1/a','https://github.com/outro/projeto/releases/download/a'])test('recusa redirect: '+url,async()=>{
  const h=preparar({planos:[{corpo:JSON.stringify(release())},{status:302,headers:{location:url}}]});
  await assert.rejects(h.conector.instalar(),{code:'CF_ORIGEM'});assert.equal(h.n.chamadas.length,2);assert.equal(h.d.escritas.length,0);
});
test('limita número de redirects',async()=>{
  const h=preparar({planos:[{corpo:JSON.stringify(release())},...Array.from({length:6},()=>({status:302,headers:{location:URL_BIN}}))]});
  await assert.rejects(h.conector.instalar(),{code:'CF_ORIGEM'});assert.equal(h.n.chamadas.length,7);
});
test('limita bytes declarados e bytes recebidos sem Content-Length',async()=>{
  for(const headers of [{'content-length':String(EXE.length+1)},{}]){
    const h=preparar({limiteBinario:EXE.length,planos:[{corpo:JSON.stringify(release())},{headers,partes:[EXE,Buffer.from('x')]}]});
    await assert.rejects(h.conector.instalar(),{code:'CF_TAMANHO'});assert.equal(h.d.escritas.length,0);
  }
});
test('tempo total é limitado mesmo se a resposta nunca terminar',async()=>{
  const h=preparar({tempoMetadataMs:50,planos:[{pendente:true}]});const p=h.conector.instalar();
  await vez();h.r.avancar(50);await assert.rejects(p,{code:'CF_TEMPO'});assert.equal(h.d.escritas.length,0);
});
test('erro de rede nunca devolve texto bruto',async()=>{
  const h=preparar({planos:[{erro:TOKEN}]});await assert.rejects(h.conector.instalar(),e=>e.code==='CF_REDE'&&!e.message.includes(TOKEN));semSegredos(h);
});
test('limpa temporários se o disco falhar',async()=>{
  const h=preparar();h.d.fs.promises.rename=async()=>{throw new Error(TOKEN);};
  await assert.rejects(h.conector.instalar(),{code:'CF_GUARDAR'});assert.equal([...h.d.ficheiros.keys()].some(k=>k.includes('.part')),false);semSegredos(h);
});
test('recusa pasta bin que resolve fora da pasta gerida',async()=>{
  const h=preparar();h.d.fs.realpathSync=p=>p===path.dirname(BIN)?path.resolve(DADOS,'..','fora'):p;
  await assert.rejects(h.conector.instalar(),{code:'CF_GUARDAR'});assert.equal(h.d.escritas.length,0);
});
test('não instala nem inicia binário de Windows noutro sistema',async()=>{
  const h=preparar({plataforma:'linux'});await assert.rejects(h.conector.instalar(),{code:'CF_SISTEMA'});assert.equal(h.n.chamadas.length,0);
});
test('ligar exige instalação e token, sem instalação implícita',async()=>{
  const h=preparar();await assert.rejects(h.conector.ligar(TOKEN),{code:'CF_INSTALAR'});assert.equal(h.n.chamadas.length,0);
  const i=preparar({instalado:true});await assert.rejects(i.conector.ligar(''),{code:'CF_TOKEN'});assert.equal(i.spawns.length,0);
});
test('spawn oculto e sem shell: token apenas no ambiente efémero, sem argumentos/ficheiros',async()=>{
  const h=preparar({instalado:true});const s=await h.conector.ligar(TOKEN),ch=h.spawns[0];
  assert.equal(s.estado,'a_arrancar');assert.equal(s.ligado,false);assert.equal(s.pid,9876);
  assert.equal(ch.ficheiro,BIN);assert.deepEqual(ch.args,['tunnel','--no-autoupdate','run']);
  assert.equal(ch.opcoes.windowsHide,true);assert.equal(ch.opcoes.shell,false);assert.equal(ch.opcoes.env.TUNNEL_TOKEN,TOKEN);
  assert.equal(ch.ambienteOriginal.TUNNEL_TOKEN,undefined);assert.equal(ch.opcoes.env.OUTRO_SEGREDO,undefined);assert.equal(ch.opcoes.env.TUNNEL_LOGFILE,undefined);
  assert.equal(ch.opcoes.env.HOME,DADOS);assert.equal(h.d.escritas.length,0);semSegredos(h);
  await h.conector.desligar();assert.equal(h.pai.listenerCount('exit'),0);
});
test('readiness aceita frases partidas e não retém logs/tokens',async()=>{
  const h=preparar({instalado:true});await h.conector.ligar(TOKEN);const c=h.filhos[0];
  c.stderr.write(TOKEN+'\nRegis');c.stderr.write('tered tunnel conn');c.stderr.write('ection connIndex=0 ip=oculto\n');
  assert.equal(h.conector.estado().ligado,true);assert.equal(h.conector.estado().estado,'ligado');semSegredos(h);
  assert.deepEqual(Object.keys(h.conector.estado()).sort(),['erro','estado','instalado','ligado','pid','versao']);
  await h.conector.desligar();
});
test('mantém conexões restantes e deixa o cloudflared repetir sem recriar o processo',async()=>{
  const h=preparar({instalado:true});await h.conector.ligar(TOKEN);const c=h.filhos[0];
  c.stderr.write('Registered tunnel connection connIndex=0\nRegistered tunnel connection connIndex=1\n');
  c.stderr.write('Unregistered tunnel connection connIndex=0\n');assert.equal(h.conector.estado().ligado,true);
  c.stderr.write('Unregistered tunnel connection connIndex=1\nRetrying connection in up to 8s\n');assert.equal(h.conector.estado().estado,'a_religar');assert.equal(h.conector.estado().ligado,false);
  c.stderr.write('Registered tunnel connection connIndex=2\n');assert.equal(h.conector.estado().ligado,true);assert.equal(h.spawns.length,1);
  await h.conector.ligar(TOKEN);assert.equal(h.spawns.length,1);await h.conector.desligar();
});
test('token recusado e saída inesperada publicam só erros curados',async()=>{
  const h=preparar({instalado:true});await h.conector.ligar(TOKEN);const c=h.filhos[0];
  c.stderr.write('Provided Tunnel token is not valid '+TOKEN+'\n');assert.equal(h.conector.estado().ligado,false);assert.equal(h.conector.estado().estado,'erro');semSegredos(h);
  c.fechar();assert.equal(h.conector.estado().pid,null);assert.equal(h.conector.estado().erro.includes(TOKEN),false);
});
test('falhas síncrona/assíncrona de spawn não expõem token',async()=>{
  for(const opcao of [{spawnThrows:true},{spawnError:true}]){
    const h=preparar({instalado:true,...opcao});await assert.rejects(h.conector.ligar(TOKEN),e=>e.code==='CF_ARRANQUE'&&!e.message.includes(TOKEN));semSegredos(h);
  }
});
test('espera de spawn é limitada; não limita a espera de uma conexão posterior',async()=>{
  const h=preparar({instalado:true,semSpawn:true,tempoArranqueMs:50});const p=h.conector.ligar(TOKEN);h.r.avancar(50);
  await assert.rejects(p,{code:'CF_ARRANQUE'});await vez();semSegredos(h);
  const i=preparar({instalado:true});await i.conector.ligar(TOKEN);i.r.avancar(120000);assert.equal(i.conector.estado().estado,'a_arrancar');await i.conector.desligar();
});
test('desligar afeta apenas o filho próprio e é idempotente',async()=>{
  const h=preparar({instalado:true}),outro=filhoFicticio();await h.conector.ligar(TOKEN);const s=await h.conector.desligar();
  assert.equal(s.estado,'desligado');assert.equal(s.pid,null);assert.deepEqual(h.filhos[0].sinais,['SIGTERM']);assert.deepEqual(outro.sinais,[]);
  await h.conector.desligar();assert.deepEqual(h.filhos[0].sinais,['SIGTERM']);assert.equal(h.r.pendentes(),0);
});
test('paragem usa SIGKILL só no mesmo filho após o prazo',async()=>{
  const h=preparar({instalado:true,tempoParagemMs:50});await h.conector.ligar(TOKEN);const c=h.filhos[0];
  c.kill=sinal=>{c.sinais.push(sinal);if(sinal==='SIGKILL')c.fechar();return true;};
  const p=h.conector.desligar();h.r.avancar(50);assert.equal((await p).estado,'desligado');assert.deepEqual(c.sinais,['SIGTERM','SIGKILL']);assert.equal(h.r.pendentes(),0);
});
test('paragem que não fecha continua a identificar o mesmo filho, sem matar por PID global',async()=>{
  const h=preparar({instalado:true,tempoParagemMs:50});await h.conector.ligar(TOKEN);h.filhos[0].terminarAoMatar=false;
  const p=h.conector.desligar();h.r.avancar(2050);await assert.rejects(p,{code:'CF_PARAGEM'});assert.equal(h.conector.estado().pid,9876);
  await assert.rejects(h.conector.ligar(TOKEN),{code:'CF_OCUPADO'});h.filhos[0].fechar();
});
test('saída do pai pára apenas a referência de filho que criou',async()=>{
  const h=preparar({instalado:true});await h.conector.ligar(TOKEN);h.pai.emit('exit');await vez();assert.deepEqual(h.filhos[0].sinais,['SIGTERM']);
});
test('instalação é recusada enquanto o túnel está em execução',async()=>{
  const h=preparar({instalado:true});await h.conector.ligar(TOKEN);await assert.rejects(h.conector.instalar(),{code:'CF_OCUPADO'});assert.equal(h.n.chamadas.length,0);await h.conector.desligar();
});
test('desligar durante o arranque cancela a ligação e não deixa timers/filhos',async()=>{
  const h=preparar({instalado:true,semSpawn:true});const inicio=h.conector.ligar(TOKEN),parar=h.conector.desligar();
  await assert.rejects(inicio,{code:'CF_CANCELADO'});assert.equal((await parar).estado,'desligado');assert.equal(h.r.pendentes(),0);assert.equal(h.pai.listenerCount('exit'),0);
});
test('chamadas concorrentes a ligar criam só um filho',async()=>{
  const h=preparar({instalado:true});await Promise.all([h.conector.ligar(TOKEN),h.conector.ligar(TOKEN)]);assert.equal(h.spawns.length,1);await h.conector.desligar();
});
