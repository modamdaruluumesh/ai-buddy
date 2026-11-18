import type { CompanionMode } from '../types/companion';

export type GameDifficulty = 'relaxed' | 'balanced' | 'sharp';

export type GameReactionEvent =
  | 'start'
  | 'player_good_move'
  | 'ai_good_move'
  | 'player_win'
  | 'ai_win'
  | 'draw'
  | 'hint';

export function getGameReaction(
  mode: CompanionMode,
  event: GameReactionEvent,
  gameName: string
): string {
  const pool: Record<CompanionMode, Record<GameReactionEvent, string[]>> = {
    supportive: {
      start: [
        `Take your time with ${gameName}. No rush, no timer breathing down your neck.`,
        `Glad we're playing ${gameName}. Let's just enjoy a quiet round.`,
      ],
      player_good_move: [
        'That was a really thoughtful move.',
        'Nice read—you spotted that cleanly.',
      ],
      ai_good_move: [
        'I found a small opening there—let us see how you answer it.',
        'Holding my ground on that side for now.',
      ],
      player_win: [
        'Well played. You stayed patient and earned that win.',
        'Clean finish. Always satisfying when a plan comes together.',
      ],
      ai_win: [
        'Got you that round—want a rematch, or try a fresh angle?',
        'Good game. You made me work for that edge.',
      ],
      draw: [
        'Dead even. Both of us held the line.',
        'A quiet stalemate—honestly feels fair.',
      ],
      hint: ['Look closely at what is left undefended right now.'],
    },
    hard_truth: {
      start: [
        `Alright, ${gameName}. No going easy—focus up.`,
        `Let us see if your strategy holds up in ${gameName}.`,
      ],
      player_good_move: [
        'Sharp. You actually looked two steps ahead there.',
        'Okay, I respect that move.',
      ],
      ai_good_move: [
        'You left that lane wide open.',
        'You missed the threat on the other side—here is the cost.',
      ],
      player_win: [
        'Fair and square. You out-calculated me this time.',
        'Credit where it is due—you closed that out cleanly.',
      ],
      ai_win: [
        'Rushed the middle game. Reset and tighten your defense.',
        'I warned you about that tempo. Rematch?',
      ],
      draw: [
        'Neither of us blinked. Tighter endgame next time.',
        'Draw. Solid defense, though we both missed a chance.',
      ],
      hint: ['Stop reacting to my last move and check the whole board.'],
    },
    growth_guide: {
      start: [
        `Notice how your mind approaches ${gameName}—steady observation beats impulse.`,
        `Let us treat ${gameName} as a quiet sandbox for pattern recognition.`,
      ],
      player_good_move: [
        'Good patience—you waited for the stronger line.',
        'Nice awareness of the whole board.',
      ],
      ai_good_move: [
        'Testing your adaptability here.',
        'Notice how one small shift changes the whole structure.',
      ],
      player_win: [
        'Consistent small decisions won that—not one lucky flash.',
        'Great composure from start to finish.',
      ],
      ai_win: [
        'Every loss shows one blind spot clearly. Want to run it back?',
        'Good experiment. Notice which turn shifted momentum.',
      ],
      draw: [
        'Balanced tension all the way through.',
        'Solid symmetry—neither side overreached.',
      ],
      hint: ['Ask what the board needs next rather than what feels urgent.'],
    },
    chill: {
      start: [
        `Ooh, ${gameName}. Winner gets bragging rights for the next five minutes.`,
        `Settling in for ${gameName}. Let us see what happens.`,
      ],
      player_good_move: [
        'Wait—okay, sneaky. I see what you did there.',
        'Oh nice, did not love seeing that!',
      ],
      ai_good_move: [
        'Boop. Just casually sliding right in here.',
        'Do not mind me, totally innocent move.',
      ],
      player_win: [
        'Alright, you cooked me. Respect.',
        'Okay champ, take your victory lap.',
      ],
      ai_win: [
        'Hehe, snagged that one! Run it back?',
        'Gotcha. Best two out of three?',
      ],
      draw: [
        'Tie game—clearly we share one brain cell right now.',
        'Draw! Nobody loses, everybody vibes.',
      ],
      hint: ['Psst—check the quiet corner before I notice it.'],
    },
  };

  const list = pool[mode][event];
  return list[Math.floor(Math.random() * list.length)];
}

