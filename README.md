# EV ChargeOps — Plataforma de Gestão de Recarga Compartilhada

**Enterprise Challenge 2026 — GoodWe × FIAP**
Sprint 01 — Pesquisa e Documentação

**Integrante:** Vitor Kubica Silveira — RM: 573465

---

## 1. O Problema

O Brasil atravessa um crescimento acelerado da frota de veículos elétricos. Segundo a ABVE, foram emplacados 705.648 veículos eletrificados desde 2012 até março de 2026, com 2025 sendo o ano recorde (223.912 emplacamentos) e 2026 já superando esse ritmo com 83.947 unidades nos três primeiros meses. São Paulo lidera com 181.305 veículos eletrificados ativos.

A infraestrutura de recarga, porém, não acompanha esse crescimento com a mesma capilaridade. Em setembro de 2025, o Brasil contava com 16.880 eletropostos públicos e semipúblicos — e a maior parte da demanda por recarga acontece em ambientes privados: condomínios, edifícios corporativos e campi universitários.

Nesse contexto, a GoodWe mantém no campus da FIAP (Energy Innovation Lab — Unidade 2, Aclimação) um carregador HCA G2 instalado no estacionamento L1. O equipamento é real, gera dados a cada sessão e não possui hoje nenhum sistema que transforme esses dados em inteligência operacional: não há histórico por usuário, não há cálculo de consumo individual, não há rateio automatizado e não há interface de acompanhamento para o gestor do espaço.

O EV ChargeOps propõe preencher exatamente essa lacuna: transformar cada sessão de recarga em um dado estruturado e, a partir daí, gerar rateio justo e inteligência acionável para gestores e usuários de infraestruturas de recarga compartilhada.

---

## 2. Frente 1 — Contexto e Problema

### 2.1 Infraestruturas de recarga compartilhada

Uma infraestrutura de recarga compartilhada é um conjunto de um ou mais carregadores instalados em área comum ou de uso coletivo, acessados por múltiplos usuários que dividem tanto a infraestrutura física quanto, em geral, a fatura de energia elétrica associada.

Os desafios operacionais mais comuns enfrentados por gestores são:

- **Ausência de medição individual:** a fatura de energia elétrica chega para o condomínio como um todo; sem sub-medição, é impossível saber quem consumiu o quê.
- **Conflitos de agenda:** múltiplos usuários precisam de recarga ao mesmo tempo, mas há menos pontos do que veículos.
- **Falta de visibilidade:** gestores não sabem se o carregador está em uso, com falha ou ocioso sem ir fisicamente até o equipamento.
- **Cobrança manual e imprecisa:** sem automação, a cobrança se baseia em estimativas, gerando atritos entre moradores.
- **Escalabilidade:** adicionar novos carregadores sem um sistema de gestão multiplica os problemas acima.

### 2.2 O que acontece em uma sessão de recarga

Do ponto de vista técnico, uma sessão de recarga passa pelas seguintes etapas:

1. **Conexão:** o usuário conecta o cabo ao veículo e ao carregador. O carregador detecta a presença do veículo via sinal de piloto (CP — Control Pilot), protocolo definido pela IEC 61851.
2. **Autenticação:** em carregadores inteligentes (como o HCA G2), o usuário pode se autenticar via RFID, aplicativo (SEMS+) ou plug-and-charge.
3. **Negociação de potência:** o carregador comunica ao veículo a corrente disponível; o veículo aceita ou solicita menos, dependendo do estado de carga de sua bateria.
4. **Transferência de energia:** a energia flui do carregador para o veículo. O carregador monitora continuamente a potência entregue (kW) e integra o total em kWh.
5. **Encerramento:** o usuário desconecta o cabo (ou solicita parada via app); o carregador registra fim da sessão, duração total e energia entregue.

Dados gerados por sessão: `timestamp_início`, `timestamp_fim`, `duração (min)`, `energia entregue (kWh)`, `potência média (kW)`, `potência de pico`, `usuário/token de autenticação`, `status de encerramento`.

