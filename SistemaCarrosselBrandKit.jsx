import React, { useMemo, useRef, useState } from 'react';
import { AlertCircle, Check, Download, Loader, Send, Trash2, Upload } from 'lucide-react';

const DEFAULT_SETUP = {
  marca: '',
  nicho: '',
  descricao_marca: '',
  objetivo: '',
  metrica_sucesso: '',
  persona_nome: '',
  persona_idade_min: '25',
  persona_idade_max: '45',
  persona_problema: '',
  persona_desejo: '',
  persona_linguagem: '',
  concorrentes: ['', '', ''],
  cores_hex: ['#000000', '#FFFFFF', '#FF6B35'],
  fonte: 'Poppins',
  tom_voz: '',
  figma_token: '',
  figma_file_id: ''
};

const DEFAULT_BRAND = {
  cores: { primaria: '#000000', secundaria: '#FFFFFF', destaque: '#FF6B35' },
  tipografia: { heading: 'Poppins' },
  tom_voz: ''
};

const ACCEPTED_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
const MAX_FILES = 6;
const MAX_FILE_SIZE_BYTES = 6 * 1024 * 1024;
const REQUEST_TIMEOUT_MS = 45000;

const MANUAL_THEMES = [
  { titulo: '3 erros que travam seu resultado', tipo: 'educativo', angulo: 'quebrar objecoes', potencial: 'alto', resumo: 'Mostra erros comuns, explica por que acontecem e termina com uma correcao pratica.' },
  { titulo: 'Guia rapido para comecar do jeito certo', tipo: 'tutorial', angulo: 'clareza e passo a passo', potencial: 'alto', resumo: 'Organiza o tema em etapas simples para gerar confianca e facilitar compartilhamento.' },
  { titulo: 'Antes e depois de ajustar sua estrategia', tipo: 'transformacao', angulo: 'comparacao visual', potencial: 'medio', resumo: 'Contrasta o cenário ruim com o cenário ideal e reforca os ganhos principais.' },
  { titulo: 'O metodo simples que voce pode aplicar hoje', tipo: 'metodo', angulo: 'acao imediata', potencial: 'alto', resumo: 'Apresenta um framework curto e facil de executar sem depender de ferramentas complexas.' },
  { titulo: 'Perguntas que seu cliente faz antes de comprar', tipo: 'objecoes', angulo: 'venda consultiva', potencial: 'medio', resumo: 'Usa duvidas reais do publico para criar um carrossel que educa e converte.' }
];

const sanitizeText = (value, fallback = '') => {
  if (typeof value !== 'string') return fallback;
  const clean = value.replace(/\s+/g, ' ').trim();
  return clean || fallback;
};

const normalizeHex = (value, fallback) => {
  const clean = (value || '').trim().toUpperCase();
  return /^#([0-9A-F]{3}|[0-9A-F]{6})$/i.test(clean) ? clean : fallback;
};

const readAsBase64 = (file) =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result !== 'string') return reject(new Error(`Falha ao ler ${file.name}.`));
      resolve(reader.result.split(',')[1]);
    };
    reader.onerror = () => reject(new Error(`Erro ao ler ${file.name}.`));
    reader.readAsDataURL(file);
  });

const collectTextBlocks = (data) => data?.content?.filter((item) => item?.type === 'text').map((item) => item.text).join('\n') || '';

const extractJson = (text) => {
  const source = (text || '').replace(/```json/gi, '').replace(/```/g, '').trim();
  for (let start = 0; start < source.length; start += 1) {
    if (!['{', '['].includes(source[start])) continue;
    const stack = [];
    let inString = false;
    let escaped = false;
    for (let end = start; end < source.length; end += 1) {
      const char = source[end];
      if (escaped) { escaped = false; continue; }
      if (char === '\\') { escaped = true; continue; }
      if (char === '"') { inString = !inString; continue; }
      if (inString) continue;
      if (char === '{' || char === '[') stack.push(char);
      if (char === '}' || char === ']') {
        const last = stack[stack.length - 1];
        if (!((last === '{' && char === '}') || (last === '[' && char === ']'))) break;
        stack.pop();
        if (!stack.length) {
          try { return JSON.parse(source.slice(start, end + 1)); } catch { continue; }
        }
      }
    }
  }
  return null;
};