// --- TIC TAC TOE ---
export type TttCell = 'X' | 'O' | null;

export function checkTttWinner(board: TttCell[]): { winner: 'X' | 'O' | 'draw' | null; line: number[] } {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];
  for (const line of lines) {
    const [a, b, c] = line;
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return { winner: board[a], line };
    }
  }
  if (board.every((cell) => cell !== null)) {
    return { winner: 'draw', line: [] };
  }
  return { winner: null, line: [] };
}

function tttMinimax(board: TttCell[], isMax: boolean, depth: number): number {
  const { winner } = checkTttWinner(board);
  if (winner === 'O') return 10 - depth;
  if (winner === 'X') return depth - 10;
  if (winner === 'draw') return 0;

  let best = isMax ? -Infinity : Infinity;
  for (let i = 0; i < 9; i += 1) {
    if (!board[i]) {
      board[i] = isMax ? 'O' : 'X';
      const score = tttMinimax(board, !isMax, depth + 1);
      board[i] = null;
      best = isMax ? Math.max(best, score) : Math.min(best, score);
    }
  }
  return best;
}

export function getTicTacToeAiMove(board: TttCell[], difficulty: GameDifficulty): number {
  const empty = board.map((v, i) => (v === null ? i : -1)).filter((i) => i !== -1);
  if (empty.length === 0) return -1;

  if (difficulty === 'relaxed' && Math.random() < 0.65) {
    return empty[Math.floor(Math.random() * empty.length)];
  }
  if (difficulty === 'balanced' && Math.random() < 0.3) {
    return empty[Math.floor(Math.random() * empty.length)];
  }

  let bestScore = -Infinity;
  let bestMove = empty[0];
  for (const idx of empty) {
    const copy = [...board];
    copy[idx] = 'O';
    const score = tttMinimax(copy, false, 0);
    if (score > bestScore) {
      bestScore = score;
      bestMove = idx;
    }
  }
  return bestMove;
}

// --- CONNECT FOUR (6 rows x 7 cols) ---
export type C4Cell = 0 | 1 | 2; // 1 = player, 2 = AI

export function createC4Board(): C4Cell[][] {
  return Array.from({ length: 6 }, () => Array<C4Cell>(7).fill(0));
}

export function dropC4Piece(board: C4Cell[][], col: number, player: 1 | 2): { row: number; next: C4Cell[][] } | null {
  for (let r = 5; r >= 0; r -= 1) {
    if (board[r][col] === 0) {
      const next = board.map((row) => [...row]);
      next[r][col] = player;
      return { row: r, next };
    }
  }
  return null;
}

export function checkC4Winner(board: C4Cell[][]): { winner: 1 | 2 | 'draw' | null; cells: Array<[number, number]> } {
  const dirs = [
    [0, 1],
    [1, 0],
    [1, 1],
    [1, -1],
  ];
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c < 7; c += 1) {
      const p = board[r][c];
      if (p === 0) continue;
      for (const [dr, dc] of dirs) {
        const cells: Array<[number, number]> = [[r, c]];
        for (let step = 1; step < 4; step += 1) {
          const nr = r + dr * step;
          const nc = c + dc * step;
          if (nr < 0 || nr >= 6 || nc < 0 || nc >= 7 || board[nr][nc] !== p) break;
          cells.push([nr, nc]);
        }
        if (cells.length === 4) return { winner: p, cells };
      }
    }
  }
  if (board[0].every((c) => c !== 0)) return { winner: 'draw', cells: [] };
  return { winner: null, cells: [] };
}