### 2.3 Modelos de negócio para recarga compartilhada

| Modelo | Descrição | Adequado para |
|---|---|---|
| Gratuito | O custo vai para a conta comum do condomínio/empresa | Frotas corporativas pequenas |
| Cobrança por kWh | Usuário paga pelo volume de energia consumida | Mais justo; exige sub-medição |
| Cobrança por tempo | Tarifa por minuto conectado, independente do consumo | Simples, mas injusto |
| Assinatura mensal | Taxa fixa mensal com limite de kWh | Previsibilidade para o gestor |
| Rateio condominial | Custo dividido entre usuários pela proporção de uso | Campus/condomínios com CNPJ único |

### 2.4 Análise de mercado — Opção A

**Neocharge**
A Neocharge é uma das principais players brasileiras, com foco em condomínios e frotas. Oferece plataforma de gestão com monitoramento em tempo real, relatórios de consumo, alertas de falha e controle de acesso via RFID e aplicativo. Seus carregadores suportam OCPP 1.6 e comunicação via Wi-Fi/4G. A limitação principal é que o modelo de rateio depende de integração manual com a administração do condomínio — não há geração automática de fatura por unidade.

**ChargePoint**
Plataforma norte-americana com mais de 35 mil pontos de recarga gerenciados. Funcionalidades: autenticação por RFID ou app, relatórios detalhados por sessão, faturamento por kWh ou por tempo, integração com sistemas corporativos via API REST documentada. A limitação para o contexto brasileiro é o custo elevado de hardware e a ausência de suporte nativo a rateio condominial no modelo brasileiro.

**Zaptec**
Solução norueguesa voltada para edifícios residenciais e corporativos. Destaque para o sistema de load balancing dinâmico entre múltiplos carregadores, que distribui automaticamente a capacidade disponível da rede elétrica entre os veículos em carga simultânea. O modelo de cobrança é por kWh medido individualmente, com faturamento direto ao usuário. Limitação: sem presença comercial estabelecida no Brasil.

**O que o EV ChargeOps precisa fazer diferente:** nenhuma das soluções analisadas oferece IA como componente ativo na geração de insights. Neocharge e ChargePoint geram relatórios históricos, mas não produzem previsões, detectam anomalias ou sugerem otimizações de agendamento. Além disso, o contexto de campus universitário com carregador GoodWe HCA G2 específico exige integração direta com a API SEMS, que nenhuma plataforma genérica endereça nativamente.

---

## 3. Frente 2 — Base Regulatória e Técnica

### 3.1 Resolução Normativa ANEEL nº 1.000/2021

A RN 1.000/2021 consolidou 61 normas anteriores da ANEEL, incluindo a RN 819/2018 (primeira regulamentação específica sobre recarga de veículos elétricos no Brasil). O Capítulo V trata exclusivamente das instalações de recarga.

Pontos centrais para o EV ChargeOps:

- **Exploração comercial permitida:** qualquer interessado pode realizar atividades de recarga com preços livremente negociados (Art. 9º da RN 819/2018, mantido na RN 1.000). Isso valida o modelo de cobrança por kWh proposto pela plataforma.
- **Comunicação prévia à distribuidora:** o Art. 550 da RN 1.000/2021 exige que toda instalação de estação de recarga seja comunicada previamente à distribuidora quando, individualmente ou em conjunto com outros equipamentos, resulte em alteração do nível de tensão ou demanda significativa. Para o campus da FIAP com um único HCA G2 (máx. 22 kW), isso implica verificação junto à Enel SP.
- **Protocolos abertos:** a norma reforça a necessidade de protocolos abertos de comunicação para equipamentos não exclusivos de uso privado. O HCA G2 suporta OCPP 1.6, que atende a esse requisito.
- **Vedação à injeção na rede:** é vedada a injeção de energia elétrica proveniente do veículo na rede de distribuição (V2G não regulamentado no Brasil).

