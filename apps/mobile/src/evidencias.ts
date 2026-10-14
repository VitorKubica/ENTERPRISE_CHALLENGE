import type { ImageSourcePropType } from 'react-native';

/** Capturas do protótipo rodando (iPhone 17, simulador iOS). A mesma lista alimenta a aba e o README. */
export interface Evidencia {
  source: ImageSourcePropType;
  title: string;
  caption: string;
}
export interface GrupoEvidencia {
  title: string;
  items: Evidencia[];
}

export const EVIDENCIAS: GrupoEvidencia[] = [
  {
    title: 'Início e leitura do QR code',
    items: [
      { source: require('../assets/evidencias/01-inicio-leitor-qr.png'), title: 'Início: leitor de QR no topo', caption: 'Leitor de QR code e a economia do morador. O simulador não tem câmera, então o app avisa; em celular a leitura é real.' },
      { source: require('../assets/evidencias/02-inicio-dica-perfil-previsao.png'), title: 'Dica do morador (IA 2 e IA 3)', caption: 'O perfil de uso do morador (K-Means) e a previsão de ocupação de amanhã viram uma dica: "Carrega com o sol" e a melhor hora para carregar.' },
      { source: require('../assets/evidencias/03-lista-carregadores.png'), title: 'Carregadores do prédio', caption: 'Lista com os usados por último primeiro. O Carregador 2 aparece em uso por outro morador.' },
      { source: require('../assets/evidencias/04-qr-erro-voltar.png'), title: 'Erro na leitura, com botão Voltar', caption: 'QR de um carregador em uso: o app explica, indica um carregador livre e oferece o botão Voltar.' },
      { source: require('../assets/evidencias/05-qr-lido-escolher-carro.png'), title: 'QR lido: escolher o carro', caption: 'Ao ler o QR de um carregador livre, o app pergunta qual carro vai carregar (o morador tem dois).' },
    ],
  },
  {
    title: 'Recarga e origem da energia',
    items: [
      { source: require('../assets/evidencias/06-recarga-ao-vivo.png'), title: 'Carregando agora', caption: 'Recarga ao vivo no Carregador 1 com o BYD Dolphin: 100% da energia vinda do sol nos primeiros minutos.' },
      { source: require('../assets/evidencias/07-recarga-ao-vivo-mistura.png'), title: 'Origem mudando ao longo do dia', caption: 'Com a tarde avançando na simulação, a rede e a bateria entram na mistura (66% sol, 3% bateria, 31% rede).' },
      { source: require('../assets/evidencias/08-detalhe-origem-energia.png'), title: 'De onde veio a energia do seu carro', caption: 'Detalhe da recarga: kWh de sol, bateria e rede, quanto custou e quanto o morador economizou frente ao eletroposto público.' },
    ],
  },
  {
    title: 'Perfil',
    items: [
      { source: require('../assets/evidencias/09-perfil-cadastro.png'), title: 'Cadastro', caption: 'Dados do morador, abertos pelo avatar no topo da Início.' },
      { source: require('../assets/evidencias/10-perfil-apartamentos.png'), title: 'Apartamentos', caption: 'O morador tem dois apartamentos (proprietário e inquilino) e pode adicionar outros.' },
      { source: require('../assets/evidencias/11-perfil-carros-integracao.png'), title: 'Carros e integração', caption: 'BYD já conectada ao app da montadora (bateria e autonomia). A Renault pode ser conectada pelo botão.' },
      { source: require('../assets/evidencias/12-perfil-carro-conectado.png'), title: 'Carro conectado', caption: 'Depois de conectar o Renault, o app passa a mostrar a bateria dele também.' },
    ],
  },
  {
    title: 'Recargas e fatura',
    items: [
      { source: require('../assets/evidencias/13-fatura-economia-e-revisao.png'), title: 'Economia, aviso de revisão e fatura (IA 1)', caption: 'Recargas e fatura na mesma página. A IA reteve uma recarga com falha do carregador: ela não entra na fatura até o gestor conferir.' },
      { source: require('../assets/evidencias/14-fatura-por-apartamento.png'), title: 'Fatura por apartamento', caption: 'A fatura é dividida pelo carro que carregou. A recarga feita ao vivo já aparece no topo da lista.' },
      { source: require('../assets/evidencias/15-recargas-lista-em-revisao.png'), title: 'Recarga em revisão', caption: 'A recarga retida pela IA fica marcada como "Em revisão" na lista do morador.' },
    ],
  },
  {
    title: 'Painel do gestor',
    items: [
      { source: require('../assets/evidencias/16-gestor-economia-e-retencao.png'), title: 'Economia e cobrança retida', caption: 'Economia dos moradores com o sistema compartilhado e o primeiro alerta: recargas retidas pela IA antes de cobrar.' },
      { source: require('../assets/evidencias/17-gestor-insights.png'), title: 'Insights', caption: 'Sobrecarga, saturação e a conta de expansão: o que a infra atual não comporta e quanto custa atender a fila.' },
      { source: require('../assets/evidencias/18-gestor-picos-sobrecarga.png'), title: 'Horários de pico e sobrecarga', caption: 'Demanda simultânea por hora contra o limite do circuito (barras laranja passaram dele) e ocupação dos carregadores.' },
      { source: require('../assets/evidencias/19-gestor-ocupacao-distribuicao.png'), title: 'Ocupação e origem da energia', caption: 'Esperas e desistências por falta de vaga, e o mix de energia dos últimos 14 dias.' },
      { source: require('../assets/evidencias/20-gestor-por-carregador-morador.png'), title: 'Distribuição por carregador e morador', caption: 'Uso de cada carregador e quem mais consome energia.' },
      { source: require('../assets/evidencias/21-gestor-investimento.png'), title: 'Vale investir em mais carregadores?', caption: 'Capacidade atual contra a fila de espera e a comparação de custo entre carregadores compartilhados e individuais.' },
      { source: require('../assets/evidencias/22-gestor-ia-recargas-retidas.png'), title: 'IA 1: recarga retida para conferir', caption: 'Leitura de 136 kWh em 2h, fisicamente impossível para o carro: a IA segura a cobrança (R$ 115,51) até o gestor liberar ou descartar.' },
      { source: require('../assets/evidencias/23-gestor-ia-decisao-descartada.png'), title: 'IA 1: decisão do gestor', caption: 'Depois de descartar, a recarga sai dos totais: o faturado voltou de R$ 2.683,84 para R$ 2.568,34 e a energia de 3.313 para 3.177 kWh.' },
      { source: require('../assets/evidencias/24-gestor-ia-perfis-rede.png'), title: 'IA 2: perfis e quem puxa da rede', caption: 'Moradores agrupados pelo jeito de usar (K-Means) e a parcela de energia da rede de cada perfil, para direcionar o incentivo ao horário solar.' },
      { source: require('../assets/evidencias/25-gestor-ia-previsao.png'), title: 'IA 3: previsão de 7 dias', caption: 'Ocupação esperada, pico e melhor hora para carregar com o sol. É a mesma previsão que vira a dica do morador.' },
    ],
  },
];

export const VERIFICACOES = [
  '19 testes automatizados passando (atribuição de origem, rateio, capacidade e os três módulos de IA).',
  'Build e typecheck dos 3 pacotes pelo Turborepo, sem erros.',
  'Capturas feitas no iPhone 17 (simulador iOS) com a API local rodando.',
];