function scoreC4Window(window: C4Cell[], player: 1 | 2): number {
  const opp = player === 2 ? 1 : 2;
  const pCount = window.filter((c) => c === player).length;
  const oCount = window.filter((c) => c === opp).length;
  const eCount = window.filter((c) => c === 0).length;
  if (pCount === 4) return 10000;
  if (oCount === 4) return -10000;
  let score = 0;
  if (pCount === 3 && eCount === 1) score += 25;
  if (pCount === 2 && eCount === 2) score += 4;
  if (oCount === 3 && eCount === 1) score -= 35;
  return score;
}

function evaluateC4(board: C4Cell[][]): number {
  let score = 0;
  // Center column preference
  for (let r = 0; r < 6; r += 1) {
    if (board[r][3] === 2) score += 6;
    if (board[r][3] === 1) score -= 6;
  }
  // Horizontal
  for (let r = 0; r < 6; r += 1) {
    for (let c = 0; c <= 3; c += 1) {
      score += scoreC4Window([board[r][c], board[r][c + 1], board[r][c + 2], board[r][c + 3]], 2);
    }
  }
  // Vertical
  for (let c = 0; c < 7; c += 1) {
    for (let r = 0; r <= 2; r += 1) {
      score += scoreC4Window([board[r][c], board[r + 1][c], board[r + 2][c], board[r + 3][c]], 2);
    }
  }
  // Diagonals
  for (let r = 0; r <= 2; r += 1) {
    for (let c = 0; c <= 3; c += 1) {
      score += scoreC4Window([board[r][c], board[r + 1][c + 1], board[r + 2][c + 2], board[r + 3][c + 3]], 2);
      score += scoreC4Window([board[r + 3][c], board[r + 2][c + 1], board[r + 1][c + 2], board[r][c + 3]], 2);
    }
  }
  return score;
}

function c4Minimax(
  board: C4Cell[][],
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): { col: number; score: number } {
  const validCols = [3, 2, 4, 1, 5, 0, 6].filter((c) => board[0][c] === 0);
  const { winner } = checkC4Winner(board);
  if (winner === 2) return { col: -1, score: 100000 + depth };
  if (winner === 1) return { col: -1, score: -100000 - depth };
  if (winner === 'draw' || validCols.length === 0) return { col: -1, score: 0 };
  if (depth === 0) return { col: -1, score: evaluateC4(board) };

  let bestCol = validCols[0];
  if (maximizing) {
    let value = -Infinity;
    for (const col of validCols) {
      const dropped = dropC4Piece(board, col, 2);
      if (!dropped) continue;
      const res = c4Minimax(dropped.next, depth - 1, alpha, beta, false).score;
      if (res > value) {
        value = res;
        bestCol = col;
      }
      alpha = Math.max(alpha, value);
      if (alpha >= beta) break;
    }
    return { col: bestCol, score: value };
  }
  let value = Infinity;
  for (const col of validCols) {
    const dropped = dropC4Piece(board, col, 1);
    if (!dropped) continue;
    const res = c4Minimax(dropped.next, depth - 1, alpha, beta, true).score;
    if (res < value) {
      value = res;
      bestCol = col;
    }
    beta = Math.min(beta, value);
    if (alpha >= beta) break;
  }
  return { col: bestCol, score: value };
}

export function getConnectFourAiMove(board: C4Cell[][], difficulty: GameDifficulty): number {
  const validCols = [0, 1, 2, 3, 4, 5, 6].filter((c) => board[0][c] === 0);
  if (validCols.length === 0) return -1;
  if (difficulty === 'relaxed' && Math.random() < 0.45) {
    return validCols[Math.floor(Math.random() * validCols.length)];
  }
  const depth = difficulty === 'relaxed' ? 1 : difficulty === 'balanced' ? 3 : 4;
  return c4Minimax(board, depth, -Infinity, Infinity, true).col;
}

// --- SUDOKU GENERATOR ---
export interface SudokuPuzzle {
  puzzle: number[][];
  solution: number[][];
  fixed: boolean[][];
}