### 3.2 Carregador GoodWe HCA G2 — Interfaces e capacidades

O HCA G2 é o carregador instalado no estacionamento L1 da FIAP. Suas interfaces de comunicação são:

**RS-485:** protocolo serial usado para comunicação com inversores fotovoltaicos GoodWe e com medidores MID (Mid Interval Data). Permite integração local para troca de dados de potência e estado de carga. Útil para ambientes com infraestrutura PV instalada (caso do Energy Innovation Lab).

**LAN (Ethernet):** conexão cabeada com o roteador local. Oferece comunicação mais estável que Wi-Fi para ambientes de campus onde a qualidade do sinal wireless pode variar.

**Wi-Fi:** conexão sem fio para comunicação com o roteador e, via internet, com a plataforma SEMS. Adequado para instalações onde cabeamento não é viável.

**Bluetooth:** usado para configuração inicial via aplicativo SolarGo durante o comissionamento. Não é relevante para integração contínua com a plataforma.

**RFID:** suporte a cartões de autenticação para controle de acesso. Cada cartão identifica um usuário, permitindo associar sessões a pessoas sem necessidade de aplicativo.

O carregador suporta três modos de carga configuráveis: Fast (prioridade na velocidade, usa rede + PV + bateria), PV Priority (usa primeiro energia solar excedente) e PV + Battery Priority (máximo aproveitamento da geração local).

### 3.3 API GoodWe SEMS — Exploração — Opção B

A GoodWe disponibiliza acesso à sua API via SEMS Portal (semsportal.com / semsplus.goodwe.com). Não existe documentação pública completa, mas a API foi amplamente mapeada pela comunidade de desenvolvedores (projetos open-source para Home Assistant, Node-RED, etc.).

**Autenticação:** a API utiliza token JWT obtido via endpoint de CrossLogin:

```
POST https://www.semsportal.com/api/v1/Common/CrossLogin
Header: Token: {"version":"v2.1.0","client":"ios","language":"en"}
Body: {"account": "<email>", "pwd": "<senha>"}
```

O token retornado deve ser incluído (em Base64) no header de todas as requisições subsequentes.

**Endpoints identificados para o EV Charger:**

```
GET https://semsportal.com/powerstation/EvChargerDetail?stationId={station_id}
```
Retorna status atual do carregador, incluindo campos: `evChargerStatus`, `power` (kW em tempo real), dados da sessão ativa.

```
GET https://www.semsportal.com/api/v3/EvCharger/GetCurrentChargeinfo
```
Informações da sessão de carga em andamento: usuário, energia entregue até o momento, tempo de sessão.

```
GET https://eu.semsportal.com/api/v4/EvCharger/GetEvChargerMoreView
```
Endpoint mais detalhado disponível na versão v4 da API, com dados históricos e de configuração.

**Estrutura de resposta (JSON):**
```json
{
  "hasError": false,
  "code": 0,
  "msg": "Successful",
  "data": {
    "evChargerStatus": 2,
    "power": 7.2,
    "totalEnergy": 145.8,
    "sessionEnergy": 12.4,
    "sessionDuration": 98
  }
}
```

**Limitação crítica:** a documentação oficial da GoodWe para a API é restrita a contas organizacionais SEMS (Open API) ou a parceiros com acordo de licenciamento (Real-time Data API). Para o escopo do projeto, a integração será via conta SEMS vinculada ao equipamento da FIAP, com scraping da API não documentada como fallback para prototipação.

### 3.4 APIs Complementares — Opção C

**Open Charge Map API**
REST API pública que fornece dados de mais de 45.000 estações de recarga em todo o mundo, incluindo Brasil. Útil para enriquecer a plataforma com contexto geográfico (densidade de eletropostos na região do usuário) e para comparação de tarifas.

Endpoint principal: `GET https://api.openchargemap.io/v3/poi/?output=json&countrycode=BR&maxresults=100`
Retorna: localização, operador, tipo de conector, potência, status de operação.

