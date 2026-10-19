<?php
/*
 * Secondary word lists uploaded by the parent (Grown-ups → Word lists).
 *   import-vocab   pages (photos / PDF / pasted text) → Claude → a draft
 *                  chapter in the trainer's shape; nothing is stored
 *   vocab-publish  a checked chapter → data/uploads/<lang>.json
 *   vocab-remove   delete one uploaded chapter
 * All three need the upload password as well as the shared token
 * (see sec_check_password in ratelimit.php).
 */

const VOCAB_LANGS = ['de' => 'German', 'fr' => 'French'];
const UPLOADS_DIR = __DIR__ . '/../data/uploads';
const IMPORT_MAX_FILES = 8;
const IMPORT_MAX_BYTES = 9 * 1024 * 1024;   // decoded, all files together
const IMPORT_MEDIA = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];

function vocab_lang(array $p): string {
  $lang = $p['lang'] ?? '';
  if (!is_string($lang) || !isset(VOCAB_LANGS[$lang])) {
    throw new InvalidArgumentException('payload.lang must be de or fr');
  }
  return $lang;
}

/* Trimmed single-line string, control characters removed, length-capped. */
function vocab_str($v, int $max): string {
  if (!is_string($v)) return '';
  $v = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', $v) ?? '';
  return mb_substr(trim(preg_replace('/\s+/u', ' ', $v) ?? ''), 0, $max);
}

