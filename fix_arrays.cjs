const fs = require('fs');
let content = fs.readFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', 'utf8');

// Replace getting started steps
content = content.replace(/title: 'Confira sua organização'/g, "title: t('dashboard.musicscale.center.getting_started.steps.org.title', 'Confira sua organização')");
content = content.replace(/desc: 'Veja se o plano da organização.*'/g, "desc: t('dashboard.musicscale.center.getting_started.steps.org.desc')");
content = content.replace(/why: 'Tudo no MillionsNest.*'/g, "why: t('dashboard.musicscale.center.getting_started.steps.org.why')");
content = content.replace(/how: 'Se você está vendo.*'/g, "how: t('dashboard.musicscale.center.getting_started.steps.org.how')");
content = content.replace(/result: 'Organização pronta.*'/g, "result: t('dashboard.musicscale.center.getting_started.steps.org.result')");

content = content.replace(/title: 'Convide sua equipe'/g, "title: t('dashboard.musicscale.center.getting_started.steps.team.title', 'Convide sua equipe')");
content = content.replace(/desc: 'Adicione ministros.*'/g, "desc: t('dashboard.musicscale.center.getting_started.steps.team.desc')");
content = content.replace(/why: 'As escalas dependem.*'/g, "why: t('dashboard.musicscale.center.getting_started.steps.team.why')");
content = content.replace(/how: 'Acesse .* e clique em.*'/g, "how: t('dashboard.musicscale.center.getting_started.steps.team.how')");
content = content.replace(/result: 'Os convidados receberão.*'/g, "result: t('dashboard.musicscale.center.getting_started.steps.team.result')");
content = content.replace(/important: 'Apenas administradores.*'/g, "important: t('dashboard.musicscale.center.getting_started.steps.team.important')");

content = content.replace(/title: 'Adicione músicas ao Repertório'/g, "title: t('dashboard.musicscale.center.getting_started.steps.songs.title', 'Adicione músicas ao Repertório')");
content = content.replace(/desc: 'Comece a montar o acervo.*'/g, "desc: t('dashboard.musicscale.center.getting_started.steps.songs.desc')");
content = content.replace(/why: 'As músicas adicionadas.*'/g, "why: t('dashboard.musicscale.center.getting_started.steps.songs.why')");
content = content.replace(/how: 'No MusicScale.*'/g, "how: t('dashboard.musicscale.center.getting_started.steps.songs.how')");
content = content.replace(/result: 'A música estará.*'/g, "result: t('dashboard.musicscale.center.getting_started.steps.songs.result')");

content = content.replace(/title: 'Confira cifras e letras'/g, "title: t('dashboard.musicscale.center.getting_started.steps.chords.title', 'Confira cifras e letras')");
content = content.replace(/desc: 'Organize o conteúdo.*'/g, "desc: t('dashboard.musicscale.center.getting_started.steps.chords.desc')");
content = content.replace(/why: 'Cifras garantem.*'/g, "why: t('dashboard.musicscale.center.getting_started.steps.chords.why')");
content = content.replace(/how: 'Após adicionar uma música.*'/g, "how: t('dashboard.musicscale.center.getting_started.steps.chords.how')");
content = content.replace(/result: 'A equipe terá acesso.*'/g, "result: t('dashboard.musicscale.center.getting_started.steps.chords.result')");

content = content.replace(/title: 'Organize os integrantes'/g, "title: t('dashboard.musicscale.center.getting_started.steps.members.title', 'Organize os integrantes')");
content = content.replace(/desc: 'Atribua instrumentos.*'/g, "desc: t('dashboard.musicscale.center.getting_started.steps.members.desc')");
content = content.replace(/why: 'Saber o que cada pessoa.*'/g, "why: t('dashboard.musicscale.center.getting_started.steps.members.why')");
content = content.replace(/how: 'Em .* selecione um membro.*'/g, "how: t('dashboard.musicscale.center.getting_started.steps.members.how')");
content = content.replace(/result: 'O integrante estará.*'/g, "result: t('dashboard.musicscale.center.getting_started.steps.members.result')");

content = content.replace(/title: 'Monte uma Escala da Banda'/g, "title: t('dashboard.musicscale.center.getting_started.steps.band.title', 'Monte uma Escala da Banda')");
content = content.replace(/desc: 'Defina quem vai tocar.*'/g, "desc: t('dashboard.musicscale.center.getting_started.steps.band.desc')");
content = content.replace(/why: 'Garante que não falte.*'/g, "why: t('dashboard.musicscale.center.getting_started.steps.band.why')");
content = content.replace(/how: 'Vá em .* clique em Nova.*'/g, "how: t('dashboard.musicscale.center.getting_started.steps.band.how')");
content = content.replace(/result: 'A equipe será notificada.*'/g, "result: t('dashboard.musicscale.center.getting_started.steps.band.result')");