**ANEEL Open Data**
Portal `dadosabertos.aneel.gov.br` disponibiliza datasets sobre concessões de distribuição, tarifas por distribuidora e informações sobre outorgas. Relevante para calcular o custo do kWh da distribuidora local (Enel SP) e atualizar automaticamente a tarifa base do rateio.

Endpoint de tarifas: disponível via CKAN API do portal de dados abertos do governo federal.

---

## 4. Frente 3 — Arquitetura e IA

### 4.1 Camadas da plataforma

**Camada Física**
O carregador GoodWe HCA G2 instalado no estacionamento L1 da FIAP. É o ponto de captura de dados: gera eventos de início/fim de sessão, leituras de potência a cada intervalo e registros de autenticação RFID.

**Camada de Conectividade**
O HCA G2 conecta-se via LAN/Wi-Fi ao roteador do campus e de lá à internet, reportando dados ao SEMS Portal da GoodWe. A plataforma EV ChargeOps acessa esses dados via API SEMS (polling a cada intervalo configurável). Como protocolo alternativo local, o OCPP 1.6 permite integração direta sem depender da nuvem GoodWe.

**Camada de Aplicação (Back-end)**
Serviço Node.js responsável por: coletar dados da API SEMS, enriquecer e persistir sessões no banco de dados, executar o modelo de rateio ao fim de cada ciclo (mensal), acionar os módulos de IA para análise e previsão, e disponibilizar uma API REST para o front-end.

**Camada de IA**
Módulo independente (Python/FastAPI ou integrado ao Node.js via biblioteca) responsável por detecção de anomalias, clustering de perfis de uso e previsão de demanda. Detalhado na seção 4.3.

**Camada de Apresentação**
Dois painéis distintos:
- **Painel do gestor:** visão agregada de todas as sessões, consumo total por período, alertas de anomalia, fatura consolidada por usuário, indicadores de uso (taxa de ocupação, pico, ociosidade).
- **App do usuário:** histórico de sessões individuais, fatura do mês, agendamento de recarga, notificações de início/fim de sessão.

### 4.2 Fluxo de dados — da sessão à fatura

```
[Veículo conectado]
        |
        v
[HCA G2 registra início de sessão]
        |
        v
[SEMS Portal recebe dados via LAN/Wi-Fi]
        |
        v
[EV ChargeOps coleta via API SEMS (polling 60s)]
        |
        v
[Persistência no banco: tabela sessions]
    campos: user_id, start_at, end_at, energy_kwh, peak_power_kw
        |
        v
[Fim do ciclo mensal]
        |
        v
[Motor de rateio calcula fatura por usuário]
    base: Σ energy_kwh × tarifa_kwh + Σ demanda_pico × fator_demanda
        |
        v
[Módulo IA analisa padrões e anomalias]
        |
        v
[Fatura gerada e disponibilizada no app]
        |
        v
[Gestor aprova e envia para cobrança]
```

### 4.3 Papel da IA na solução — Opção B

A IA no EV ChargeOps não é decorativa. Ela opera em três frentes concretas, cada uma com problema definido, técnica aplicável e dados necessários:

**IA 1 — Detecção de anomalias em sessões**

Problema: sessões com duração atípica, consumo incompatível com o veículo do usuário ou eventos de interrupção anormal podem indicar falha no equipamento, uso indevido ou erro de medição — tudo isso impacta diretamente o rateio.

Técnica: Isolation Forest ou LSTM Autoencoder para detecção de outliers em séries temporais de sessão (duração, kWh/hora, potência).

Dados necessários: histórico de sessões do usuário (mínimo 30 dias para calibração), especificações técnicas do veículo (capacidade de bateria, aceitação máxima de corrente).

Impacto esperado: redução de erros de faturamento por sessões corrompidas; alertas automáticos para manutenção preventiva do carregador.

**IA 2 — Clustering de perfis de uso**