function shuffleArr<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function isValidSudokuPlace(grid: number[][], row: number, col: number, num: number): boolean {
  for (let i = 0; i < 9; i += 1) {
    if (grid[row][i] === num || grid[i][col] === num) return false;
  }
  const br = Math.floor(row / 3) * 3;
  const bc = Math.floor(col / 3) * 3;
  for (let r = br; r < br + 3; r += 1) {
    for (let c = bc; c < bc + 3; c += 1) {
      if (grid[r][c] === num) return false;
    }
  }
  return true;
}

function fillSudoku(grid: number[][]): boolean {
  for (let r = 0; r < 9; r += 1) {
    for (let c = 0; c < 9; c += 1) {
      if (grid[r][c] === 0) {
        for (const num of shuffleArr([1, 2, 3, 4, 5, 6, 7, 8, 9])) {
          if (isValidSudokuPlace(grid, r, c, num)) {
            grid[r][c] = num;
            if (fillSudoku(grid)) return true;
            grid[r][c] = 0;
          }
        }
        return false;
      }
    }
  }
  return true;
}

export function generateSudoku(difficulty: GameDifficulty): SudokuPuzzle {
  const solution = Array.from({ length: 9 }, () => Array<number>(9).fill(0));
  fillSudoku(solution);
  const puzzle = solution.map((r) => [...r]);
  const removeCount = difficulty === 'relaxed' ? 36 : difficulty === 'balanced' ? 46 : 54;
  const positions = shuffleArr(Array.from({ length: 81 }, (_, i) => i));
  for (let i = 0; i < removeCount; i += 1) {
    const pos = positions[i];
    puzzle[Math.floor(pos / 9)][pos % 9] = 0;
  }
  const fixed = puzzle.map((row) => row.map((v) => v !== 0));
  return { puzzle, solution, fixed };
}

// --- WORD GUESS & HANGMAN ---
export const FIVE_LETTER_WORDS = [
  'QUIET', 'STILL', 'LIGHT', 'STONE', 'AMBER', 'DREAM', 'SOUND', 'SPACE',
  'CLOUD', 'DEPTH', 'GRACE', 'PAUSE', 'SOLAR', 'SPARK', 'HEART', 'NORTH',
  'DRIFT', 'BLOOM', 'SENSE', 'CLEAR', 'PEACE', 'NIGHT', 'FOCUS', 'TRACE',
  'RIVER', 'OCEAN', 'FRAME', 'PULSE', 'BRAVE', 'HONEST'.slice(0, 5),
].filter((w) => w.length === 5);

export const HANGMAN_WORDS: Array<{ word: string; hint: string }> = [
  { word: 'SANCTUARY', hint: 'A quiet private refuge' },
  { word: 'SOLITUDE', hint: 'Being alone without feeling lonely' },
  { word: 'COMPASSION', hint: 'Understanding someone else’s weight' },
  { word: 'PERSPECTIVE', hint: 'Seeing the wider picture' },
  { word: 'RESILIENCE', hint: 'Recovering quietly after strain' },
  { word: 'ASTROPHYSICS', hint: 'The physics of distant stars' },
  { word: 'MELANCHOLY', hint: 'Gentle, thoughtful sadness' },
  { word: 'SERENDIPITY', hint: 'A fortunate unexpected discovery' },
  { word: 'INTROSPECTION', hint: 'Looking inward without judgment' },
  { word: 'LABYRINTH', hint: 'A winding architectural puzzle' },
];

// --- 20 QUESTIONS OFFLINE TREE ---
export interface TwentyQNode {
  question?: string;
  yes?: TwentyQNode;
  no?: TwentyQNode;
  guess?: string;
}

