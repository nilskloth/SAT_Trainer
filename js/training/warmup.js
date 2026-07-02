/* =========================
   Warm Up — daily MCQ prep
========================= */
/* jshint esversion: 11 */

const STORAGE_KEY = 'ks2_warmup_v1';

const DAYS = [
  {
    label: 'Mon 11',
    subject: 'SPaG',
    sets: [
      {
        label: 'A',
        questions: [
          {
            q: 'In the sentence "The dog barked loudly at the postman", what word class is "loudly"?',
            opts: ['Noun', 'Adjective', 'Adverb', 'Verb'],
            ans: 2,
            hint: 'Adverbs modify verbs, adjectives, or other adverbs. "Loudly" tells us how the dog barked, so it modifies the verb "barked".'
          },
          {
            q: 'Which sentence uses a colon correctly?',
            opts: [
              'She needed: milk, bread and eggs.',
              'She needed three things: milk, bread and eggs.',
              'She needed: to buy things.',
              'She: needed milk, bread and eggs.'
            ],
            ans: 1,
            hint: 'A colon introduces a list or explanation. The clause before the colon must be able to stand alone as a complete sentence.'
          },
          {
            q: 'Which sentence uses a plural possessive apostrophe correctly?',
            opts: [
              "The boys' football was muddy.",
              "The boys football was muddy.",
              "The boy's football were muddy.",
              "The boys's football was muddy."
            ],
            ans: 0,
            hint: "When a plural noun already ends in -s, the apostrophe goes after the s (boys'). \"Boys's\" is never correct in English."
          },
          {
            q: '"By the time the lesson ended, she had finished her work." What tense is used?',
            opts: ['Simple past', 'Present perfect', 'Past perfect', 'Past continuous'],
            ans: 2,
            hint: 'The past perfect uses "had" + past participle. It describes an action completed before another past action.'
          },
          {
            q: 'What does the prefix "auto-" mean?',
            opts: ['Against', 'Before', 'Self', 'Again'],
            ans: 2,
            hint: '"Auto-" comes from Greek, meaning "self". Examples: autobiography (writing about oneself), automatic (self-acting).'
          },
          {
            q: 'Adding the suffix "-tion" to the verb "explain" creates which word class?',
            opts: ['Verb', 'Adjective', 'Adverb', 'Noun'],
            ans: 3,
            hint: 'The suffix "-tion" or "-ation" converts verbs into nouns. "Explain" becomes "explanation". Others: create → creation, decide → decision.'
          },
          {
            q: 'Which word is a subordinating conjunction?',
            opts: ['and', 'but', 'although', 'or'],
            ans: 2,
            hint: 'Subordinating conjunctions (although, because, while, if…) join a main clause to a subordinate clause. "And", "but" and "or" are coordinating conjunctions.'
          },
          {
            q: 'Which sentence punctuates direct speech correctly?',
            opts: [
              '"Can we go to the park" asked Mia.',
              '"Can we go to the park?" asked Mia.',
              '"Can we go to the park?" Asked Mia.',
              'Can we go to the park? asked Mia.'
            ],
            ans: 1,
            hint: 'A question inside speech ends with a question mark inside the closing inverted comma. The reporting verb ("asked") starts with a lower-case letter.'
          }
        ]
      },
      {
        label: 'B',
        questions: [
          {
            q: '"The book, which I borrowed from the library, was fascinating." What type of clause is "which I borrowed from the library"?',
            opts: ['Main clause', 'Subordinate clause', 'Relative clause', 'Adverbial clause'],
            ans: 2,
            hint: 'A relative clause is introduced by a relative pronoun (who, which, that, whose) and gives more information about a noun. It is a type of subordinate clause.'
          },
          {
            q: 'Which is an expanded noun phrase?',
            opts: ['run quickly', 'the old, dusty book', 'she smiled', 'because it rained'],
            ans: 1,
            hint: 'An expanded noun phrase adds detail to a noun using adjectives or other modifiers. "The old, dusty book" expands the noun "book" with two adjectives.'
          },
          {
            q: 'Which sentence uses a semicolon correctly?',
            opts: [
              'She was tired; she went to bed early.',
              'She was tired; going to bed.',
              'She was; tired and sleepy.',
              'She; was tired and went to bed.'
            ],
            ans: 0,
            hint: 'A semicolon joins two closely related independent clauses — both parts must be able to stand alone as sentences. "She was tired" and "she went to bed early" both can.'
          },
          {
            q: 'Which sentence uses the subjunctive mood correctly?',
            opts: [
              'If I was you, I would apologise.',
              'If I were you, I would apologise.',
              'If I am you, I would apologise.',
              'If I be you, I would apologise.'
            ],
            ans: 1,
            hint: 'The subjunctive is used for hypothetical situations. "If I were you" (not "was") is correct — this is the standard subjunctive form in formal English.'
          },
          {
            q: 'Which word is a determiner?',
            opts: ['quickly', 'the', 'happy', 'run'],
            ans: 1,
            hint: 'Determiners introduce nouns and tell us which or how many. "The" (definite article) is a determiner. Others include: a, an, some, every, this, my, your.'
          },
          {
            q: 'Which word uses the prefix "mis-" correctly to mean "wrongly"?',
            opts: ['misfortune', 'misbike', 'miscold', 'misgreat'],
            ans: 0,
            hint: 'The prefix "mis-" means wrongly or badly. "Misfortune" (bad luck) is a real word. The others are not real English words with this prefix.'
          },
          {
            q: 'The suffix "-less" means:',
            opts: ['full of', 'without', 'able to be', 'the most'],
            ans: 1,
            hint: '"-less" means "without". Examples: careless (without care), hopeless (without hope), speechless (without speech).'
          },
          {
            q: 'Which sentence uses brackets for parenthesis correctly?',
            opts: [
              'My teacher (Mrs Jones gave us lots of homework.',
              'My teacher (Mrs Jones) gave us lots of homework.',
              'My teacher Mrs Jones) gave us lots of homework.',
              'My teacher (Mrs Jones gave us) lots of homework.'
            ],
            ans: 1,
            hint: 'Parenthesis adds extra information and always comes in pairs — one opening and one closing bracket. Remove the bracketed section and the sentence must still make sense.'
          }
        ]
      },
      {
        label: 'C',
        questions: [
          {
            q: 'Which sentence is in the passive voice?',
            opts: [
              'The cat caught the mouse.',
              'The mouse was caught by the cat.',
              'The cat is catching the mouse.',
              'The cat had caught the mouse.'
            ],
            ans: 1,
            hint: 'In the passive voice, the subject receives the action. "The mouse was caught by the cat" uses "to be" + past participle. The active voice is "The cat caught the mouse."'
          },
          {
            q: 'Which word is a modal verb?',
            opts: ['run', 'should', 'happy', 'quickly'],
            ans: 1,
            hint: 'Modal verbs express possibility, necessity, or ability: can, could, will, would, shall, should, may, might, must. They always come before a base verb.'
          },
          {
            q: 'Which sentence uses a hyphen correctly?',
            opts: [
              'She is well known.',
              'She is a well-known author.',
              'She is a wellknown author.',
              'She is a well known-author.'
            ],
            ans: 1,
            hint: 'Hyphens join compound adjectives placed before a noun. "A well-known author" needs a hyphen before the noun. "She is well known" (after the noun) does not.'
          },
          {
            q: '"She has been reading for two hours." What tense is this?',
            opts: ['Simple present', 'Present perfect', 'Present perfect continuous', 'Past continuous'],
            ans: 2,
            hint: 'The present perfect continuous uses "have/has been" + verb+ing. It describes an action that started in the past and is still continuing now.'
          },
          {
            q: 'Which word contains the root meaning "to write"?',
            opts: ['grateful', 'paragraph', 'grapple', 'grape'],
            ans: 1,
            hint: 'The root "graph" comes from Greek, meaning "to write". "Paragraph" contains this root. Other examples: autograph, biography, photograph.'
          },
          {
            q: 'Which pair are both coordinating conjunctions?',
            opts: ['because, although', 'and, but', 'while, when', 'if, unless'],
            ans: 1,
            hint: 'Coordinating conjunctions join equal clauses. Remember FANBOYS: For, And, Nor, But, Or, Yet, So. "Because", "although", "while", "if" and "unless" are all subordinating.'
          },
          {
            q: 'Which sentence contains a relative pronoun?',
            opts: [
              'She went to the shop.',
              'He ran quickly.',
              'The girl who won the race smiled.',
              'They played football.'
            ],
            ans: 2,
            hint: 'Relative pronouns (who, which, that, whose, where) introduce relative clauses. "Who" in "the girl who won the race" refers back to "the girl".'
          },
          {
            q: 'Which is the most formal version of this sentence?',
            opts: [
              "I can't do it cos I'm busy.",
              'I cannot do it because I am busy.',
              "I can't do this as I'm rather busy.",
              'Cannot do — too busy.'
            ],
            ans: 1,
            hint: 'Formal writing uses full words (cannot, I am) rather than contractions (can\'t, I\'m), avoids slang (cos), and uses complete sentences.'
          }
        ]
      }
    ]
  },
  {
    label: 'Tue 12',
    subject: 'Reading',
    sets: [
      {
        label: 'A',
        questions: [
          {
            q: '"Amara grabbed her umbrella and pulled her coat tighter as she stepped outside." What is the weather most likely like?',
            opts: ['Hot and sunny', 'Windy and cold', 'Rainy and cold', 'Foggy and mild'],
            ans: 2,
            hint: 'Retrieval questions ask you to find clues directly in the text. An umbrella suggests rain; pulling her coat tighter suggests cold. Together they point to rainy and cold.'
          },
          {
            q: '"James slammed his book shut and stared at the ceiling." What can you infer about James?',
            opts: ['He is bored or frustrated', 'He is happy and excited', 'He is tired and sleepy', 'He is confused by the book'],
            ans: 0,
            hint: 'Inference means reading between the lines. Slamming a book shut suggests frustration; staring at the ceiling can suggest boredom or exasperation.'
          },
          {
            q: '"The ancient ruins were shrouded in mystery." What does "shrouded" mean here?',
            opts: ['Covered or hidden', 'Destroyed completely', 'Visited by tourists', 'Recently discovered'],
            ans: 0,
            hint: '"Shrouded" means wrapped or covered. A shroud traditionally covers a body. Here it means the ruins are surrounded and hidden by mystery.'
          },
          {
            q: 'A pupil claims: "The author wants us to feel sorry for the character." Which evidence best supports this?',
            opts: [
              'Quoting words that show the character is happy',
              'Quoting a phrase that shows the character suffers',
              'Saying the story is sad',
              'Describing what happens at the end'
            ],
            ans: 1,
            hint: 'When justifying a view, always quote directly from the text. A phrase that shows suffering (e.g. "she wept silently") directly supports the claim.'
          },
          {
            q: 'Which sentence contains a simile?',
            opts: [
              'The wind howled through the trees.',
              'Her laughter was music to his ears.',
              'His hands were as cold as ice.',
              'The stars danced in the midnight sky.'
            ],
            ans: 2,
            hint: 'A simile compares two things using "like" or "as". "As cold as ice" uses "as…as". The others use personification or metaphor.'
          },
          {
            q: 'An author uses short, punchy sentences in an action scene. What effect does this create?',
            opts: [
              'It slows the reader down to build suspense',
              'It creates a fast pace and excitement',
              "It shows a character's intelligence",
              'It describes the setting in detail'
            ],
            ans: 1,
            hint: 'Short sentences speed up the pace of writing. In action scenes, this creates urgency and excitement, making the reader feel the tension of the moment.'
          },
          {
            q: '"Peter Piper picked a peck of pickled peppers." This is an example of:',
            opts: ['Onomatopoeia', 'Alliteration', 'Personification', 'Rhyme'],
            ans: 1,
            hint: 'Alliteration is the repetition of the same consonant sound at the start of closely linked words. Here, the "p" sound is repeated throughout.'
          },
          {
            q: 'Which word is closest in meaning to "magnificent"?',
            opts: ['Tiny', 'Ordinary', 'Splendid', 'Terrible'],
            ans: 2,
            hint: '"Magnificent" means impressively beautiful or grand. "Splendid" means excellent or impressive — the closest synonym. "Ordinary" is the opposite.'
          }
        ]
      },
      {
        label: 'B',
        questions: [
          {
            q: 'Which features suggest a text is a newspaper report?',
            opts: [
              'Rhyme scheme and stanzas',
              'Headline, byline, and columns',
              'Once upon a time and a moral',
              'Stage directions and dialogue'
            ],
            ans: 1,
            hint: 'Newspaper reports have a headline (title), byline (writer\'s name), and are written in columns. They use the third person and report facts in a formal style.'
          },
          {
            q: 'Which sentence is a fact?',
            opts: [
              'Dogs are the best pets.',
              'Chocolate tastes wonderful.',
              'The Earth orbits the Sun.',
              'Maths is the most important subject.'
            ],
            ans: 2,
            hint: 'A fact can be proved true or false. "The Earth orbits the Sun" is scientifically proven. The others are opinions — personal views that people can disagree about.'
          },
          {
            q: '"Maya stared at her untouched plate. The smell of her favourite meal filled the room, but she pushed it away." What can you infer about Maya?',
            opts: [
              'She is not hungry, despite it being her favourite meal',
              'She does not like the meal',
              'She is in a hurry to leave',
              'She has already eaten'
            ],
            ans: 0,
            hint: 'The key clue is "favourite meal" — she normally likes it. Yet she has not eaten and pushes it away, suggesting something is wrong emotionally, not that she dislikes the food.'
          },
          {
            q: '"The politician gave an eloquent speech." What does "eloquent" mean?',
            opts: ['Boring and long', 'Fluent and persuasive', 'Angry and loud', 'Short and unclear'],
            ans: 1,
            hint: '"Eloquent" describes speech or writing that is fluent, expressive, and persuasive. An eloquent speaker chooses words well and communicates clearly and effectively.'
          },
          {
            q: 'What is the effect of repetition in a poem?',
            opts: [
              'It makes the poem shorter',
              'It emphasises an idea and creates rhythm',
              'It makes the poem harder to understand',
              'It shows the poet has run out of ideas'
            ],
            ans: 1,
            hint: 'Repetition draws attention to a key word or idea. It also creates rhythm and can build emotion or emphasise a theme throughout the poem.'
          },
          {
            q: 'An author describes a forest as "dark, silent, and still". What atmosphere does this create?',
            opts: ['Exciting and adventurous', 'Funny and cheerful', 'Threatening or eerie', 'Warm and welcoming'],
            ans: 2,
            hint: 'Words like "dark", "silent", and "still" suggest something ominous or unsettling. Authors carefully choose adjectives to create a specific mood or atmosphere.'
          },
          {
            q: 'What is a metaphor?',
            opts: [
              'A comparison using "like" or "as"',
              'When words start with the same sound',
              'A direct comparison, saying something IS something else',
              'Words that sound like what they describe'
            ],
            ans: 2,
            hint: 'A metaphor says something IS something else (e.g. "Life is a journey"). A simile uses "like" or "as". Alliteration repeats consonants; onomatopoeia imitates sounds.'
          },
          {
            q: 'When a question asks you to "explain", what should you do?',
            opts: [
              'Copy a sentence from the text',
              'Give your opinion about the text',
              'Give reasons and use evidence from the text',
              'Write a summary of the whole passage'
            ],
            ans: 2,
            hint: '"Explain" questions want reasons supported by evidence. Always quote from the text and then comment on what the quotation shows.'
          }
        ]
      },
      {
        label: 'C',
        questions: [
          {
            q: 'Why might an author start a story with dialogue?',
            opts: [
              'To describe the setting in detail',
              'To immediately engage the reader in the action',
              'To introduce all characters at once',
              'To give background information first'
            ],
            ans: 1,
            hint: 'Starting with dialogue drops the reader straight into the action. It creates immediacy and makes the reader want to find out who is speaking and why.'
          },
          {
            q: '"The scientist\'s discovery was groundbreaking." What does "groundbreaking" mean?',
            opts: ['Dangerous and risky', 'Completely new and innovative', 'Related to the ground', 'Slow and difficult'],
            ans: 1,
            hint: '"Groundbreaking" means revolutionary or entirely new — it "breaks new ground" like a plough cutting into soil for the first time.'
          },
          {
            q: '"The waves crashed and roared against the cliff." What technique is used?',
            opts: ['Simile', 'Metaphor', 'Onomatopoeia', 'Alliteration'],
            ans: 2,
            hint: '"Crashed" and "roared" are onomatopoeic words — they sound like the actions they describe. Onomatopoeia makes writing more vivid and immersive.'
          },
          {
            q: 'Which type of question asks you to find information stated directly in the text?',
            opts: ['Inference', 'Retrieval', 'Evaluation', 'Summary'],
            ans: 1,
            hint: 'Retrieval questions ask you to find information that is explicitly stated in the text — you just need to locate it. Inference requires you to "read between the lines".'
          },
          {
            q: 'What does "personification" mean?',
            opts: [
              'A comparison using "like" or "as"',
              'Giving human qualities to non-human things',
              'Words that sound like what they describe',
              'Repeating the same consonant sound'
            ],
            ans: 1,
            hint: 'Personification gives human feelings or actions to objects, animals, or ideas. Example: "The wind whispered through the trees" — the wind cannot actually whisper.'
          },
          {
            q: '"She was reluctant to speak in front of the class." What does "reluctant" mean?',
            opts: ['Eager and excited', 'Unwilling or hesitant', 'Unable to speak', 'Loud and confident'],
            ans: 1,
            hint: '"Reluctant" means unwilling or not wanting to do something. It comes from the Latin reluctari, meaning to struggle against.'
          },
          {
            q: 'Which is a good example of point-evidence-explain (PEE)?',
            opts: [
              'The character is sad. He is in the story.',
              "The character feels isolated. The author writes he 'stood alone'. This shows he has no one nearby.",
              'The story is interesting and I liked it.',
              'The author uses adjectives to describe the character.'
            ],
            ans: 1,
            hint: 'PEE = Point, Evidence (a quote), Explain. The second option has all three: point (isolated), evidence (quote), explanation (no one nearby).'
          },
          {
            q: 'Which feature is typical of a persuasive text?',
            opts: [
              'Characters and a plot',
              'Rhyming couplets',
              'Rhetorical questions and emotive language',
              'Stage directions'
            ],
            ans: 2,
            hint: 'Persuasive texts use rhetorical questions ("Surely everyone deserves a chance?"), emotive language, facts, opinions, and repetition to convince the reader.'
          }
        ]
      }
    ]
  },
  {
    label: 'Wed 13',
    subject: 'Maths 1',
    sets: [
      {
        label: 'A',
        questions: [
          {
            q: 'What is 24 × 35?',
            opts: ['740', '840', '720', '860'],
            ans: 1,
            hint: 'Break it down: 24 × 30 = 720 and 24 × 5 = 120. Add: 720 + 120 = 840.'
          },
          {
            q: 'What is ¾ of 80?',
            opts: ['30', '40', '60', '20'],
            ans: 2,
            hint: 'Divide by the denominator first, then multiply by the numerator. 80 ÷ 4 = 20; then 20 × 3 = 60.'
          },
          {
            q: 'What is 0.7 + 0.45?',
            opts: ['1.15', '0.52', '1.52', '0.75'],
            ans: 0,
            hint: 'Write 0.7 as 0.70, then add column by column: 0.70 + 0.45. Hundredths: 0+5=5; tenths: 7+4=11, write 1 carry 1; ones: 0+0+1=1. Answer: 1.15.'
          },
          {
            q: 'What is 3 + 4 × 2?',
            opts: ['14', '11', '16', '10'],
            ans: 1,
            hint: 'BODMAS: Multiplication comes before Addition. Work out 4 × 2 = 8 first, then 3 + 8 = 11.'
          },
          {
            q: 'What is 756 ÷ 4?',
            opts: ['189', '192', '181', '188'],
            ans: 0,
            hint: 'Short division: 7÷4=1 r3; bring down → 35÷4=8 r3; bring down → 36÷4=9. Answer: 189.'
          },
          {
            q: 'What is 15% of 200?',
            opts: ['25', '20', '30', '35'],
            ans: 2,
            hint: '10% of 200 = 20. 5% is half of 10%, so 5% of 200 = 10. Add: 20 + 10 = 30.'
          },
          {
            q: 'Which set of fractions is in ascending order (smallest first)?',
            opts: ['¾, ½, ⅔, ¼', '¼, ½, ⅔, ¾', '½, ¼, ¾, ⅔', '⅔, ¼, ½, ¾'],
            ans: 1,
            hint: 'Convert to decimals: ¼=0.25, ½=0.5, ⅔≈0.667, ¾=0.75. Ascending: 0.25, 0.5, 0.667, 0.75.'
          },
          {
            q: 'Which fraction is equivalent to 4/6?',
            opts: ['1/3', '2/3', '3/4', '4/8'],
            ans: 1,
            hint: 'Divide numerator and denominator by their HCF. HCF of 4 and 6 is 2. So 4÷2=2, 6÷2=3. Answer: 2/3.'
          }
        ]
      },
      {
        label: 'B',
        questions: [
          {
            q: 'What is 36 × 25?',
            opts: ['800', '850', '900', '880'],
            ans: 2,
            hint: '36 × 25 = 36 × 100 ÷ 4 = 3600 ÷ 4 = 900. Or: 36 × 20 + 36 × 5 = 720 + 180 = 900.'
          },
          {
            q: 'What is 2/5 of 60?',
            opts: ['20', '24', '30', '12'],
            ans: 1,
            hint: 'Divide by the denominator: 60 ÷ 5 = 12. Then multiply by the numerator: 12 × 2 = 24.'
          },
          {
            q: 'What is 3.40 − 1.76?',
            opts: ['1.64', '1.74', '2.36', '1.54'],
            ans: 0,
            hint: 'Subtract column by column: 340 − 176 = 164 (in the same way as whole numbers), so 3.40 − 1.76 = 1.64.'
          },
          {
            q: 'What is (3 + 5) × 2 − 4?',
            opts: ['12', '14', '16', '10'],
            ans: 0,
            hint: 'Brackets first: (3+5) = 8. Then multiplication: 8×2 = 16. Then subtraction: 16−4 = 12.'
          },
          {
            q: 'What is 504 ÷ 6?',
            opts: ['84', '88', '82', '90'],
            ans: 0,
            hint: 'Short division: 50÷6=8 r2; bring down → 24÷6=4. Answer: 84.'
          },
          {
            q: 'What is 40% of 350?',
            opts: ['120', '130', '140', '150'],
            ans: 2,
            hint: '10% of 350 = 35. Multiply by 4: 35 × 4 = 140.'
          },
          {
            q: 'What is ½ + ⅓?',
            opts: ['2/5', '2/6', '5/6', '1/6'],
            ans: 2,
            hint: 'Find a common denominator. LCM of 2 and 3 is 6. ½ = 3/6, ⅓ = 2/6. Add: 3/6 + 2/6 = 5/6.'
          },
          {
            q: 'What is the value of the digit 7 in the number 3.478?',
            opts: ['7 tenths', '7 hundredths', '7 thousandths', '7 ones'],
            ans: 1,
            hint: 'In a decimal, the columns after the point are: tenths, hundredths, thousandths. In 3.478: 4=tenths, 7=hundredths, 8=thousandths. So 7 = 0.07.'
          }
        ]
      },
      {
        label: 'C',
        questions: [
          {
            q: 'What is 45 × 18?',
            opts: ['800', '810', '750', '720'],
            ans: 1,
            hint: '45 × 18 = 45 × 20 − 45 × 2 = 900 − 90 = 810.'
          },
          {
            q: 'What fraction of 48 is 12?',
            opts: ['1/3', '1/4', '1/6', '1/5'],
            ans: 1,
            hint: 'Write as a fraction: 12/48. Simplify by dividing by the HCF (12): 12÷12=1, 48÷12=4. Answer: 1/4.'
          },
          {
            q: 'What is 0.6 × 0.4?',
            opts: ['2.4', '0.24', '0.024', '24'],
            ans: 1,
            hint: 'Ignore decimals first: 6 × 4 = 24. There are 2 decimal places total, so put the decimal 2 places from the right: 0.24.'
          },
          {
            q: 'What is 20 − 4² ÷ 2?',
            opts: ['64', '8', '12', '18'],
            ans: 2,
            hint: 'BODMAS — Orders (powers) first: 4²=16. Then division: 16÷2=8. Then subtraction: 20−8=12.'
          },
          {
            q: 'What is 250 ÷ 8?',
            opts: ['30 remainder 2', '31 remainder 2', '32 remainder 2', '31 remainder 5'],
            ans: 1,
            hint: '8 × 31 = 248. 250 − 248 = 2. So 31 remainder 2.'
          },
          {
            q: 'What is 35% as a fraction in its simplest form?',
            opts: ['35/100', '7/20', '7/10', '3/5'],
            ans: 1,
            hint: 'Write as a fraction over 100: 35/100. Divide both by the HCF (5): 35÷5=7, 100÷5=20. Answer: 7/20.'
          },
          {
            q: 'What is ¾ − ⅓?',
            opts: ['5/12', '2/3', '1/2', '4/12'],
            ans: 0,
            hint: 'LCM of 4 and 3 is 12. ¾ = 9/12, ⅓ = 4/12. Subtract: 9/12 − 4/12 = 5/12.'
          },
          {
            q: 'Which shows 0.3, ¼, 2/5 and 0.28 in descending order (largest first)?',
            opts: ['0.3, 2/5, 0.28, ¼', '2/5, 0.3, 0.28, ¼', '¼, 0.28, 0.3, 2/5', '0.28, 0.3, ¼, 2/5'],
            ans: 1,
            hint: 'Convert to decimals: 2/5=0.40, 0.3=0.30, 0.28, ¼=0.25. Descending: 0.40, 0.30, 0.28, 0.25 → 2/5, 0.3, 0.28, ¼.'
          }
        ]
      }
    ]
  },
  {
    label: 'Thu 14',
    subject: 'Maths 2',
    sets: [
      {
        label: 'A',
        questions: [
          {
            q: 'How many metres are in 3.5 km?',
            opts: ['350 m', '3,050 m', '3,500 m', '35,000 m'],
            ans: 2,
            hint: 'To convert kilometres to metres, multiply by 1,000. 3.5 × 1,000 = 3,500 m.'
          },
          {
            q: 'What is the area of a rectangle with length 9 cm and width 7 cm?',
            opts: ['32 cm²', '63 cm²', '16 cm²', '45 cm²'],
            ans: 1,
            hint: 'Area of a rectangle = length × width. 9 × 7 = 63 cm².'
          },
          {
            q: 'What is the sum of the interior angles in a triangle?',
            opts: ['90°', '270°', '360°', '180°'],
            ans: 3,
            hint: 'The interior angles of any triangle always add up to 180°. For example, a right-angled triangle: 90° + 45° + 45° = 180°.'
          },
          {
            q: 'What is the mean of 3, 7, 8 and 2?',
            opts: ['4', '5', '6', '7'],
            ans: 1,
            hint: 'Mean = total ÷ number of values. Total: 3+7+8+2 = 20. Divide by 4: 20÷4 = 5.'
          },
          {
            q: 'Simplify the ratio 12 : 8.',
            opts: ['6 : 4', '4 : 3', '3 : 2', '2 : 1'],
            ans: 2,
            hint: 'Divide both numbers by their HCF. HCF of 12 and 8 is 4. So 12÷4=3, 8÷4=2. Simplified: 3 : 2.'
          },
          {
            q: 'How many faces does a cube have?',
            opts: ['4', '5', '8', '6'],
            ans: 3,
            hint: 'A cube has 6 square faces: top, bottom, front, back, left, and right. It also has 12 edges and 8 vertices.'
          },
          {
            q: 'A bag weighs 2,500 g. How much is this in kilograms?',
            opts: ['25 kg', '250 kg', '2.5 kg', '0.25 kg'],
            ans: 2,
            hint: 'To convert grams to kilograms, divide by 1,000. 2,500 ÷ 1,000 = 2.5 kg.'
          },
          {
            q: 'What is the area of a triangle with base 8 cm and height 5 cm?',
            opts: ['40 cm²', '13 cm²', '20 cm²', '26 cm²'],
            ans: 2,
            hint: 'Area of a triangle = ½ × base × height. ½ × 8 × 5 = 20 cm².'
          }
        ]
      },
      {
        label: 'B',
        questions: [
          {
            q: 'How many centimetres are in 2.5 metres?',
            opts: ['25 cm', '250 cm', '2,500 cm', '0.025 cm'],
            ans: 1,
            hint: 'To convert metres to centimetres, multiply by 100. 2.5 × 100 = 250 cm.'
          },
          {
            q: 'What is the perimeter of a rectangle with length 12 cm and width 5 cm?',
            opts: ['17 cm', '34 cm', '60 cm', '30 cm'],
            ans: 1,
            hint: 'Perimeter = 2 × (length + width). 2 × (12 + 5) = 2 × 17 = 34 cm. Perimeter is the total distance around the outside.'
          },
          {
            q: 'What type of angle is 145°?',
            opts: ['Acute', 'Right angle', 'Obtuse', 'Reflex'],
            ans: 2,
            hint: 'Acute: under 90°. Right angle: exactly 90°. Obtuse: between 90° and 180°. Reflex: between 180° and 360°. 145° is between 90° and 180°, so obtuse.'
          },
          {
            q: 'What is the mode of: 3, 5, 7, 3, 8, 5, 3, 2?',
            opts: ['5', '3', '7', '8'],
            ans: 1,
            hint: 'The mode is the value that appears most often. 3 appears 3 times, 5 appears 2 times, others appear once. Mode = 3.'
          },
          {
            q: 'A recipe uses flour and sugar in a ratio of 3 : 1. If you use 120 g of flour, how much sugar do you need?',
            opts: ['30 g', '40 g', '60 g', '90 g'],
            ans: 1,
            hint: 'Find one part: 120 ÷ 3 = 40 g. Sugar is 1 part, so 1 × 40 = 40 g.'
          },
          {
            q: 'How many edges does a triangular prism have?',
            opts: ['6', '9', '12', '5'],
            ans: 1,
            hint: 'A triangular prism has 2 triangular ends (3 edges each = 6) and 3 edges along the length connecting them. Total: 6 + 3 = 9 edges.'
          },
          {
            q: 'What is the volume of a cuboid with length 4 cm, width 3 cm, and height 5 cm?',
            opts: ['60 cm³', '47 cm³', '12 cm³', '20 cm³'],
            ans: 0,
            hint: 'Volume of a cuboid = length × width × height. 4 × 3 × 5 = 60 cm³.'
          },
          {
            q: 'A point at (3, 4) is reflected in the y-axis. What are its new coordinates?',
            opts: ['(3, −4)', '(−3, 4)', '(−3, −4)', '(4, 3)'],
            ans: 1,
            hint: 'Reflecting in the y-axis changes the sign of the x-coordinate but leaves the y-coordinate unchanged. (3, 4) → (−3, 4).'
          }
        ]
      },
      {
        label: 'C',
        questions: [
          {
            q: 'A train leaves at 09:45 and arrives at 12:20. How long is the journey?',
            opts: ['2 hours 25 minutes', '2 hours 35 minutes', '3 hours 25 minutes', '2 hours 15 minutes'],
            ans: 1,
            hint: '09:45 → 10:00 = 15 min. 10:00 → 12:00 = 2 hours. 12:00 → 12:20 = 20 min. Total: 2 hours 35 minutes.'
          },
          {
            q: 'An L-shape is made of two rectangles: one 8 cm × 3 cm and one 4 cm × 5 cm. What is the total area?',
            opts: ['44 cm²', '54 cm²', '40 cm²', '24 cm²'],
            ans: 0,
            hint: 'Split into two rectangles. Area 1: 8 × 3 = 24 cm². Area 2: 4 × 5 = 20 cm². Total: 24 + 20 = 44 cm².'
          },
          {
            q: 'Angles on a straight line add up to:',
            opts: ['90°', '270°', '180°', '360°'],
            ans: 2,
            hint: 'Angles on a straight line always sum to 180°. Subtract the known angles from 180° to find any missing angle.'
          },
          {
            q: 'What is the range of: 4, 9, 2, 15, 7?',
            opts: ['13', '11', '9', '15'],
            ans: 0,
            hint: 'Range = largest value − smallest value. Largest = 15, smallest = 2. Range = 15 − 2 = 13.'
          },
          {
            q: 'In a class of 30 pupils, 12 walk to school. What fraction walk to school, in its simplest form?',
            opts: ['12/30', '2/5', '2/6', '4/10'],
            ans: 1,
            hint: 'Write as a fraction: 12/30. HCF of 12 and 30 is 6. 12÷6=2, 30÷6=5. Answer: 2/5.'
          },
          {
            q: 'Which shape has exactly one line of symmetry?',
            opts: ['Square', 'Non-square rectangle', 'Equilateral triangle', 'Isosceles triangle'],
            ans: 3,
            hint: 'Square: 4 lines. Non-square rectangle: 2 lines. Equilateral triangle: 3 lines. Isosceles triangle: exactly 1 line (through the apex and midpoint of the base).'
          },
          {
            q: 'A jug holds 2.5 litres. How many 200 ml glasses can it completely fill?',
            opts: ['10', '12', '15', '25'],
            ans: 1,
            hint: 'Convert 2.5 litres to ml: 2.5 × 1000 = 2,500 ml. Divide: 2,500 ÷ 200 = 12.5. You can fill 12 complete glasses (100 ml left over).'
          },
          {
            q: 'The angles of a quadrilateral are 85°, 110°, 70°, and x°. What is x?',
            opts: ['85°', '95°', '100°', '75°'],
            ans: 1,
            hint: 'Interior angles of any quadrilateral add up to 360°. 85 + 110 + 70 = 265. So x = 360 − 265 = 95°.'
          }
        ]
      }
    ]
  }
];