Problema: gestores precisam entender como diferentes usuários utilizam a infraestrutura para dimensionar expansões, definir políticas de agendamento e comunicar de forma personalizada.

Técnica: K-Means ou DBSCAN sobre vetores de features por usuário (horário preferencial, duração média de sessão, frequência semanal, energia média por sessão).

Dados necessários: histórico de sessões por usuário (mínimo 60 dias).

Impacto esperado: segmentação automática em perfis (ex: "carregador noturno intensivo", "recarga rápida esporádica", "uso em horário de pico") que informam políticas de preço e agendamento.

**IA 3 — Previsão de demanda**

Problema: o gestor precisa saber antecipadamente quando o carregador estará saturado para planejar expansão ou redistribuir demanda.

Técnica: Regressão com features temporais (dia da semana, feriados, sazonalidade) ou Prophet (modelo de série temporal do Facebook, adequado a dados com padrões semanais).

Dados necessários: histórico de sessões com timestamps, calendário acadêmico da FIAP, dados climáticos (opcional, para correlação com uso).

Impacto esperado: previsão de ocupação para os próximos 7 dias com intervalo de confiança, permitindo comunicação proativa ao gestor quando saturação for provável.

### 4.4 Modelo de rateio proposto — Opção A

Após análise de dois modelos praticados por condomínios que já adotaram carregadores compartilhados, a equipe optou pelo **rateio proporcional por kWh com componente de demanda**.

**Modelo A — Rateio igualitário (rejeitado):** divide o custo total de energia do mês igualmente entre todos os usuários ativos, independente do consumo individual. Vantagem: extremamente simples. Desvantagem: profundamente injusto — um usuário que carregou 5 kWh paga o mesmo que quem carregou 80 kWh.

**Modelo B — Rateio proporcional por kWh (adotado):** cada usuário paga proporcionalmente ao volume de energia que consumiu no mês, mais uma parcela fixa correspondente à demanda de pico que gerou na rede do condomínio.

**Fórmula:**

```
Fatura_usuário = (energy_kwh_usuário / energy_kwh_total) × custo_energia_mês
              + (peak_kw_usuário / peak_kw_total) × custo_demanda_mês
              + taxa_fixa_plataforma
```

**Variáveis:**
- `energy_kwh_usuário`: soma da energia consumida pelo usuário no mês (extraída das sessões)
- `energy_kwh_total`: soma de todos os usuários no mesmo ciclo
- `custo_energia_mês`: valor da fatura de energia elétrica do período
- `peak_kw_usuário`: maior valor de potência instantânea registrado pelo usuário no mês
- `peak_kw_total`: soma dos picos individuais (proxy para contribuição na demanda máxima)
- `custo_demanda_mês`: parcela de demanda da fatura (quando aplicável na tarifa)
- `taxa_fixa_plataforma`: custo de operação da plataforma, dividido pelo número de usuários ativos

**Casos excepcionais:**
- **Sessão interrompida:** sessões com status `interrupted` são incluídas no rateio normalmente pelo kWh efetivamente entregue até a interrupção.
- **Usuário sem recarga no mês:** não aparece na fatura; não paga taxa variável. A taxa fixa é cobrada apenas de usuários com ao menos uma sessão no mês.
- **Dois veículos da mesma unidade:** cada veículo tem RFID próprio e é tratado como usuário distinto. A fatura da unidade é a soma das faturas dos dois tokens.

### 4.5 Esquema da base de dados — Opção C

**Entidade: users**
```sql
CREATE TABLE users (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  email       TEXT UNIQUE NOT NULL,
  unit        TEXT,              -- ex: "Bloco A - Vaga 12" ou "FIAP - Sala 201"
  rfid_token  TEXT UNIQUE,       -- token do cartão RFID
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
```