content = content.replace(/title: 'Crie uma Escala de Músicas'/g, "title: t('dashboard.musicscale.center.getting_started.steps.music.title', 'Crie uma Escala de Músicas')");
content = content.replace(/desc: 'Selecione as músicas.*'/g, "desc: t('dashboard.musicscale.center.getting_started.steps.music.desc')");
content = content.replace(/why: 'Permite que a banda.*'/g, "why: t('dashboard.musicscale.center.getting_started.steps.music.why')");
content = content.replace(/how: 'Vá em .* e selecione as.*'/g, "how: t('dashboard.musicscale.center.getting_started.steps.music.how')");
content = content.replace(/result: 'A lista de músicas.*'/g, "result: t('dashboard.musicscale.center.getting_started.steps.music.result')");

content = content.replace(/title: 'Revise a preparação'/g, "title: t('dashboard.musicscale.center.getting_started.steps.review.title', 'Revise a preparação')");
content = content.replace(/desc: 'Garanta que tudo.*'/g, "desc: t('dashboard.musicscale.center.getting_started.steps.review.desc')");
content = content.replace(/why: 'Evita surpresas.*'/g, "why: t('dashboard.musicscale.center.getting_started.steps.review.why')");
content = content.replace(/how: 'Abra as escalas criadas.*'/g, "how: t('dashboard.musicscale.center.getting_started.steps.review.how')");
content = content.replace(/result: 'A equipe estará segura.*'/g, "result: t('dashboard.musicscale.center.getting_started.steps.review.result')");


// Replace resources items
content = content.replace(/title: 'Repertório de músicas'/g, "title: t('dashboard.musicscale.center.resources.repertoire.title')");
content = content.replace(/desc: 'Acervo central.*'/g, "desc: t('dashboard.musicscale.center.resources.repertoire.desc')");
content = content.replace(/can: \[\s*'Adicionar novas.*',\s*'Visualizar todas.*',\s*'Buscar por tom.*'\s*\]/g, `can: [
        t('dashboard.musicscale.center.resources.repertoire.can_add'),
        t('dashboard.musicscale.center.resources.repertoire.can_view'),
        t('dashboard.musicscale.center.resources.repertoire.can_search')
      ]`);
content = content.replace(/where: 'Menu lateral > Repertório > Músicas'/g, "where: t('dashboard.musicscale.center.resources.repertoire.where')");
content = content.replace(/practice: 'Use o Repertório.*'/g, "practice: t('dashboard.musicscale.center.resources.repertoire.practice')");

// We'll replace the rest using more generic regexes or just standard replacements.
content = content.replace(/title: 'Biblioteca Viva'/g, "title: t('dashboard.musicscale.center.resources.library.title')");
content = content.replace(/desc: 'Catálogo global.*'/g, "desc: t('dashboard.musicscale.center.resources.library.desc')");
content = content.replace(/can: \[\s*'Explorar músicas.*',\s*'Importar cifras.*',\s*'Descobrir novos.*'\s*\]/g, `can: [
        t('dashboard.musicscale.center.resources.library.can_explore'),
        t('dashboard.musicscale.center.resources.library.can_import'),
        t('dashboard.musicscale.center.resources.library.can_discover')
      ]`);
content = content.replace(/where: 'Menu lateral > Repertório > Músicas > Importar da.*'/g, "where: t('dashboard.musicscale.center.resources.library.where')");
content = content.replace(/practice: 'Antes de cadastrar.*'/g, "practice: t('dashboard.musicscale.center.resources.library.practice')");

content = content.replace(/title: 'Importação inteligente'/g, "title: t('dashboard.musicscale.center.resources.ai.title')");
content = content.replace(/desc: 'Ferramenta baseada em IA.*'/g, "desc: t('dashboard.musicscale.center.resources.ai.desc')");
content = content.replace(/can: \[\s*'Colar links.*',\s*'Extrair estrutura.*',\s*'Economizar tempo.*'\s*\]/g, `can: [
        t('dashboard.musicscale.center.resources.ai.can_paste'),
        t('dashboard.musicscale.center.resources.ai.can_extract'),
        t('dashboard.musicscale.center.resources.ai.can_save')
      ]`);
content = content.replace(/where: 'Menu lateral > Repertório > Músicas > Importar com IA'/g, "where: t('dashboard.musicscale.center.resources.ai.where')");
content = content.replace(/practice: 'Encontrou uma cifra.*'/g, "practice: t('dashboard.musicscale.center.resources.ai.practice')");

