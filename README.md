# Recife Hub 

<div align="center">

![IHC](https://img.shields.io/badge/IHC-8A2BE2)
![HTML5](https://img.shields.io/badge/HTML5-E34F26?style=for-the-badge&logo=html5&logoColor=white)
![CSS3](https://img.shields.io/badge/CSS3-1572B6?style=for-the-badge&logo=css3&logoColor=white)
![JavaScript](https://img.shields.io/badge/JavaScript-F7DF1E?style=for-the-badge&logo=javascript&logoColor=black)

**Um aplicativo web para consulta de rotas e informações sobre ônibus na Região Metropolitana do Recife**

[Figma](https://www.figma.com/design/WdL33TlumsLD0NHB8VE1ny?node-id=0-1) • [Demo](https://recifehub.onrender.com/) • [Documentação](https://docs.google.com/document/d/1Vet2f3un0zViOiNetQozAyKT3chbyx8BXqMXaEzAjyY/edit?usp=sharing)

</div>

## O Problema

Os aplicativos de rotas de ônibus disponíveis atualmente apresentam interfaces com baixa usabilidade, excesso de anúncios que competem com o conteúdo principal, tempo de carregamento elevado e informações insuficientes sobre linhas e trajetos. O impacto é mais expressivo para usuários iniciantes, pessoas que utilizam o transporte coletivo ocasionalmente e precisam de informações claras sobre trajetos e destinos sem familiaridade prévia com a ferramenta.

## Público-Alvo

Pessoas de diferentes faixas etárias que utilizam ou desejam utilizar o transporte público na região metropolitana do Recife, com ênfase em usuários iniciantes que se deslocam de ônibus de forma ocasional e precisam de informações claras para concluir seu deslocamento com segurança.

## Protótipo

[Figma](https://www.figma.com/design/WdL33TlumsLD0NHB8VE1ny?node-id=0-1) • [Aplicação](https://recifehub.onrender.com/) • [Repositório](https://github.com/LucazinnDEV/projetoIHC)

## Funcionalidades

- Mapa interativo com visualização das rotas de ônibus
- Busca de linhas com histórico das últimas consultas
- Informações detalhadas de cada linha: tarifa, frequência, acessibilidade, ar-condicionado e integração com o metrô
- Informações dos terminais: galeria de imagens, linhas disponíveis e estrutura local
- Sistema de favoritos persistido via localStorage
- Assistente de IA para dúvidas em linguagem natural
- Página de listagem de linhas com galeria de imagens dos ônibus
- Suporte a Libras via widget VLibras
- Estados de sistema: carregamento, erro com retry, selecionado, vazio e sucesso

## Justificativa das Escolhas de Design

As decisões de design foram fundamentadas nos seguintes conceitos de IHC:

- **Heurísticas de Nielsen**: visibilidade do estado do sistema, prevenção de erros, controle e liberdade do usuário e recuperação de erros guiaram as decisões de feedback, navegação e tratamento de falhas
- **Affordances (Norman)**: ícones de lupa, estrela e robô comunicam sua função sem necessidade de instrução explícita
- **Modelo Mental (Norman)**: o mapa interativo e a estrutura de cards seguem padrões já familiares ao usuário
- **Princípios da Gestalt**: proximidade, similaridade, figura e fundo e continuidade foram aplicados na organização visual dos elementos
- **Eficácia e Eficiência**: favoritos e histórico de buscas reduzem o número de passos para concluir uma tarefa

## Teste de Usabilidade

O teste foi realizado com três participantes, incluindo o monitor da disciplina de IHC. Os participantes executaram a tarefa de encontrar uma linha de ônibus e consultar suas informações no mapa. Foram coletados tempo de execução, número de erros, conclusão da tarefa e grau de satisfação.

### Melhorias Implementadas Após o Teste

- Adição de borda de separação entre o painel do assistente de IA e o mapa, aumentando a distinção visual entre os elementos
- Integração do widget VLibras para leitura do conteúdo em Língua Brasileira de Sinais

## Observações Finais

O assistente de IA utiliza a API da Groq com o modelo llama-3.1-8b-instant, acessada através de um backend próprio em Express.js hospedado no Render, que atua como proxy para proteger a chave de API. Os dados de rotas e terminais são armazenados localmente em arquivos JSON.

## Referências

- NIELSEN, Jakob. Usability Engineering. San Francisco: Morgan Kaufmann, 1993.
- NIELSEN, Jakob. 10 Usability Heuristics for User Interface Design. Nielsen Norman Group, 1994.
- NORMAN, Donald A. The Design of Everyday Things. New York: Basic Books, 1988.
- ISO 9241-11: Ergonomics of human-system interaction. Genebra: ISO, 2018.
- [Overpass API (OpenStreetMap)](https://wiki.openstreetmap.org/wiki/Overpass_API)
- [GeoJSON](https://geojson.org/)
- [Groq API](https://console.groq.com/docs/overview)
- [Rumo Grande Recife](https://virtual.granderecife.pe.gov.br/rumo/)

## Equipe

<table>
  <tr>
    <td align="center"><a href="https://github.com/LarissaGiovanna"><b>Larissa Giovanna</b></a></td>
    <td align="center"><a href="https://github.com/Lauravi354"><b>Laura Alves</b></a></td>
    <td align="center"><a href="https://github.com/LucazinnDEV"><b>Lucas Samuel</b></a></td>
  </tr>
  <tr>
    <td align="center"><a href="https://github.com/luisamagalhaess"><b>Luísa Magalhães</b></a></td>
    <td align="center"><a href="https://github.com/PedroOliveiira"><b>Pedro Oliveira</b></a></td>
    <td align="center"><a href="https://github.com/rebecaferraz"><b>Rebeca Ferraz</b></a></td>
  </tr>
</table>

<div align="center">

Desenvolvido para a disciplina de Interfaces Humano-Computador — CESAR School

</div>