**Entidade: sessions**
```sql
CREATE TABLE sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id         UUID REFERENCES users(id),
  charger_id      TEXT NOT NULL,          -- serial number do HCA G2
  start_at        TIMESTAMPTZ NOT NULL,
  end_at          TIMESTAMPTZ,
  energy_kwh      NUMERIC(8,3),           -- kWh entregues
  peak_power_kw   NUMERIC(6,3),           -- potência de pico na sessão
  avg_power_kw    NUMERIC(6,3),
  status          TEXT DEFAULT 'completed', -- completed | interrupted | error
  raw_sems_data   JSONB                   -- payload bruto da API para auditoria
);
```

**Entidade: billing_cycles**
```sql
CREATE TABLE billing_cycles (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period_start    DATE NOT NULL,
  period_end      DATE NOT NULL,
  total_kwh       NUMERIC(10,3),
  total_cost_brl  NUMERIC(10,2),
  tariff_kwh      NUMERIC(6,4),           -- R$/kWh no período
  status          TEXT DEFAULT 'open'     -- open | closed | paid
);
```

**Entidade: invoices**
```sql
CREATE TABLE invoices (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  cycle_id        UUID REFERENCES billing_cycles(id),
  user_id         UUID REFERENCES users(id),
  energy_kwh      NUMERIC(8,3),
  energy_cost_brl NUMERIC(8,2),
  demand_cost_brl NUMERIC(8,2),
  platform_fee    NUMERIC(6,2),
  total_brl       NUMERIC(8,2),
  generated_at    TIMESTAMPTZ DEFAULT NOW(),
  status          TEXT DEFAULT 'pending'  -- pending | sent | paid
);
```

**Registros simulados:**
```json
// Sessão completa
{
  "id": "a1b2c3d4-...",
  "user_id": "u001",
  "charger_id": "GW22K-HCA-20-BR001",
  "start_at": "2026-06-10T22:15:00Z",
  "end_at": "2026-06-11T01:45:00Z",
  "energy_kwh": 28.4,
  "peak_power_kw": 22.0,
  "avg_power_kw": 8.1,
  "status": "completed"
}

// Fatura do mês
{
  "cycle": "2026-06",
  "user": "João Silva",
  "energy_kwh": 142.7,
  "energy_cost_brl": 142.70,
  "demand_cost_brl": 18.50,
  "platform_fee": 5.00,
  "total_brl": 166.20
}
```

---

## 5. Diagrama de Arquitetura

OBS:  A Imagem em png está no repositório

```
┌─────────────────────────────────────────────────────────────────┐
│                        CAMADA FÍSICA                            │
│              GoodWe HCA G2 (FIAP — Estacionamento L1)           │
│         RS-485 | LAN | Wi-Fi | RFID | Bluetooth                 │
└───────────────────────────┬─────────────────────────────────────┘
                            │ LAN / Wi-Fi
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE CONECTIVIDADE                       │
│                  GoodWe SEMS Portal (nuvem)                     │
│     semsportal.com — API v3/v4 — JSON sobre HTTPS               │
└───────────────────────────┬─────────────────────────────────────┘
                            │ REST API (polling 60s)
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    CAMADA DE APLICAÇÃO                           │
│                                                                 │
│  ┌─────────────────┐    ┌──────────────────────────────────┐   │
│  │  Collector      │    │        API REST (Node.js)         │   │
│  │  (Node.js)      │───▶│  /sessions  /invoices  /users    │   │
│  │  Polling SEMS   │    │  /analytics  /billing             │   │
│  └────────┬────────┘    └──────────────────────────────────┘   │
│           │                              │                      │
│           ▼                              ▼                      │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              PostgreSQL (Supabase / Fly.io)               │  │
│  │   users | sessions | billing_cycles | invoices            │  │
│  └──────────────────────────────────────────────────────────┘  │
│           │                                                     │
│           ▼                                                     │
│  ┌─────────────────┐                                           │
│  │  Módulo IA      │                                           │
│  │  (Python)       │                                           │
│  │  • Anomalias    │                                           │
│  │  • Clustering   │                                           │
│  │  • Previsão     │                                           │
│  └─────────────────┘                                           │
└───────────────────────────┬─────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                   CAMADA DE APRESENTAÇÃO                         │
│                                                                 │
│   ┌─────────────────────┐    ┌─────────────────────────────┐   │
│   │   Painel do Gestor  │    │      App do Usuário          │   │
│   │   (React / Next.js) │    │   (React Native / Expo)      │   │
│   │   Dashboard global  │    │   Histórico + Fatura         │   │
│   │   Alertas e IA      │    │   Agendamento                │   │
│   └─────────────────────┘    └─────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
```

