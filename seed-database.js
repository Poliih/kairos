const fs = require('fs');
const path = require('path'); 
const xml2js = require('xml2js');
const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');


const envPath = path.resolve(__dirname, '.env');
const result = dotenv.config({ path: envPath });

if (result.error) {
  console.log("❌ Ainda não achei o .env! Confere se ele está na pasta:", __dirname);
  process.exit(1);
} else {
  console.log("✅ .env carregado com sucesso!");
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("❌ Erro: As variáveis foram lidas, mas estão vazias ou com nomes errados dentro do arquivo.");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function importBible() {
  console.log('📖 Lendo arquivo XML...');
  
  try {
    const xmlPath = path.resolve(__dirname, 'bible.xml');
    const xml = fs.readFileSync(xmlPath, 'utf8'); 
    
    const parser = new xml2js.Parser();
    parser.parseString(xml, async (err, result) => {
        if (err) throw err;

        const versesToInsert = [];
        let count = 0;
  
        console.log('⚙️ Processando XML e montando JSON...');
  
        const bible = result.bible;
        
        if (bible.testament) {
          bible.testament.forEach(testament => {
            const testamentName = testament.$.name;
  
            if (testament.book) {
              testament.book.forEach(book => {
                const bookName = book.$.name || `Livro ${book.$.number}`; 
  
                if (book.chapter) {
                  book.chapter.forEach(chapter => {
                      const chapterNum = parseInt(chapter.$.number);
  
                      if (chapter.verse) {
                        chapter.verse.forEach(verse => {
                            const verseNum = parseInt(verse.$.number);
                            const text = verse._; 
  
                            versesToInsert.push({
                                testament: testamentName,
                                book_name: bookName,
                                chapter: chapterNum,
                                verse_number: verseNum,
                                text: text
                            });
                            count++;
                        });
                      }
                  });
                }
              });
            }
          });
        }
  
        console.log(`📦 Encontrados ${count} versículos. Iniciando upload para o Supabase...`);
  
        const BATCH_SIZE = 1000;
        for (let i = 0; i < versesToInsert.length; i += BATCH_SIZE) {
            const batch = versesToInsert.slice(i, i + BATCH_SIZE);
            
            const { error } = await supabase
                .from('verses') 
                .insert(batch);
  
            if (error) {
                console.error(`❌ Erro no lote ${i}:`, error.message);
            } else {
                const progress = Math.round(((i + batch.length) / count) * 100);
                console.log(`✅ ${progress}% concluído (${i + batch.length}/${count})`);
            }
        }
  
        console.log('✨ Sucesso total! O banco foi populado.');      
    });
  } catch (error) {
    console.error("🔥 Erro:", error.message);
  }
}

importBible();