function build_import_vocab_request(array $p): array {
  $lang = vocab_lang($p);
  $label = VOCAB_LANGS[$lang];
  $files = $p['files'] ?? [];
  $text = isset($p['text']) && is_string($p['text']) ? mb_substr($p['text'], 0, 40000) : '';
  if (!is_array($files) || count($files) > IMPORT_MAX_FILES) {
    throw new InvalidArgumentException('Up to ' . IMPORT_MAX_FILES . ' files at a time');
  }
  if (!$files && trim($text) === '') {
    throw new InvalidArgumentException('Add a photo, a PDF or some text');
  }

  $content = [];
  $total = 0;
  foreach ($files as $f) {
    $type = is_array($f) ? ($f['media_type'] ?? '') : '';
    $data = is_array($f) ? ($f['data'] ?? '') : '';
    if (!in_array($type, IMPORT_MEDIA, true) || !is_string($data) || $data === '' ||
        !preg_match('/^[A-Za-z0-9+\/]+=*$/', $data)) {
      throw new InvalidArgumentException('Files must be photos (JPEG/PNG) or PDFs');
    }
    $total += intdiv(strlen($data) * 3, 4);
    $content[] = $type === 'application/pdf'
      ? ['type' => 'document', 'source' => ['type' => 'base64', 'media_type' => $type, 'data' => $data]]
      : ['type' => 'image', 'source' => ['type' => 'base64', 'media_type' => $type, 'data' => $data]];
  }
  if ($total > IMPORT_MAX_BYTES) {
    throw new InvalidArgumentException('Files too large together — use fewer or smaller pages');
  }
  if (trim($text) !== '') {
    $content[] = ['type' => 'text', 'text' => "PASTED TEXT FROM THE SHEET:\n" . $text];
  }
  $content[] = ['type' => 'text', 'text' => "Extract this {$label} vocabulary sheet."];

  $system = <<<SYS
You turn a school {$label} vocabulary sheet (a textbook "word list" page:
boxed topics of {$label} words and phrases with their English meaning) into
structured data for a vocabulary trainer used by an 11-12-year-old.

Word lists — copy, never invent:
- Each boxed topic is a section. Its heading is usually "{$label} title •
  English title": put them in title and en.
- One item per row: target = the {$label} exactly as printed, en = the English
  exactly as printed. Keep brackets, slashes, "…", articles, plural markers
  like (-e) or (-¨e), capitals and accents. Join rows that wrap onto the next
  line. Do not add, translate, reorder or "improve" anything; only fix
  obvious scanning noise, and mention anything you could not read in notes.
- If a section heading is itself a question or phrase (e.g. "Wo wohnst du?"),
  also include it as the first item of that section.
- opener/openerEn: some sections start with an opener row ("Ich habe …" /
  "I have …") and the rows after it only complete it ("einen Computer").
  Set opener on those completing rows ONLY where the article, case or ending
  depends on the opener (einen Hund after "Ich habe", der Schweiz after
  "Ich wohne in"). Leave opener and openerEn empty everywhere else,
  including full sentences and the opener row itself.
- chapterNumber and chapterTitle from the page header or footer if printed
  (0 and "" if not); pages = printed page numbers like "24–25", else "".

Strategy box — retell, don't copy:
- If the page has a strategy or tip box, retell it in your own words in
  short, friendly English for the pupil: a title, then parts with an
  optional heading, a short text, optional numbered steps and optional
  example words. Example words are {$label} words from the box, which the
  app reads aloud. Never copy the box's sentences word for word.
- If there is no strategy box, give an empty title and no parts.

notes: one or two sentences for the parent — anything unclear, skipped or
worth checking. Empty if all was clear.
SYS;

  $itemSchema = [
    'type' => 'object',
    'properties' => [
      'target' => ['type' => 'string'],
      'en' => ['type' => 'string'],
      'opener' => ['type' => 'string'],
      'openerEn' => ['type' => 'string'],
    ],
    'required' => ['target', 'en', 'opener', 'openerEn'],
    'additionalProperties' => false,
  ];
  $strList = ['type' => 'array', 'items' => ['type' => 'string']];

  return [
    'model' => 'claude-sonnet-5-5',
    'max_tokens' => 16000,
    'system' => $system,
    'messages' => [['role' => 'user', 'content' => $content]],
    'output_config' => [
      // Transcription, not reasoning — low effort keeps it inside Strato's time limit.
      'effort' => 'low',
      'format' => [
        'type' => 'json_schema',
        'schema' => [
          'type' => 'object',
          'properties' => [
            'chapterNumber' => ['type' => 'integer'],
            'chapterTitle' => ['type' => 'string'],
            'pages' => ['type' => 'string'],
            'sections' => ['type' => 'array', 'items' => [
              'type' => 'object',
              'properties' => [
                'title' => ['type' => 'string'],
                'en' => ['type' => 'string'],
                'items' => ['type' => 'array', 'items' => $itemSchema],
              ],
              'required' => ['title', 'en', 'items'],
              'additionalProperties' => false,
            ]],
            'strategy' => [
              'type' => 'object',
              'properties' => [
                'title' => ['type' => 'string'],
                'parts' => ['type' => 'array', 'items' => [
                  'type' => 'object',
                  'properties' => [
                    'heading' => ['type' => 'string'],
                    'text' => ['type' => 'string'],
                    'steps' => $strList,
                    'words' => $strList,
                  ],
                  'required' => ['heading', 'text', 'steps', 'words'],
                  'additionalProperties' => false,
                ]],
              ],
              'required' => ['title', 'parts'],
              'additionalProperties' => false,
            ],
            'notes' => ['type' => 'string'],
          ],
          'required' => ['chapterNumber', 'chapterTitle', 'pages', 'sections', 'strategy', 'notes'],
          'additionalProperties' => false,
        ],
      ],
    ],
  ];
}