---

## 6. Plano para a Sprint 02

A sprint 02 será desenvolvida em três fases, nessa ordem:

**Fase 1 — Infraestrutura e coleta (semanas 1–2)**
- Configurar banco de dados PostgreSQL (Supabase) com o esquema definido
- Implementar o Collector: serviço Node.js que autentica na API SEMS, faz polling a cada 60 segundos e persiste sessões
- Criar endpoints REST básicos: `GET /sessions`, `GET /users`, `POST /sessions`
- Testes de integração com o HCA G2 real da FIAP

**Fase 2 — Motor de rateio e back-end (semanas 3–5)**
- Implementar o motor de rateio: RPC ou job agendado que calcula faturas ao fechar um ciclo
- Endpoints de billing: `GET /billing-cycles`, `POST /billing-cycles/:id/close`, `GET /invoices/:user_id`
- Interface do gestor: painel web com React/Next.js mostrando sessões do dia, consumo acumulado e status do carregador

**Fase 3 — IA e apresentação final (semanas 6–10)**
- Implementar detecção de anomalias com Isolation Forest (sklearn) sobre o histórico de sessões
- Implementar clustering de perfis de uso com K-Means
- Interface do usuário: tela de histórico, fatura do mês, notificações push
- Integração dos insights de IA no painel do gestor
- Preparação do vídeo pitch

**Stack tecnológico:**
- Back-end: Node.js + TypeScript + Fastify
- Banco de dados: PostgreSQL (Supabase) com pgvector para embeddings futuros
- IA: Python + scikit-learn + Prophet
- Front-end gestor: React + Next.js
- App usuário: React Native + Expo
- Deploy: Fly.io (back-end e IA) + Vercel (front-end)
- Observabilidade: Datadog para logs e métricas do Collector

---

## 7. Fontes Consultadas

- ABVE. Dados de emplacamentos de veículos eletrificados no Brasil 2025–2026. Disponível em: abve.org.br
- Canal VE. Frota de eletrificados no Brasil ultrapassa 700 mil unidades. Abril/2026. Disponível em: canalve.com.br
- Reconecta News. Veículos eletrificados no Brasil podem chegar a 300 mil vendas em 2026. Março/2026.
- ANEEL. Resolução Normativa nº 1.000, de 7 de dezembro de 2021. Disponível em: gov.br/aneel
- ANEEL. Da instalação de estação de recarga (RN 819/2018 — texto mantido na RN 1.000). Disponível em: aneel.gov.br
- GoodWe. HCA G2 Series EV Charger — Datasheet e User Manual V1.5, 2025. Disponível em: goodwe.com
- GoodWe. API Technical Document (SA-E-20221031-001). Disponível em: community.goodwe.com
- Karunanayake, B. Accessing GoodWe SEMS Portal API: A Comprehensive Guide. Medium, 2024.
- GitHub: TimSoethout/goodwe-sems-home-assistant — discussão sobre endpoints da API EV Charger.
- NeoCharge. Plataforma de Gestão de Recarga. Disponível em: neocharge.com.br
- Energisa. NDU 042 — Fornecimento de energia para estações de recarga de veículo elétrico. Fev/2025.
- Open Charge Map API. Documentação REST. Disponível em: openchargemap.org/site/develop
- VoltBras. Legislação brasileira sobre eletropostos: o que saber antes de investir. Fev/2026.