let state = null;

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch (e) {}
  return null;
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function defaultState() {
  return {
    activeDay: 0,
    days: DAYS.map(d => ({
      activeSet: 0,
      sets: d.sets.map(s => ({ answers: Array(s.questions.length).fill(null) }))
    }))
  };
}

function getScore(dayIdx, setIdx) {
  const qs = DAYS[dayIdx].sets[setIdx].questions;
  const answers = state.days[dayIdx].sets[setIdx].answers;
  let correct = 0, answered = 0;
  answers.forEach((ans, i) => {
    if (ans !== null) {
      answered++;
      if (ans === qs[i].ans) correct++;
    }
  });
  return { correct, answered, total: qs.length };
}

function updateDayTabs() {
  document.querySelectorAll('.warmup-day-btn').forEach((btn, i) => {
    btn.classList.toggle('active', i === state.activeDay);
    const allDone = DAYS[i].sets.every((_, si) => {
      const { answered, total } = getScore(i, si);
      return answered === total;
    });
    btn.classList.toggle('warmup-day-done', allDone && i !== state.activeDay);
  });
}

function updateSetTabs(dayIdx) {
  document.querySelectorAll('.warmup-set-btn').forEach((btn, si) => {
    const isActive = si === state.days[dayIdx].activeSet;
    btn.classList.toggle('active', isActive);
    const { answered, total } = getScore(dayIdx, si);
    btn.classList.toggle('warmup-set-done', answered === total && !isActive);
  });
}