/* Rebuild a chapter from the browser using only known keys and safe values. */
function vocab_clean_chapter(string $lang, $c): array {
  if (!is_array($c)) throw new InvalidArgumentException('payload.chapter missing');
  $number = $c['number'] ?? null;
  if (!is_int($number) || $number < 1 || $number > 99) {
    throw new InvalidArgumentException('Chapter number must be 1–99');
  }
  $id = fn($v) => is_string($v) && preg_match('/^[a-z0-9-]{1,80}$/', $v) ? $v : null;

  $sections = [];
  foreach (array_slice(is_array($c['sections'] ?? null) ? $c['sections'] : [], 0, 40) as $s) {
    if (!is_array($s)) continue;
    $items = [];
    foreach (array_slice(is_array($s['items'] ?? null) ? $s['items'] : [], 0, 200) as $it) {
      if (!is_array($it)) continue;
      $target = vocab_str($it[$lang] ?? '', 300);
      $en = vocab_str($it['en'] ?? '', 300);
      $iid = $id($it['id'] ?? null);
      if ($target === '' || $en === '' || !$iid) continue;
      $item = ['id' => $iid, $lang => $target, 'en' => $en];
      $ctx = $it['context'] ?? null;
      if (is_array($ctx) && vocab_str($ctx[$lang] ?? '', 120) !== '' && vocab_str($ctx['en'] ?? '', 120) !== '') {
        $item['context'] = [$lang => vocab_str($ctx[$lang], 120), 'en' => vocab_str($ctx['en'], 120)];
      }
      $items[] = $item;
    }
    $sid = $id($s['id'] ?? null);
    if (!$items || !$sid) continue;
    $sections[] = ['id' => $sid, 'title' => vocab_str($s['title'] ?? '', 160), 'en' => vocab_str($s['en'] ?? '', 160), 'items' => $items];
  }
  if (!$sections) throw new InvalidArgumentException('The chapter has no words');

  $out = [
    'id' => "k{$number}", 'number' => $number,
    'title' => vocab_str($c['title'] ?? '', 120), 'pages' => vocab_str($c['pages'] ?? '', 40),
    'source' => 'upload', 'uploaded' => gmdate('Y-m-d'),
    'sections' => $sections,
  ];

  $st = $c['strategy'] ?? null;
  if (is_array($st) && vocab_str($st['title'] ?? '', 160) !== '') {
    $parts = [];
    foreach (array_slice(is_array($st['parts'] ?? null) ? $st['parts'] : [], 0, 12) as $pt) {
      if (!is_array($pt)) continue;
      $part = [];
      if (($h = vocab_str($pt['heading'] ?? '', 160)) !== '') $part['heading'] = $h;
      if (($t = vocab_str($pt['text'] ?? '', 1500)) !== '') $part['text'] = $t;
      foreach (['steps' => 300, 'words' => 80] as $k => $max) {
        $list = array_values(array_filter(array_map(fn($x) => vocab_str($x, $max), array_slice(is_array($pt[$k] ?? null) ? $pt[$k] : [], 0, 20))));
        if ($list) $part[$k] = $list;
      }
      if ($part) $parts[] = $part;
    }
    if ($parts) $out['strategy'] = ['number' => $number, 'title' => vocab_str($st['title'], 160), 'parts' => $parts];
  }
  return $out;
}

/* Read-modify-write data/uploads/<lang>.json under a lock. */
function vocab_update_uploads(string $lang, callable $change): array {
  if (!is_dir(UPLOADS_DIR) && !@mkdir(UPLOADS_DIR, 0755, true)) {
    throw new RuntimeException('The server could not create data/uploads');
  }
  $fh = @fopen(UPLOADS_DIR . "/{$lang}.json", 'c+');
  if ($fh === false) throw new RuntimeException('The server could not write data/uploads');
  try {
    flock($fh, LOCK_EX);
    $data = json_decode(stream_get_contents($fh) ?: 'null', true);
    if (!is_array($data) || !is_array($data['chapters'] ?? null)) {
      $data = ['language' => $lang, 'label' => VOCAB_LANGS[$lang], 'chapters' => []];
    }
    $data['chapters'] = array_values($change($data['chapters']));
    usort($data['chapters'], fn($a, $b) => $a['number'] <=> $b['number']);
    ftruncate($fh, 0);
    rewind($fh);
    fwrite($fh, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_PRETTY_PRINT));
    return $data;
  } finally {
    flock($fh, LOCK_UN);
    fclose($fh);
  }
}

function vocab_publish(array $p): array {
  $lang = vocab_lang($p);
  $chapter = vocab_clean_chapter($lang, $p['chapter'] ?? null);
  $data = vocab_update_uploads($lang, fn($chs) => array_merge(
    array_filter($chs, fn($c) => ($c['number'] ?? 0) !== $chapter['number']), [$chapter]));
  return ['published' => $chapter['number'], 'chapters' => count($data['chapters'])];
}

function vocab_remove(array $p): array {
  $lang = vocab_lang($p);
  $number = $p['number'] ?? null;
  if (!is_int($number)) throw new InvalidArgumentException('payload.number missing');
  $data = vocab_update_uploads($lang, fn($chs) => array_filter($chs, fn($c) => ($c['number'] ?? 0) !== $number));
  return ['removed' => $number, 'chapters' => count($data['chapters'])];
}
