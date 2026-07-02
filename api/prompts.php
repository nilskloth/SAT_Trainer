<?php
/*
 * Server-side operation definitions. The browser only ever sends
 * {token, op, payload}; every prompt, model choice, schema and
 * max_tokens lives here so the proxy can never be used as an
 * open relay. Generation ops are added in Phase 5.
 */

const OPS = ['ping', 'usage', 'mark', 'generate-passage'];

/* Which daily-cap bucket an op draws from. */
function op_cap_bucket(string $op): string {
  return $op === 'mark' ? 'mark' : 'generate';
}

/*
 * Build the Anthropic /v1/messages request body for an op.
 * Throws InvalidArgumentException on bad payloads (→ 400 to client).
 */
function build_request(string $op, array $payload): array {
  switch ($op) {
    case 'mark':
      return build_mark_request($payload);
    case 'generate-passage':
      return build_generate_passage_request($payload);
    default:
      throw new InvalidArgumentException("Unknown op: $op");
  }
}

/* Generation runs long — give it more wall time than marking. */
function op_timeout(string $op): int {
  return $op === 'mark' ? 100 : 280;
}

function require_string(array $p, string $key, int $maxLen): string {
  if (!isset($p[$key]) || !is_string($p[$key]) || trim($p[$key]) === '') {
    throw new InvalidArgumentException("payload.$key missing or empty");
  }
  if (strlen($p[$key]) > $maxLen) {
    throw new InvalidArgumentException("payload.$key too long");
  }
  return $p[$key];
}

function build_generate_passage_request(array $p): array {
  $category = $p['category'] ?? 'fiction';
  if (!in_array($category, ['fiction', 'non-fiction', 'poetry'], true)) {
    throw new InvalidArgumentException('payload.category must be fiction, non-fiction or poetry');
  }
  $theme = isset($p['theme']) && is_string($p['theme']) ? substr($p['theme'], 0, 120) : '';

  $system = <<<SYS
You are an expert author of UK Key Stage 2 SATs English reading tests,
writing to the STA test framework for Year 6 pupils (ages 10-11).

Write ONE reading passage of 600-900 words in UK English, age-appropriate,
engaging, and comparable in difficulty to real KS2 test texts. The "text"
field must be HTML using only <p>, <em> and <strong> tags.

Then write 8 to 10 questions on the passage. Requirements:
- Tag each question with its STA content domain: 2a (word meaning),
  2b (retrieve), 2c (summarise), 2d (inference), 2e (predict),
  2f (structure), 2g (language choice), 2h (compare).
- Weight the set like a real paper: mostly 2b and 2d, at least one 2a.
- Use type "mcq" (4 choices, answer must be one of them), "tick2"
  (5 choices, exactly 2 correct in answers), "short" (1 mark, brief
  written answer) or "open" (2-3 marks, explain/justify with evidence).
- Every question needs acceptablePoints: the mark-scheme points a marker
  would accept, in official mark-scheme style ("her hands were shaking"),
  with 2-4 alternatives phrasings for short answers.
- marks: 1 for mcq/short, 2 for tick2, 2-3 for open. modelAnswer: a
  complete correct answer.
- Questions must be answerable from the passage alone.
SYS;

  $user = "Write a new {$category} passage" . ($theme !== '' ? " about: {$theme}" : '') .
    " with its questions.";

  $questionSchema = [
    'type' => 'object',
    'properties' => [
      'type' => ['type' => 'string', 'enum' => ['mcq', 'tick2', 'short', 'open']],
      'domain' => ['type' => 'string', 'enum' => ['2a', '2b', '2c', '2d', '2e', '2f', '2g', '2h']],
      'marks' => ['type' => 'integer'],
      'stem' => ['type' => 'string'],
      'choices' => ['type' => 'array', 'items' => ['type' => 'string']],
      'answer' => ['type' => 'string'],
      'answers' => ['type' => 'array', 'items' => ['type' => 'string']],
      'acceptablePoints' => ['type' => 'array', 'items' => ['type' => 'string']],
      'modelAnswer' => ['type' => 'string'],
    ],
    'required' => ['type', 'domain', 'marks', 'stem', 'choices', 'answer', 'answers', 'acceptablePoints', 'modelAnswer'],
    'additionalProperties' => false,
  ];

  return [
    'model' => 'claude-sonnet-5',
    'max_tokens' => 16000,
    'system' => $system,
    'messages' => [['role' => 'user', 'content' => $user]],
    'output_config' => [
      'format' => [
        'type' => 'json_schema',
        'schema' => [
          'type' => 'object',
          'properties' => [
            'title' => ['type' => 'string'],
            'genre' => ['type' => 'string'],
            'category' => ['type' => 'string', 'enum' => ['fiction', 'non-fiction', 'poetry']],
            'text' => ['type' => 'string'],
            'questions' => ['type' => 'array', 'items' => $questionSchema],
          ],
          'required' => ['title', 'genre', 'category', 'text', 'questions'],
          'additionalProperties' => false,
        ],
      ],
    ],
  ];
}