function renderSet(dayIdx, setIdx) {
  const set = DAYS[dayIdx].sets[setIdx];
  const answers = state.days[dayIdx].sets[setIdx].answers;
  const { correct, answered, total } = getScore(dayIdx, setIdx);

  const tracker = document.getElementById('warmup-score-tracker');
  tracker.textContent = answered === 0
    ? 'Answer the questions below to see your score.'
    : `${correct} correct out of ${answered} answered`;

  const el = document.getElementById('warmup-questions');
  el.innerHTML = '';

  set.questions.forEach((q, qIdx) => {
    const given = answers[qIdx];
    const isAnswered = given !== null;

    const qDiv = document.createElement('div');
    qDiv.className = 'warmup-q';

    const stem = document.createElement('p');
    stem.className = 'warmup-stem';
    stem.innerHTML = `<strong>Q${qIdx + 1}.</strong> ${q.q}`;
    qDiv.appendChild(stem);

    const optsDiv = document.createElement('div');
    optsDiv.className = 'warmup-opts';

    q.opts.forEach((opt, optIdx) => {
      const btn = document.createElement('button');
      btn.className = 'warmup-opt';
      btn.textContent = opt;

      if (isAnswered) {
        btn.disabled = true;
        if (optIdx === q.ans) btn.classList.add('warmup-correct');
        else if (optIdx === given) btn.classList.add('warmup-wrong');
        else btn.classList.add('warmup-neutral');
      } else {
        btn.addEventListener('click', () => selectAnswer(dayIdx, setIdx, qIdx, optIdx));
      }

      optsDiv.appendChild(btn);
    });

    qDiv.appendChild(optsDiv);

    const hintDiv = document.createElement('div');
    hintDiv.className = 'warmup-hint' + (isAnswered ? '' : ' hidden');
    hintDiv.innerHTML = `<strong>Hint:</strong> ${q.hint}`;
    qDiv.appendChild(hintDiv);

    el.appendChild(qDiv);
  });

  const summary = document.getElementById('warmup-summary');
  if (answered === total) {
    renderSummary(dayIdx, setIdx, correct, total);
    summary.classList.remove('hidden');
  } else {
    summary.classList.add('hidden');
  }

  updateSetTabs(dayIdx);
  updateDayTabs();
  renderDashboard();
}