content = content.replace(/title: 'Cifras'/g, "title: t('dashboard.musicscale.center.resources.chords.title')");
content = content.replace(/desc: 'Estrutura harmônica.*'/g, "desc: t('dashboard.musicscale.center.resources.chords.desc')");
content = content.replace(/can: \[\s*'Visualizar acordes.*',\s*'Transpor tons.*',\s*'Imprimir ou baixar.*'\s*\]/g, `can: [
        t('dashboard.musicscale.center.resources.chords.can_view'),
        t('dashboard.musicscale.center.resources.chords.can_transpose'),
        t('dashboard.musicscale.center.resources.chords.can_print')
      ]`);
content = content.replace(/where: 'Menu lateral > Repertório > Cifras'/g, "where: t('dashboard.musicscale.center.resources.chords.where')");
content = content.replace(/practice: 'Use a transposição.*'/g, "practice: t('dashboard.musicscale.center.resources.chords.practice')");

content = content.replace(/title: 'Letras'/g, "title: t('dashboard.musicscale.center.resources.lyrics.title')");
content = content.replace(/desc: 'Texto poético.*'/g, "desc: t('dashboard.musicscale.center.resources.lyrics.desc')");
content = content.replace(/can: \[\s*'Ler a composição.*',\s*'Acompanhar a estrutura.*',\s*'Preparar projeção.*'\s*\]/g, `can: [
        t('dashboard.musicscale.center.resources.lyrics.can_read'),
        t('dashboard.musicscale.center.resources.lyrics.can_follow'),
        t('dashboard.musicscale.center.resources.lyrics.can_prepare')
      ]`);
content = content.replace(/where: 'Menu lateral > Repertório > Letras'/g, "where: t('dashboard.musicscale.center.resources.lyrics.where')");
content = content.replace(/practice: 'Vocalistas devem.*'/g, "practice: t('dashboard.musicscale.center.resources.lyrics.practice')");

content = content.replace(/title: 'Escalas de Músicas'/g, "title: t('dashboard.musicscale.center.resources.scales_songs.title')");
content = content.replace(/desc: 'A lista de canções.*'/g, "desc: t('dashboard.musicscale.center.resources.scales_songs.desc')");
content = content.replace(/can: \[\s*'Definir o setlist.*',\s*'Atribuir tons.*',\s*'Vincular a uma.*'\s*\]/g, `can: [
        t('dashboard.musicscale.center.resources.scales_songs.can_define'),
        t('dashboard.musicscale.center.resources.scales_songs.can_assign'),
        t('dashboard.musicscale.center.resources.scales_songs.can_link')
      ]`);
content = content.replace(/where: 'Menu lateral > Escalas > Escalas de Músicas'/g, "where: t('dashboard.musicscale.center.resources.scales_songs.where')");
content = content.replace(/practice: 'Crie a escala.*'/g, "practice: t('dashboard.musicscale.center.resources.scales_songs.practice')");

content = content.replace(/title: 'Escalas da Banda'/g, "title: t('dashboard.musicscale.center.resources.scales_band.title')");
content = content.replace(/desc: 'A distribuição.*'/g, "desc: t('dashboard.musicscale.center.resources.scales_band.desc')");
content = content.replace(/can: \[\s*'Escalar músicos.*',\s*'Definir posições.*',\s*'Notificar a equipe.*'\s*\]/g, `can: [
        t('dashboard.musicscale.center.resources.scales_band.can_scale'),
        t('dashboard.musicscale.center.resources.scales_band.can_define'),
        t('dashboard.musicscale.center.resources.scales_band.can_notify')
      ]`);
content = content.replace(/where: 'Menu lateral > Escalas > Escalas da Banda'/g, "where: t('dashboard.musicscale.center.resources.scales_band.where')");
content = content.replace(/practice: 'Monte a equipe.*'/g, "practice: t('dashboard.musicscale.center.resources.scales_band.practice')");

content = content.replace(/title: 'Integrantes'/g, "title: t('dashboard.musicscale.center.resources.members.title')");
content = content.replace(/desc: 'O cadastro.*'/g, "desc: t('dashboard.musicscale.center.resources.members.desc')");
content = content.replace(/can: \[\s*'Definir instrumentos.*',\s*'Visualizar histórico.*',\s*'Gerenciar funções.*'\s*\]/g, `can: [
        t('dashboard.musicscale.center.resources.members.can_define'),
        t('dashboard.musicscale.center.resources.members.can_view'),
        t('dashboard.musicscale.center.resources.members.can_manage')
      ]`);
content = content.replace(/where: 'Menu lateral > Integrantes'/g, "where: t('dashboard.musicscale.center.resources.members.where')");
content = content.replace(/practice: 'Mantenha o cadastro.*'/g, "practice: t('dashboard.musicscale.center.resources.members.practice')");

fs.writeFileSync('src/components/dashboard/MusicScaleGuideCenter.tsx', content);