const pickMostFrequent = (values, fallback) => {
  const map = new Map();
  values.filter(Boolean).forEach((value) => map.set(value, (map.get(value) || 0) + 1));
  return [...map.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || fallback;
};

const parseBrandData = (text) => {
  const parsed = extractJson(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('A IA nao retornou um JSON valido do brand kit.');
  return {
    cores: {
      primaria: normalizeHex(parsed?.cores?.primaria, DEFAULT_BRAND.cores.primaria),
      secundaria: normalizeHex(parsed?.cores?.secundaria, DEFAULT_BRAND.cores.secundaria),
      destaque: normalizeHex(parsed?.cores?.destaque, DEFAULT_BRAND.cores.destaque)
    },
    tipografia: { heading: sanitizeText(parsed?.tipografia?.heading, DEFAULT_BRAND.tipografia.heading) },
    tom_voz: sanitizeText(parsed?.tom_voz, DEFAULT_BRAND.tom_voz)
  };
};

const normalizeDesign = (text) => {
  const parsed = extractJson(text);
  if (!parsed || Array.isArray(parsed) || typeof parsed !== 'object') throw new Error('O carrossel nao veio em JSON valido.');
  const slides = [];
  for (let i = 1; i <= 7; i += 1) {
    const slide = parsed[`slide_${i}`];
    if (!slide || typeof slide !== 'object') throw new Error(`Faltou slide_${i}.`);
    slides.push({
      id: `slide_${i}`,
      background_color: normalizeHex(slide.background_color, DEFAULT_BRAND.cores.secundaria),
      elementos: Array.isArray(slide.elementos) ? slide.elementos.map((elemento, index) => ({
        id: `slide_${i}_elemento_${index + 1}`,
        tipo: sanitizeText(elemento?.tipo, 'texto'),
        conteudo: sanitizeText(elemento?.conteudo, ''),
        posicao_x: Number.isFinite(Number(elemento?.posicao_x)) ? Number(elemento.posicao_x) : 0,
        posicao_y: Number.isFinite(Number(elemento?.posicao_y)) ? Number(elemento.posicao_y) : 0,
        tamanho: Number.isFinite(Number(elemento?.tamanho)) ? Number(elemento.tamanho) : 16,
        cor: normalizeHex(elemento?.cor, DEFAULT_BRAND.cores.primaria),
        font: sanitizeText(elemento?.font, DEFAULT_BRAND.tipografia.heading)
      })) : []
    });
  }
  return { raw: parsed, slides };
};
const createManualThemes = (setup) =>
  MANUAL_THEMES.map((theme, index) => ({
    ...theme,
    id: `tema_${index + 1}`,
    resumo: `${theme.resumo} Marca: ${sanitizeText(setup.marca, 'Sua marca')}. Nicho: ${sanitizeText(setup.nicho, 'Seu nicho')}.`
  }));

const createManualCarousel = ({ setup, tema }) => {
  const baseColor = normalizeHex(setup.cores_hex[0], '#000000');
  const secondaryColor = normalizeHex(setup.cores_hex[1], '#FFFFFF');
  const accentColor = normalizeHex(setup.cores_hex[2], '#FF6B35');
  const font = sanitizeText(setup.fonte, 'Poppins');
  const brand = sanitizeText(setup.marca, 'Sua marca');
  const niche = sanitizeText(setup.nicho, 'seu nicho');
  const objective = sanitizeText(setup.objetivo, 'gerar mais resultado');
  const pain = sanitizeText(setup.persona_problema, 'um problema importante');
  const desire = sanitizeText(setup.persona_desejo, 'um resultado claro');
  const themeTitle = sanitizeText(tema?.titulo || tema, 'Tema principal');
  const slideTexts = [
    [`${themeTitle}`, `${brand} para ${niche}`],
    ['O problema', pain],
    ['O erro mais comum', `Muita gente tenta resolver ${pain.toLowerCase()} sem estrategia.`],
    ['O que muda', `Quando a abordagem fica clara, o caminho para ${desire.toLowerCase()} fica mais simples.`],
    ['Passo 1', `Defina uma mensagem central alinhada ao objetivo: ${objective}.`],
    ['Passo 2', `Use prova, clareza e consistencia no tom de voz: ${sanitizeText(setup.tom_voz, 'direto e confiavel')}.`],
    ['Fechamento', 'Salve este carrossel e aplique isso hoje na sua marca.']
  ];
  const slides = slideTexts.map((texts, index) => ({
    id: `slide_${index + 1}`,
    background_color: index % 2 === 0 ? secondaryColor : '#F8FAFC',
    elementos: [
      { id: `slide_${index + 1}_titulo`, tipo: 'titulo', conteudo: texts[0], posicao_x: 80, posicao_y: 120, tamanho: 44, cor: baseColor, font },
      { id: `slide_${index + 1}_texto`, tipo: 'texto', conteudo: texts[1], posicao_x: 80, posicao_y: 260, tamanho: 24, cor: baseColor, font },
      { id: `slide_${index + 1}_faixa`, tipo: 'shape', conteudo: 'accent-bar', posicao_x: 80, posicao_y: 90, tamanho: 12, cor: accentColor, font }
    ]
  }));
  return {
    raw: Object.fromEntries(slides.map((slide) => [slide.id, { background_color: slide.background_color, elementos: slide.elementos.map(({ id, ...rest }) => rest) }])),
    slides
  };
};

const formatThemesText = (themes) => themes.map((theme, index) => `tema_${index + 1}\n- titulo: ${theme.titulo}\n- tipo: ${theme.tipo}\n- angulo: ${theme.angulo}\n- potencial: ${theme.potencial}\n- resumo: ${theme.resumo}`).join('\n\n');
const isLowCreditError = (message) => /credit balance is too low|upgrade or purchase credits|billing/i.test(message || '');

export default function SistemaCarrosselBrandKit() {
  const [etapa, setEtapa] = useState('setup');
  const [modo, setModo] = useState('ia');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState(null);
  const [sucesso, setSucesso] = useState(null);
  const [info, setInfo] = useState(null);
  const [brandImages, setBrandImages] = useState([]);
  const [extractedBrand, setExtractedBrand] = useState(null);
  const [setup, setSetup] = useState(DEFAULT_SETUP);
  const [analise, setAnalise] = useState(null);
  const [temas, setTemas] = useState(null);
  const [temaSelecionado, setTemaSelecionado] = useState('');
  const [resultado, setResultado] = useState(null);
  const fileInputRef = useRef(null);
  const anthropicProxyUrl = import.meta.env.VITE_ANTHROPIC_PROXY_URL;
  const manualThemes = useMemo(() => createManualThemes(setup), [setup]);

  const clearMessages = () => {
    setErrors(null);
    setSucesso(null);
    setInfo(null);
  };

  const switchToManualMode = (message) => {
    setModo('manual');
    setInfo(message || 'Modo manual ativado. O app continua funcionando sem IA.');
  };

  const callAnthropic = async ({ model, max_tokens, messages }) => {
    if (!anthropicProxyUrl) throw new Error('Configure VITE_ANTHROPIC_PROXY_URL para usar o backend.');
    const controller = new AbortController();
    const timeoutId = window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
    let response;
    try {
      response = await fetch(anthropicProxyUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ model, max_tokens, messages }),
        signal: controller.signal
      });
    } catch (error) {
      if (error.name === 'AbortError') throw new Error('A requisicao para a IA demorou demais. Tente novamente.');
      throw error;
    } finally {
      window.clearTimeout(timeoutId);
    }
    const raw = await response.text();
    let data;
    try {
      data = raw ? JSON.parse(raw) : null;
    } catch {
      throw new Error('A resposta da IA nao veio em JSON valido.');
    }
    if (!response.ok) throw new Error(data?.error?.message || `Erro HTTP ${response.status}`);
    return data;
  };

  const resetBrandKit = () => {
    setBrandImages([]);
    setExtractedBrand(null);
    setSucesso(null);
    setSetup((prev) => ({ ...prev, cores_hex: DEFAULT_SETUP.cores_hex, fonte: DEFAULT_SETUP.fonte, tom_voz: '' }));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    clearMessages();
    if (files.length > MAX_FILES) return setErrors(`Envie no maximo ${MAX_FILES} imagens por vez.`);
    const invalid = files.find((file) => !ACCEPTED_IMAGE_TYPES.includes(file.type));
    if (invalid) return setErrors(`O arquivo "${invalid.name}" nao e uma imagem suportada.`);
    const oversized = files.find((file) => file.size > MAX_FILE_SIZE_BYTES);
    if (oversized) return setErrors(`O arquivo "${oversized.name}" passou do limite de 6MB.`);
    if (modo !== 'ia') {
      setBrandImages(files);
      setInfo('As imagens foram anexadas, mas a extracao automatica fica disponivel apenas no modo IA.');
      return;
    }
    setLoading(true);
    setSucesso(`Analisando ${files.length} imagem(ns)...`);
    try {
      const extracted = [];
      for (let i = 0; i < files.length; i += 1) {
        const file = files[i];
        setSucesso(`Processando imagem ${i + 1} de ${files.length}: ${file.name}`);
        const base64 = await readAsBase64(file);
        const data = await callAnthropic({
          model: 'claude-3-5-sonnet-latest',
          max_tokens: 700,
          messages: [{ role: 'user', content: [{ type: 'text', text: 'Analise esta imagem de um manual de marca e retorne APENAS um JSON valido com este formato: {"cores":{"primaria":"#000000","secundaria":"#FFFFFF","destaque":"#FF6B35"},"tipografia":{"heading":"Poppins"},"tom_voz":"Descricao breve"}. Use apenas HEX e nao escreva markdown.' }, { type: 'image', source: { type: 'base64', media_type: file.type, data: base64 } }] }]
        });
        extracted.push(parseBrandData(collectTextBlocks(data)));
      }
      const merged = {
        cores: {
          primaria: pickMostFrequent(extracted.map((item) => item.cores.primaria), DEFAULT_BRAND.cores.primaria),
          secundaria: pickMostFrequent(extracted.map((item) => item.cores.secundaria), DEFAULT_BRAND.cores.secundaria),
          destaque: pickMostFrequent(extracted.map((item) => item.cores.destaque), DEFAULT_BRAND.cores.destaque)
        },
        tipografia: { heading: pickMostFrequent(extracted.map((item) => item.tipografia.heading), DEFAULT_BRAND.tipografia.heading) },
        tom_voz: pickMostFrequent(extracted.map((item) => item.tom_voz), '')
      };
      const cores = [merged.cores.primaria, merged.cores.secundaria, merged.cores.destaque];
      setExtractedBrand(merged);
      setBrandImages(files);
      setSetup((prev) => ({ ...prev, cores_hex: cores, fonte: merged.tipografia.heading, tom_voz: merged.tom_voz || prev.tom_voz }));
      setSucesso(`${files.length} imagem(ns) processada(s)! Cores: ${cores.join(' • ')}`);
    } catch (error) {
      if (isLowCreditError(error.message)) {
        setBrandImages(files);
        switchToManualMode('Seus creditos da Anthropic acabaram. Continue preenchendo cores, fonte e tom manualmente.');
      } else {
        setErrors(`Erro ao processar imagens: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };
  const validarSetup = () => {
    if (!setup.marca.trim()) return 'Nome da marca obrigatorio.';
    if (!setup.nicho.trim()) return 'Nicho obrigatorio.';
    if (!setup.objetivo.trim()) return 'Objetivo obrigatorio.';
    if (!setup.persona_problema.trim()) return 'Problema da persona obrigatorio.';
    return null;
  };

  const executarAnalise = async () => {
    const erro = validarSetup();
    if (erro) return setErrors(erro);
    clearMessages();
    if (modo === 'manual') {
      setAnalise(`Analise manual pronta para ${sanitizeText(setup.marca)}. Nicho: ${sanitizeText(setup.nicho)}. Objetivo: ${sanitizeText(setup.objetivo)}. Persona: ${sanitizeText(setup.persona_problema)}.`);
      setSucesso('Analise manual pronta.');
      setEtapa('pesquisa');
      return;
    }
    setLoading(true);
    try {
      const data = await callAnthropic({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1500,
        messages: [{ role: 'user', content: `ANALISE PROFUNDA\n\nMARCA: ${sanitizeText(setup.marca)} - ${sanitizeText(setup.nicho)}\nDESCRICAO: ${sanitizeText(setup.descricao_marca)}\nOBJETIVO: ${sanitizeText(setup.objetivo)}\n\nPERSONA:\nNome: ${sanitizeText(setup.persona_nome)}\nProblema: ${sanitizeText(setup.persona_problema)}\nDesejo: ${sanitizeText(setup.persona_desejo)}\nLinguagem: ${sanitizeText(setup.persona_linguagem)}\n\nCONCORRENTES: ${setup.concorrentes.map((item) => sanitizeText(item)).filter(Boolean).join(', ') || 'Nao informado'}\n\nRetorne gaps, padroes, microsegmentos e recomendacoes praticas.` }]
      });
      const text = collectTextBlocks(data);
      if (!text) throw new Error('Resposta vazia na analise.');
      setAnalise(text);
      setSucesso('Analise concluida!');
      setEtapa('pesquisa');
    } catch (error) {
      if (isLowCreditError(error.message)) {
        switchToManualMode('Os creditos da IA acabaram. A analise manual foi ativada automaticamente.');
        setAnalise(`Analise manual pronta para ${sanitizeText(setup.marca)}. Revise nicho, objetivo e persona para seguir com os temas predefinidos.`);
        setEtapa('pesquisa');
      } else {
        setErrors(`Erro na analise: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const gerarTemas = async () => {
    clearMessages();
    if (modo === 'manual') {
      setTemas(formatThemesText(manualThemes));
      setSucesso('Temas manuais gerados!');
      setEtapa('temas');
      return;
    }
    if (!analise) return setErrors('Faca a analise antes de gerar temas.');
    setLoading(true);
    try {
      const data = await callAnthropic({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 1500,
        messages: [{ role: 'user', content: `Baseado nesta analise:\n\n${analise.substring(0, 1800)}\n\nGere 5 temas para a marca ${sanitizeText(setup.marca)} com titulo, tipo, angulo, potencial e resumo.` }]
      });
      const text = collectTextBlocks(data);
      if (!text) throw new Error('Resposta vazia ao gerar temas.');
      setTemas(text);
      setSucesso('5 temas gerados!');
      setEtapa('temas');
    } catch (error) {
      if (isLowCreditError(error.message)) {
        switchToManualMode('Os creditos da IA acabaram. Os temas predefinidos foram ativados.');
        setTemas(formatThemesText(manualThemes));
        setEtapa('temas');
      } else {
        setErrors(`Erro ao gerar temas: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const criarCarrossel = async () => {
    if (!temaSelecionado.trim()) return setErrors('Escolha um tema.');
    clearMessages();
    if (modo === 'manual') {
      const temaManual = manualThemes.find((theme) => theme.titulo === temaSelecionado) || temaSelecionado;
      const design = createManualCarousel({ setup, tema: temaManual });
      setResultado({ marca: setup.marca, tema: typeof temaManual === 'string' ? temaManual : temaManual.titulo, design: design.raw, figma_ready: { frame: { width: 1080, height: 1350 }, slides: design.slides }, paleta_cores: setup.cores_hex, fonte: setup.fonte, tom_voz: setup.tom_voz, timestamp: new Date().toLocaleString('pt-BR'), gerado_por: 'modo_manual' });
      setSucesso('Carrossel manual criado!');
      setEtapa('resultado');
      return;
    }
    setLoading(true);
    try {
      const data = await callAnthropic({
        model: 'claude-3-5-sonnet-latest',
        max_tokens: 2200,
        messages: [{ role: 'user', content: `Crie um carrossel completo. Tema: ${sanitizeText(temaSelecionado)}. Marca: ${sanitizeText(setup.marca)}. Nicho: ${sanitizeText(setup.nicho)}. Objetivo: ${sanitizeText(setup.objetivo)}. Cores: ${setup.cores_hex.join(', ')}. Fonte: ${sanitizeText(setup.fonte)}. Tom de voz: ${sanitizeText(setup.tom_voz)}. Retorne APENAS um JSON valido com slide_1 ate slide_7; cada slide precisa de background_color e elementos; cada elemento precisa de tipo, conteudo, posicao_x, posicao_y, tamanho, cor e font.` }]
      });
      const text = collectTextBlocks(data);
      if (!text) throw new Error('Resposta vazia ao criar carrossel.');
      const design = normalizeDesign(text);
      setResultado({ marca: setup.marca, tema: temaSelecionado, design: design.raw, figma_ready: { frame: { width: 1080, height: 1350 }, slides: design.slides }, paleta_cores: setup.cores_hex, fonte: setup.fonte, tom_voz: setup.tom_voz, timestamp: new Date().toLocaleString('pt-BR'), gerado_por: 'modo_ia' });
      setSucesso('Carrossel criado! JSON validado e pronto para o Figma.');
      setEtapa('resultado');
    } catch (error) {
      if (isLowCreditError(error.message)) {
        switchToManualMode('Os creditos da IA acabaram. O carrossel manual foi gerado automaticamente.');
        const design = createManualCarousel({ setup, tema: temaSelecionado });
        setResultado({ marca: setup.marca, tema: temaSelecionado, design: design.raw, figma_ready: { frame: { width: 1080, height: 1350 }, slides: design.slides }, paleta_cores: setup.cores_hex, fonte: setup.fonte, tom_voz: setup.tom_voz, timestamp: new Date().toLocaleString('pt-BR'), gerado_por: 'modo_manual' });
        setEtapa('resultado');
      } else {
        setErrors(`Erro ao criar carrossel: ${error.message}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const downloadJSON = () => {
    if (!resultado) return;
    const json = JSON.stringify(resultado, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `carrossel-${sanitizeText(setup.marca, 'marca').toLowerCase().replace(/\s+/g, '-')}-${Date.now()}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-black p-6">
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-black text-white mb-2">Sistema Carrossel + Brand Kit</h1>
          <p className="text-slate-400">Funciona com IA quando houver credito e continua util em modo manual.</p>
          <div className="mt-6 flex gap-3 flex-wrap">
            <button type="button" onClick={() => setModo('ia')} className={`px-4 py-2 rounded ${modo === 'ia' ? 'bg-cyan-500 text-white' : 'bg-slate-800 text-slate-300'}`}>Modo IA</button>
            <button type="button" onClick={() => setModo('manual')} className={`px-4 py-2 rounded ${modo === 'manual' ? 'bg-amber-500 text-slate-950' : 'bg-slate-800 text-slate-300'}`}>Modo manual</button>
          </div>
        </div>
        {errors && <div className="mb-6 p-4 bg-red-900/30 border border-red-700 text-red-200 rounded flex items-center gap-2"><AlertCircle className="w-5 h-5 flex-shrink-0" />{errors}</div>}
        {info && <div className="mb-6 p-4 bg-amber-900/30 border border-amber-700 text-amber-200 rounded">{info}</div>}
        {sucesso && <div className="mb-6 p-4 bg-green-900/30 border border-green-700 text-green-200 rounded flex items-center gap-2"><Check className="w-5 h-5 flex-shrink-0" />{sucesso}</div>}
        <div className="bg-slate-900 rounded-lg p-8 border border-slate-700 space-y-8">
          <div className="bg-gradient-to-r from-cyan-900/20 to-blue-900/20 p-6 rounded border border-cyan-600/30">
            <h3 className="text-lg font-semibold text-cyan-400 mb-4">Sua Identidade Visual</h3>
            <p className="text-sm text-slate-300 mb-4">No modo manual, voce pode preencher cores, fonte e tom sem depender da IA.</p>
            {!extractedBrand ? <div><input ref={fileInputRef} type="file" accept=".jpg,.jpeg,.png,.gif,.webp" onChange={handleFileUpload} disabled={loading} multiple className="hidden" /><button onClick={() => fileInputRef.current?.click()} disabled={loading} className="w-full bg-slate-800 border-2 border-dashed border-cyan-600 text-white rounded px-6 py-8 hover:bg-slate-700 transition flex flex-col items-center gap-2 disabled:opacity-50" type="button"><Upload className="w-8 h-8 text-cyan-400" /><div><p className="font-semibold">Selecionar identidade visual</p><p className="text-sm text-slate-400">PNG, JPG, GIF ou WEBP</p></div></button></div> : <div className="bg-green-900/30 border border-green-600 p-4 rounded"><div className="flex items-center justify-between mb-3"><div className="flex items-center gap-2"><Check className="w-5 h-5 text-green-400" /><span className="text-green-400 font-semibold">{brandImages.length} imagem(ns) processada(s)</span></div><button onClick={resetBrandKit} className="text-red-400 hover:text-red-300" type="button"><Trash2 className="w-4 h-4" /></button></div><div className="flex gap-3 flex-wrap">{setup.cores_hex.map((cor, i) => <div key={`${cor}-${i}`} className="flex items-center gap-2"><div className="w-12 h-12 rounded border border-slate-600" style={{ backgroundColor: cor }} /><span className="text-xs text-slate-400 font-mono">{cor}</span></div>)}</div></div>}
          </div>
          <div className="grid gap-3">
            <input type="text" value={setup.marca} onChange={(e) => setSetup({ ...setup, marca: e.target.value })} placeholder="Nome da marca *" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2" />
            <input type="text" value={setup.nicho} onChange={(e) => setSetup({ ...setup, nicho: e.target.value })} placeholder="Seu nicho *" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2" />
            <textarea value={setup.descricao_marca} onChange={(e) => setSetup({ ...setup, descricao_marca: e.target.value })} placeholder="O que sua marca faz?" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2 h-16" />
            <input type="text" value={setup.objetivo} onChange={(e) => setSetup({ ...setup, objetivo: e.target.value })} placeholder="O que quer alcancar? *" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2" />
            <textarea value={setup.persona_problema} onChange={(e) => setSetup({ ...setup, persona_problema: e.target.value })} placeholder="Qual e o problema real dela? *" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2 h-16" />
            <textarea value={setup.persona_desejo} onChange={(e) => setSetup({ ...setup, persona_desejo: e.target.value })} placeholder="Que resultado ela deseja?" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2 h-16" />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">{setup.cores_hex.map((cor, i) => <input key={i} type="text" value={cor} onChange={(e) => { const cores = [...setup.cores_hex]; cores[i] = e.target.value; setSetup({ ...setup, cores_hex: cores }); }} placeholder={`Cor ${i + 1}`} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2 font-mono" />)}</div>
            <input type="text" value={setup.fonte} onChange={(e) => setSetup({ ...setup, fonte: e.target.value })} placeholder="Fonte principal" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2" />
            <input type="text" value={setup.tom_voz} onChange={(e) => setSetup({ ...setup, tom_voz: e.target.value })} placeholder="Tom de voz" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2" />
          </div>
          <div className="grid gap-3 md:grid-cols-3">
            <button onClick={executarAnalise} disabled={loading} className="bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-3 rounded-lg" type="button">{loading ? 'Analisando...' : '1. Gerar analise'}</button>
            <button onClick={gerarTemas} disabled={loading} className="bg-gradient-to-r from-blue-500 to-indigo-600 text-white font-bold py-3 rounded-lg" type="button">2. Gerar temas</button>
            <button onClick={criarCarrossel} disabled={loading || !temaSelecionado.trim()} className="bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2" type="button">{loading ? <Loader className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}3. Criar carrossel</button>
          </div>
          {analise && <div className="bg-slate-800 p-6 rounded border border-slate-600 text-slate-300 text-sm whitespace-pre-wrap">{analise}</div>}
          {temas && <div className="space-y-4"><div className="bg-slate-800 p-6 rounded border border-slate-600 text-slate-300 text-sm whitespace-pre-wrap">{temas}</div><select value={temaSelecionado} onChange={(e) => setTemaSelecionado(e.target.value)} className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-3"><option value="">Escolha um tema</option>{manualThemes.map((theme) => <option key={theme.id} value={theme.titulo}>{theme.titulo}</option>)}</select><textarea value={temaSelecionado} onChange={(e) => setTemaSelecionado(e.target.value)} placeholder="Cole ou escreva o tema escolhido aqui" className="w-full bg-slate-800 border border-slate-600 text-white rounded px-4 py-2 h-20" /></div>}
          {resultado && <div className="space-y-4"><div className="bg-green-900/20 border border-green-600 p-6 rounded"><h3 className="text-green-400 font-bold mb-2">Carrossel criado</h3><p className="text-slate-300">Gerado por: <strong>{resultado.gerado_por}</strong></p></div><button onClick={downloadJSON} className="w-full bg-gradient-to-r from-cyan-500 to-blue-600 text-white font-bold py-4 rounded-lg flex items-center justify-center gap-2 text-lg" type="button"><Download className="w-5 h-5" />Baixar design specs em JSON</button></div>}
        </div>
      </div>
    </div>
  );
}