function renderSummary(dayIdx, setIdx, correct, total) {
  const summary = document.getElementById('warmup-summary');
  const pct = Math.round((correct / total) * 100);
  const day = DAYS[dayIdx];
  const set = day.sets[setIdx];

  let msg;
  if (pct === 100) msg = 'Perfect score! Excellent work!';
  else if (pct >= 75) msg = 'Great effort! Review the questions you missed.';
  else if (pct >= 50) msg = 'Good try! Look back at the hints to understand each topic.';
  else msg = 'Keep practising — check the hints carefully to improve.';

  summary.innerHTML = `
    <div class="warmup-summary-box">
      <h3>${day.label} Set ${set.label} — ${day.subject} complete!</h3>
      <div class="warmup-summary-score">${correct} / ${total}</div>
      <p class="muted" style="margin:4px 0 0;">${pct}% &mdash; ${msg}</p>
    </div>
  `;
}

function renderDashboard() {
  const dash = document.getElementById('warmup-dashboard');
  dash.innerHTML = '<p class="warmup-dash-title">Week at a Glance</p>';

  const grid = document.createElement('div');
  grid.className = 'warmup-dash-grid';

  DAYS.forEach((day, di) => {
    const cell = document.createElement('div');
    cell.className = 'warmup-dash-cell';

    const allComplete = day.sets.every((_, si) => {
      const { answered, total } = getScore(di, si);
      return answered === total;
    });
    if (allComplete) cell.classList.add('warmup-dash-complete');

    const setRows = day.sets.map((set, si) => {
      const { correct, answered, total } = getScore(di, si);
      const done = answered === total;
      const val = done ? `${correct}/${total}` : answered > 0 ? `${answered}/${total}` : '—';
      return `<span class="warmup-dash-set${done ? ' warmup-dash-set-done' : ''}">Set ${set.label}: ${val}</span>`;
    }).join('');

    cell.innerHTML = `
      <div class="warmup-dash-label">${day.label}</div>
      <div class="warmup-dash-subject">${day.subject}</div>
      <div class="warmup-dash-sets">${setRows}</div>
    `;
    grid.appendChild(cell);
  });

  dash.appendChild(grid);
}

