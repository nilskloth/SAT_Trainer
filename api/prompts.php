<?php
/*
 * Server-side operation definitions. The browser only ever sends
 * {token, op, payload}; every prompt, model choice, schema and
 * max_tokens lives here so the proxy can never be used as an
 * open relay. Generation ops are added in Phase 5.
 */

const OPS = ['ping', 'mark'];

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
    default:
      throw new InvalidArgumentException("Unknown op: $op");
  }
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
