import { supabase } from './supabase';

export async function pickRandomCategoryAndWord(): Promise<{ category: string; word: string }> {
  const { data: categories, error: catErr } = await supabase.from('categories').select('id, name');
  if (catErr || !categories?.length) throw new Error(`카테고리 조회 실패: ${catErr?.message}`);

  const category = categories[Math.floor(Math.random() * categories.length)]!;

  const { data: words, error: wordErr } = await supabase
    .from('words')
    .select('text')
    .eq('category_id', category.id);
  if (wordErr || !words?.length) throw new Error(`단어 조회 실패: ${wordErr?.message}`);

  const word = words[Math.floor(Math.random() * words.length)]!;
  return { category: category.name, word: word.text };
}