function selectAnswer(dayIdx, setIdx, qIdx, optIdx) {
  state.days[dayIdx].sets[setIdx].answers[qIdx] = optIdx;
  saveState();
  renderSet(dayIdx, setIdx);
}

function activateSet(dayIdx, setIdx) {
  state.days[dayIdx].activeSet = setIdx;
  saveState();
  renderSet(dayIdx, setIdx);
}

function activateDay(dayIdx) {
  state.activeDay = dayIdx;
  saveState();
  buildSetTabs(dayIdx);
  renderSet(dayIdx, state.days[dayIdx].activeSet);
}

function buildSetTabs(dayIdx) {
  const setTabsEl = document.getElementById('warmup-set-tabs');
  setTabsEl.innerHTML = '';
  DAYS[dayIdx].sets.forEach((set, si) => {
    const btn = document.createElement('button');
    btn.className = 'warmup-set-btn';
    btn.textContent = `Set ${set.label}`;
    btn.addEventListener('click', () => activateSet(dayIdx, si));
    setTabsEl.appendChild(btn);
  });
}

export function initWarmup() {
  state = loadState() || defaultState();

  // Ensure state has the right shape (handles old saves with no sets)
  const hasNewShape = state.days && state.days[0] && state.days[0].sets;
  if (!hasNewShape) state = defaultState();

  const dayTabsEl = document.getElementById('warmup-day-tabs');
  DAYS.forEach((day, i) => {
    const btn = document.createElement('button');
    btn.className = 'warmup-day-btn';
    btn.innerHTML = `<span class="warmup-day-name">${day.label}</span><span class="warmup-day-subject">${day.subject}</span>`;
    btn.addEventListener('click', () => activateDay(i));
    dayTabsEl.appendChild(btn);
  });

  document.getElementById('warmup-reset-btn').addEventListener('click', () => {
    const dayIdx = state.activeDay;
    const setIdx = state.days[dayIdx].activeSet;
    const total = DAYS[dayIdx].sets[setIdx].questions.length;
    state.days[dayIdx].sets[setIdx].answers = Array(total).fill(null);
    saveState();
    renderSet(dayIdx, setIdx);
  });

  buildSetTabs(state.activeDay);
  renderSet(state.activeDay, state.days[state.activeDay].activeSet);
}