export const TWENTY_QUESTIONS_TREE: TwentyQNode = {
  question: 'Is it a living thing (plant or animal)?',
  yes: {
    question: 'Is it an animal?',
    yes: {
      question: 'Would it comfortably fit inside a backpack?',
      yes: {
        question: 'Can it fly?',
        yes: { guess: 'an Owl or Songbird' },
        no: {
          question: 'Does it purr or meow?',
          yes: { guess: 'a Cat' },
          no: { guess: 'a Fox or Hedgehog' },
        },
      },
      no: {
        question: 'Does it live primarily in the ocean?',
        yes: { guess: 'a Whale or Dolphin' },
        no: { guess: 'a Wolf or Deer' },
      },
    },
    no: {
      question: 'Does it grow tall with a wooden trunk?',
      yes: { guess: 'an Oak or Pine Tree' },
      no: { guess: 'a Houseplant or Wildflower' },
    },
  },
  no: {
    question: 'Does it require electricity or a battery to do its main job?',
    yes: {
      question: 'Do you usually listen to audio through it?',
      yes: { guess: 'Headphones or a Vinyl Turntable' },
      no: {
        question: 'Do you look at a screen on it?',
        yes: { guess: 'a Laptop or Phone' },
        no: { guess: 'a Reading Lamp' },
      },
    },
    no: {
      question: 'Can you hold it in one hand?',
      yes: {
        question: 'Do you drink from it or write with it?',
        yes: {
          question: 'Is it for warm drinks?',
          yes: { guess: 'a Ceramic Mug' },
          no: { guess: 'a Fountain Pen or Notebook' },
        },
        no: { guess: 'a Mechanical Watch or Pocket Key' },
      },
      no: {
        question: 'Is it something you sit, sleep, or read on?',
        yes: { guess: 'an Armchair or Bookshelf' },
        no: { guess: 'a Bicycle or Acoustic Guitar' },
      },
    },
  },
};

// --- SOCIAL / THOUGHT PROMPTS ---
export const WOULD_YOU_RATHER_PROMPTS: Array<[string, string]> = [
  ['Have a quiet cabin in the rainy mountains for a year', 'Have a penthouse studio overlooking Tokyo at midnight'],
  ['Always know when someone is lying to you', 'Always know what someone genuinely appreciates about you'],
  ['Be able to pause time for 30 minutes a day to breathe', 'Need only 3 hours of sleep and wake up fully rested'],
  ['Master any musical instrument in one month', 'Speak and read four new languages fluently'],
  ['Re-experience your favorite film as if for the first time', 'Have an extra quiet Sunday every single week'],
  ['Live in a world with zero social media forever', 'Live in a world where everyone speaks completely honestly'],
];

export const RIDDLES: Array<{ riddle: string; answer: string; clue: string }> = [
  {
    riddle: 'The more of me there is, the less you can see. What am I?',
    answer: 'darkness',
    clue: 'Think about nightfall.',
  },
  {
    riddle: 'I speak without a mouth and hear without ears. I come alive with wind. What am I?',
    answer: 'echo',
    clue: 'You hear me in canyons and empty halls.',
  },
  {
    riddle: 'I have cities, but no houses. I have mountains, but no trees. I have water, but no fish. What am I?',
    answer: 'map',
    clue: 'Travelers fold or zoom in on me.',
  },
  {
    riddle: 'What belongs to you, yet everyone else uses it far more than you do?',
    answer: 'name',
    clue: 'People say it when they call out to you.',
  },
  {
    riddle: 'I am fragile enough that even saying my name breaks me. What am I?',
    answer: 'silence',
    clue: 'Introverts often value me.',
  },
];

export const STORY_OPENERS: string[] = [
  'The train slowed down at a station that did not appear on any timetable, and only one streetlamp flickered outside.',
  'On the top shelf of the thrift store sat a brass compass whose needle always pointed toward the nearest person keeping a secret.',
  'At 2:14 AM, every clock in the apartment stopped—except for the small kitchen timer that started counting upward.',
];

export const STORY_AI_CONTINUATIONS: string[] = [
  'Across the wet pavement, someone stepped out from under an awning holding a folded paper note.',
  'Before either of them spoke, a faint hum echoed from inside the metal casing.',
  'She hesitated with her hand on the doorknob, realizing the footsteps upstairs had suddenly stopped.',
  'Instead of turning back, he set his tea down beside the window and opened the latch.',
  'The ink on the margin seemed to shift whenever the room grew quiet.',
];