function build_mark_request(array $p): array {
  $stem = require_string($p, 'stem', 4000);
  $answer = require_string($p, 'answer', 4000);
  $marks = $p['marks'] ?? null;
  if (!is_int($marks) || $marks < 1 || $marks > 5) {
    throw new InvalidArgumentException('payload.marks must be an integer 1-5');
  }
  $scheme = $p['markScheme'] ?? null;
  if (!is_array($scheme)) {
    throw new InvalidArgumentException('payload.markScheme missing');
  }
  $schemeJson = json_encode($scheme, JSON_UNESCAPED_UNICODE);
  if ($schemeJson === false || strlen($schemeJson) > 8000) {
    throw new InvalidArgumentException('payload.markScheme too large');
  }
  $excerpt = isset($p['passageExcerpt']) && is_string($p['passageExcerpt'])
    ? substr($p['passageExcerpt'], 0, 6000) : '';

  $system = <<<SYS
You are an experienced KS2 SATs marker applying an official mark scheme to a
Year 6 pupil's written answer. Award marks strictly according to the mark
scheme's acceptable points and award rules — never for effort, length, or
near-misses the scheme does not allow. Spelling and grammar are not penalised
unless the scheme says so. The pupil is 10 or 11 years old: "feedback" must be
one or two encouraging, specific sentences addressed to the pupil, in simple
warm British English, noting what they did well and (if marks were lost) what
the mark scheme wanted. List in "matchedPoints" the acceptable points the
answer actually made, quoting the scheme's own wording.
SYS;

    $user = "QUESTION ({$marks} mark" . ($marks > 1 ? 's' : '') . "):\n{$stem}\n\n"
      . ($excerpt !== '' ? "TEXT EXTRACT THE QUESTION REFERS TO:\n{$excerpt}\n\n" : '')
      . "OFFICIAL MARK SCHEME (JSON):\n{$schemeJson}\n\n"
      . "PUPIL'S ANSWER:\n{$answer}";

  return [
    'model' => 'claude-sonnet-5',
    'max_tokens' => 1024,
    // Constrained judgment task: disable thinking so max_tokens is all output.
    'thinking' => ['type' => 'disabled'],
    'system' => $system,
    'messages' => [['role' => 'user', 'content' => $user]],
    'output_config' => [
      'format' => [
        'type' => 'json_schema',
        'schema' => [
          'type' => 'object',
          'properties' => [
            'marks' => ['type' => 'integer'],
            'feedback' => ['type' => 'string'],
            'matchedPoints' => ['type' => 'array', 'items' => ['type' => 'string']],
          ],
          'required' => ['marks', 'feedback', 'matchedPoints'],
          'additionalProperties' => false,
        ],
      ],
    ],
  ];
}
