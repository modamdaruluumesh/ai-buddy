import { useEffect, useState } from 'react';
import { Gamepad2, Lightbulb, RotateCcw } from 'lucide-react';
import { CompanionOrb } from './CompanionOrb';
import {
  applyChessMove,
  createInitialChessState,
  getChessAiMove,
  getLegalMovesForSquare,
  PIECE_GLYPHS,
  type ChessMove,
  type ChessState,
} from '../services/chessEngine';
import {
  checkC4Winner,
  checkTttWinner,
  createC4Board,
  dropC4Piece,
  FIVE_LETTER_WORDS,
  generateSudoku,
  getConnectFourAiMove,
  getGameReaction,
  getTicTacToeAiMove,
  HANGMAN_WORDS,
  RIDDLES,
  STORY_AI_CONTINUATIONS,
  STORY_OPENERS,
  TWENTY_QUESTIONS_TREE,
  WOULD_YOU_RATHER_PROMPTS,
  type C4Cell,
  type GameDifficulty,
  type TttCell,
  type TwentyQNode,
} from '../services/gameEngine';
import type { CompanionMode, SanctuaryVaultData } from '../types/companion';

type GameId =
  | 'tictactoe'
  | 'connect4'
  | 'chess'
  | 'sudoku'
  | 'wordguess'
  | 'hangman'
  | 'memory'
  | 'twentyq'
  | 'social';

const GAMES_LIST: Array<{ id: GameId; label: string; desc: string }> = [
  { id: 'tictactoe', label: 'Tic-Tac-Toe', desc: 'Classic 3×3 tactics' },
  { id: 'connect4', label: 'Connect Four', desc: '7×6 vertical strategy' },
  { id: 'chess', label: 'Chess', desc: 'Full rules vs. AI' },
  { id: 'sudoku', label: 'Sudoku', desc: '9×9 logic grid' },
  { id: 'wordguess', label: 'Word Guess', desc: '5-letter deduction' },
  { id: 'hangman', label: 'Hangman', desc: 'Calm word rescue' },
  { id: 'memory', label: 'Memory Match', desc: 'Symbol pair recall' },
  { id: 'twentyq', label: '20 Questions', desc: 'Sora guesses your thought' },
  { id: 'social', label: 'Thought Play', desc: 'Riddles, WYR & Story' },
];

interface GameRoomViewProps {
  vault: SanctuaryVaultData;
  onRecordGamePlayed: () => void;
  onChangeGameTheme: (theme: 'obsidian' | 'brass' | 'twilight') => void;
}

export function GameRoomView({
  vault,
  onRecordGamePlayed,
  onChangeGameTheme,
}: GameRoomViewProps) {
  const mode: CompanionMode = vault.profile.defaultMode;
  const [activeGame, setActiveGame] = useState<GameId>('connect4');
  const [difficulty, setDifficulty] = useState<GameDifficulty>('balanced');
  const [reaction, setReaction] = useState<string>(
    getGameReaction(mode, 'start', 'Connect Four')
  );

  // --- Tic-Tac-Toe ---
  const [tttBoard, setTttBoard] = useState<TttCell[]>(Array(9).fill(null));
  const [tttStatus, setTttStatus] = useState<'X' | 'O' | 'draw' | null>(null);

  // --- Connect Four ---
  const [c4Board, setC4Board] = useState<C4Cell[][]>(() => createC4Board());
  const [c4Winner, setC4Winner] = useState<1 | 2 | 'draw' | null>(null);
  const [c4Thinking, setC4Thinking] = useState(false);

  // --- Chess ---
  const [chess, setChess] = useState<ChessState>(() => createInitialChessState());
  const [selectedSq, setSelectedSq] = useState<[number, number] | null>(null);
  const [legalMoves, setLegalMoves] = useState<ChessMove[]>([]);
  const [chessThinking, setChessThinking] = useState(false);

  // --- Sudoku ---
  const [sudoku, setSudoku] = useState(() => generateSudoku('balanced'));
  const [sudokuSelected, setSudokuSelected] = useState<[number, number] | null>(null);
  const [sudokuSolved, setSudokuSolved] = useState(false);

  // --- Word Guess ---
  const [wgTarget, setWgTarget] = useState(
    () => FIVE_LETTER_WORDS[Math.floor(Math.random() * FIVE_LETTER_WORDS.length)]
  );
  const [wgGuesses, setWgGuesses] = useState<string[]>([]);
  const [wgInput, setWgInput] = useState('');
  const [wgDone, setWgDone] = useState<'won' | 'lost' | null>(null);

  // --- Hangman ---
  const [hmItem, setHmItem] = useState(
    () => HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)]
  );
  const [hmLetters, setHmLetters] = useState<string[]>([]);

  // --- Memory Match ---
  const SYMBOLS = ['◐', '◈', '✦', '△', '❖', '☾', '❂', '✧'];
  const [memCards, setMemCards] = useState<Array<{ sym: string; flipped: boolean; matched: boolean }>>(
    () =>
      [...SYMBOLS, ...SYMBOLS]
        .sort(() => Math.random() - 0.5)
        .map((sym) => ({ sym, flipped: false, matched: false }))
  );
  const [memPicked, setMemPicked] = useState<number[]>([]);

  // --- 20 Questions ---
  const [qNode, setQNode] = useState<TwentyQNode>(TWENTY_QUESTIONS_TREE);
  const [qSteps, setQSteps] = useState(0);
  const [qOutcome, setQOutcome] = useState<string | null>(null);

  // --- Social Play ---
  const [socialTab, setSocialTab] = useState<'wyr' | 'riddle' | 'story'>('wyr');
  const [wyrIdx, setWyrIdx] = useState(0);
  const [riddleIdx, setRiddleIdx] = useState(0);
  const [riddleGuess, setRiddleGuess] = useState('');
  const [riddleState, setRiddleState] = useState<'open' | 'solved' | 'revealed'>('open');
  const [storyLines, setStoryLines] = useState<Array<{ who: string; text: string }>>([
    { who: vault.profile.companionName, text: STORY_OPENERS[0] },
  ]);
  const [storyDraft, setStoryDraft] = useState('');

  const themeClass =
    vault.profile.activeGameTheme === 'brass'
      ? 'border-[#D4A359]/40 bg-[#171512]'
      : vault.profile.activeGameTheme === 'twilight'
        ? 'border-[#8B82B8]/40 bg-[#14131E]'
        : 'border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B]';

  const switchGame = (id: GameId) => {
    setActiveGame(id);
    const name = GAMES_LIST.find((g) => g.id === id)?.label ?? 'Game';
    setReaction(getGameReaction(mode, 'start', name));
  };

  // --- Tic-Tac-Toe Handlers ---
  const resetTtt = () => {
    setTttBoard(Array(9).fill(null));
    setTttStatus(null);
    setReaction(getGameReaction(mode, 'start', 'Tic-Tac-Toe'));
  };

  const handleTttClick = (idx: number) => {
    if (tttBoard[idx] || tttStatus) return;
    const next = [...tttBoard];
    next[idx] = 'X';
    const check1 = checkTttWinner(next);
    if (check1.winner) {
      setTttBoard(next);
      setTttStatus(check1.winner);
      onRecordGamePlayed();
      setReaction(
        getGameReaction(mode, check1.winner === 'X' ? 'player_win' : 'draw', 'Tic-Tac-Toe')
      );
      return;
    }
    const aiIdx = getTicTacToeAiMove(next, difficulty);
    if (aiIdx !== -1) next[aiIdx] = 'O';
    const check2 = checkTttWinner(next);
    setTttBoard(next);
    if (check2.winner) {
      setTttStatus(check2.winner);
      onRecordGamePlayed();
      setReaction(
        getGameReaction(mode, check2.winner === 'O' ? 'ai_win' : 'draw', 'Tic-Tac-Toe')
      );
    }
  };

  // --- Connect Four Handlers ---
  const resetC4 = () => {
    setC4Board(createC4Board());
    setC4Winner(null);
    setC4Thinking(false);
    setReaction(getGameReaction(mode, 'start', 'Connect Four'));
  };

  const handleC4Drop = (col: number) => {
    if (c4Winner || c4Thinking) return;
    const drop1 = dropC4Piece(c4Board, col, 1);
    if (!drop1) return;
    setC4Board(drop1.next);
    const res1 = checkC4Winner(drop1.next);
    if (res1.winner) {
      setC4Winner(res1.winner);
      onRecordGamePlayed();
      setReaction(
        getGameReaction(mode, res1.winner === 1 ? 'player_win' : 'draw', 'Connect Four')
      );
      return;
    }

    setC4Thinking(true);
    setTimeout(() => {
      const aiCol = getConnectFourAiMove(drop1.next, difficulty);
      if (aiCol !== -1) {
        const drop2 = dropC4Piece(drop1.next, aiCol, 2);
        if (drop2) {
          setC4Board(drop2.next);
          const res2 = checkC4Winner(drop2.next);
          if (res2.winner) {
            setC4Winner(res2.winner);
            onRecordGamePlayed();
            setReaction(
              getGameReaction(mode, res2.winner === 2 ? 'ai_win' : 'draw', 'Connect Four')
            );
          } else {
            setReaction(getGameReaction(mode, 'ai_good_move', 'Connect Four'));
          }
        }
      }
      setC4Thinking(false);
    }, 260);
  };

  // --- Chess Handlers ---
  const resetChess = () => {
    setChess(createInitialChessState());
    setSelectedSq(null);
    setLegalMoves([]);
    setChessThinking(false);
    setReaction(getGameReaction(mode, 'start', 'Chess'));
  };

  const handleChessSquareClick = (r: number, c: number) => {
    if (chessThinking || chess.turn !== 'w' || chess.status === 'checkmate' || chess.status === 'stalemate') {
      return;
    }

    const matchingMove = legalMoves.find((m) => m.toRow === r && m.toCol === c);
    if (matchingMove) {
      const captured = chess.board[r][c];
      const nextState = applyChessMove(chess, matchingMove);
      setChess(nextState);
      setSelectedSq(null);
      setLegalMoves([]);

      if (nextState.status === 'checkmate' || nextState.status === 'stalemate') {
        onRecordGamePlayed();
        setReaction(
          getGameReaction(
            mode,
            nextState.winner === 'w' ? 'player_win' : 'draw',
            'Chess'
          )
        );
        return;
      }
      if (captured) {
        setReaction(getGameReaction(mode, 'player_good_move', 'Chess'));
      }

      setChessThinking(true);
      setTimeout(() => {
        const aiMove = getChessAiMove(nextState, difficulty);
        if (aiMove) {
          const afterAi = applyChessMove(nextState, aiMove);
          setChess(afterAi);
          if (afterAi.status === 'checkmate' || afterAi.status === 'stalemate') {
            onRecordGamePlayed();
            setReaction(
              getGameReaction(mode, afterAi.winner === 'b' ? 'ai_win' : 'draw', 'Chess')
            );
          } else if (afterAi.status === 'check') {
            setReaction('Check. Watch your king closely.');
          }
        }
        setChessThinking(false);
      }, 280);
      return;
    }

    const piece = chess.board[r][c];
    if (piece?.color === 'w') {
      setSelectedSq([r, c]);
      setLegalMoves(getLegalMovesForSquare(chess, r, c));
    } else {
      setSelectedSq(null);
      setLegalMoves([]);
    }
  };

  // --- Sudoku Handlers ---
  const resetSudoku = (diff = difficulty) => {
    setSudoku(generateSudoku(diff));
    setSudokuSelected(null);
    setSudokuSolved(false);
    setReaction(getGameReaction(mode, 'start', 'Sudoku'));
  };

  const setSudokuCellValue = (val: number) => {
    if (!sudokuSelected || sudokuSolved) return;
    const [r, c] = sudokuSelected;
    if (sudoku.fixed[r][c]) return;
    const nextPuzzle = sudoku.puzzle.map((row) => [...row]);
    nextPuzzle[r][c] = val;
    setSudoku({ ...sudoku, puzzle: nextPuzzle });

    const complete = nextPuzzle.every((row, ri) =>
      row.every((cell, ci) => cell === sudoku.solution[ri][ci])
    );
    if (complete) {
      setSudokuSolved(true);
      onRecordGamePlayed();
      setReaction(getGameReaction(mode, 'player_win', 'Sudoku'));
    }
  };

  const giveSudokuHint = () => {
    for (let r = 0; r < 9; r += 1) {
      for (let c = 0; c < 9; c += 1) {
        if (sudoku.puzzle[r][c] !== sudoku.solution[r][c]) {
          const nextPuzzle = sudoku.puzzle.map((row) => [...row]);
          nextPuzzle[r][c] = sudoku.solution[r][c];
          setSudoku({ ...sudoku, puzzle: nextPuzzle });
          setReaction(getGameReaction(mode, 'hint', 'Sudoku'));
          return;
        }
      }
    }
  };

  // --- Memory Match Handlers ---
  const resetMemory = () => {
    setMemCards(
      [...SYMBOLS, ...SYMBOLS]
        .sort(() => Math.random() - 0.5)
        .map((sym) => ({ sym, flipped: false, matched: false }))
    );
    setMemPicked([]);
    setReaction(getGameReaction(mode, 'start', 'Memory Match'));
  };

  useEffect(() => {
    if (memPicked.length !== 2) return;
    const [a, b] = memPicked;
    if (memCards[a].sym === memCards[b].sym) {
      const next = memCards.map((c, idx) =>
        idx === a || idx === b ? { ...c, matched: true } : c
      );
      setMemCards(next);
      setMemPicked([]);
      if (next.every((c) => c.matched)) {
        onRecordGamePlayed();
        setReaction(getGameReaction(mode, 'player_win', 'Memory Match'));
      }
    } else {
      const timer = setTimeout(() => {
        setMemCards((prev) =>
          prev.map((c, idx) => (idx === a || idx === b ? { ...c, flipped: false } : c))
        );
        setMemPicked([]);
      }, 650);
      return () => clearTimeout(timer);
    }
  }, [memPicked]);

  // --- Word Guess ---
  const submitWordGuess = (e: React.FormEvent) => {
    e.preventDefault();
    const g = wgInput.trim().toUpperCase();
    if (g.length !== 5 || wgDone) return;
    const next = [...wgGuesses, g];
    setWgGuesses(next);
    setWgInput('');
    if (g === wgTarget) {
      setWgDone('won');
      onRecordGamePlayed();
      setReaction(getGameReaction(mode, 'player_win', 'Word Guess'));
    } else if (next.length >= 6) {
      setWgDone('lost');
      onRecordGamePlayed();
      setReaction(`The word was ${wgTarget}. Want another round?`);
    }
  };

  // --- Hangman ---
  const hmWrongCount = hmLetters.filter((l) => !hmItem.word.includes(l)).length;
  const hmWon = hmItem.word.split('').every((l) => hmLetters.includes(l));
  const hmLost = hmWrongCount >= 6;

  return (
    <div className="space-y-6 pb-8">
      <section className="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-xs text-[#646975] dark:text-[#9CA0AA]">
            <Gamepad2 className="w-3.5 h-3.5 text-[#D4A359]" />
            <span>100% Offline Capable · Zero API Calls Required</span>
          </div>
          <h1 className="font-display text-2xl sm:text-3xl font-medium text-[#18191D] dark:text-[#EAE7E1] mt-1">
            Offline Game Room
          </h1>
        </div>

        {/* Difficulty & Unlocked Themes */}
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F6F5F1] dark:bg-[#13151B] border border-black/10 dark:border-white/10">
            {(['relaxed', 'balanced', 'sharp'] as GameDifficulty[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDifficulty(d)}
                className={`px-3 py-1 rounded-lg text-xs capitalize cursor-pointer ${
                  difficulty === d
                    ? 'bg-[#D4A359] text-[#0B0C10] font-semibold'
                    : 'text-[#646975] dark:text-[#9CA0AA]'
                }`}
              >
                {d}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F6F5F1] dark:bg-[#13151B] border border-black/10 dark:border-white/10">
            {(['obsidian', 'brass', 'twilight'] as const).map((t) => {
              const unlocked = vault.profile.unlockedGameThemes.includes(t);
              return (
                <button
                  key={t}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => onChangeGameTheme(t)}
                  title={unlocked ? `Use ${t} theme` : 'Play more games to unlock'}
                  className={`px-2.5 py-1 rounded-lg text-xs capitalize cursor-pointer disabled:opacity-35 ${
                    vault.profile.activeGameTheme === t
                      ? 'bg-white dark:bg-[#1A1D26] text-[#18191D] dark:text-[#EAE7E1] font-medium'
                      : 'text-[#646975] dark:text-[#9CA0AA]'
                  }`}
                >
                  {t}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Companion Live Reaction Strip */}
      <div className="rounded-2xl border border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] px-5 py-4 flex items-center gap-4">
        <CompanionOrb
          state="playful"
          accent={vault.profile.accentTheme}
          size="sm"
          companionName={vault.profile.companionName}
        />
        <div className="min-w-0">
          <div className="text-[11px] text-[#646975] dark:text-[#9CA0AA]">
            {vault.profile.companionName} · {vault.profile.gamesPlayedCount} games played together
          </div>
          <p className="text-sm text-[#18191D] dark:text-[#EAE7E1] mt-0.5">{reaction}</p>
        </div>
      </div>

      {/* Game Picker */}
      <div className="flex items-center gap-2 overflow-x-auto pb-1">
        {GAMES_LIST.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => switchGame(g.id)}
            className={`px-3.5 py-2 rounded-xl border text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
              activeGame === g.id
                ? 'border-[#D4A359] bg-[#D4A359]/12 text-[#B88435] dark:text-[#D4A359]'
                : 'border-black/10 dark:border-white/10 bg-white dark:bg-[#13151B] text-[#646975] dark:text-[#9CA0AA] hover:text-[#18191D] dark:hover:text-[#EAE7E1]'
            }`}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Active Game Board */}
      <section className={`rounded-2xl border p-6 sm:p-8 ${themeClass}`}>
        {activeGame === 'tictactoe' && (
          <div className="flex flex-col items-center space-y-5">
            <div className="flex items-center justify-between w-full max-w-xs">
              <span className="text-sm font-medium">You (X) vs. {vault.profile.companionName} (O)</span>
              <button
                type="button"
                onClick={resetTtt}
                className="text-xs flex items-center gap-1 text-[#D4A359] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Rematch
              </button>
            </div>
            <div className="grid grid-cols-3 gap-2.5 w-64">
              {tttBoard.map((cell, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleTttClick(idx)}
                  className="aspect-square rounded-2xl border border-black/12 dark:border-white/12 bg-[#F6F5F1] dark:bg-[#0B0C10] text-2xl font-display font-semibold flex items-center justify-center hover:border-[#D4A359]/50 cursor-pointer"
                >
                  <span className={cell === 'X' ? 'text-[#D4A359]' : 'text-[#8B82B8]'}>
                    {cell}
                  </span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeGame === 'connect4' && (
          <div className="flex flex-col items-center space-y-5">
            <div className="flex items-center justify-between w-full max-w-md">
              <span className="text-sm font-medium">
                {c4Winner === 1
                  ? 'You won!'
                  : c4Winner === 2
                    ? `${vault.profile.companionName} won`
                    : c4Winner === 'draw'
                      ? 'Draw'
                      : c4Thinking
                        ? `${vault.profile.companionName} is thinking…`
                        : 'Your drop (Gold)'}
              </span>
              <button
                type="button"
                onClick={resetC4}
                className="text-xs flex items-center gap-1 text-[#D4A359] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Rematch
              </button>
            </div>

            <div className="p-3 rounded-2xl bg-[#0B0C10] border border-white/10 grid grid-cols-7 gap-2 w-full max-w-md">
              {c4Board.map((row, rIdx) =>
                row.map((cell, cIdx) => (
                  <button
                    key={`${rIdx}-${cIdx}`}
                    type="button"
                    onClick={() => handleC4Drop(cIdx)}
                    aria-label={`Drop in column ${cIdx + 1}`}
                    className={`aspect-square rounded-full border transition-colors cursor-pointer ${
                      cell === 1
                        ? 'bg-[#D4A359] border-[#D4A359]'
                        : cell === 2
                          ? 'bg-[#8B82B8] border-[#8B82B8]'
                          : 'bg-[#171A22] border-white/10 hover:border-white/30'
                    }`}
                  />
                ))
              )}
            </div>
          </div>
        )}

        {activeGame === 'chess' && (
          <div className="flex flex-col items-center space-y-4">
            <div className="flex items-center justify-between w-full max-w-md">
              <span className="text-sm font-medium">
                {chess.status === 'checkmate'
                  ? `Checkmate — ${chess.winner === 'w' ? 'You win!' : `${vault.profile.companionName} wins`}`
                  : chess.status === 'stalemate'
                    ? 'Stalemate'
                    : chessThinking
                      ? `${vault.profile.companionName} is thinking…`
                      : chess.status === 'check'
                        ? 'Check! Your move (White)'
                        : 'Your move (White)'}
              </span>
              <button
                type="button"
                onClick={resetChess}
                className="text-xs flex items-center gap-1 text-[#D4A359] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> New Game
              </button>
            </div>

            <div className="grid grid-cols-8 border border-black/20 dark:border-white/15 rounded-xl overflow-hidden w-full max-w-md aspect-square">
              {chess.board.map((row, r) =>
                row.map((piece, c) => {
                  const isDark = (r + c) % 2 === 1;
                  const isSel = selectedSq?.[0] === r && selectedSq?.[1] === c;
                  const isLegal = legalMoves.some((m) => m.toRow === r && m.toCol === c);
                  const isLast =
                    (chess.lastMove?.fromRow === r && chess.lastMove?.fromCol === c) ||
                    (chess.lastMove?.toRow === r && chess.lastMove?.toCol === c);

                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => handleChessSquareClick(r, c)}
                      className={`relative flex items-center justify-center text-2xl sm:text-3xl select-none cursor-pointer ${
                        isSel
                          ? 'bg-[#D4A359]/45'
                          : isLast
                            ? 'bg-[#D4A359]/20'
                            : isDark
                              ? 'bg-[#1D202A]'
                              : 'bg-[#2C3140]'
                      }`}
                    >
                      {piece && (
                        <span
                          className={
                            piece.color === 'w'
                              ? 'text-[#F5EFE4] drop-shadow'
                              : 'text-[#8B82B8] drop-shadow'
                          }
                        >
                          {PIECE_GLYPHS[piece.color][piece.type]}
                        </span>
                      )}
                      {isLegal && (
                        <span className="absolute w-3 h-3 rounded-full bg-[#D4A359]/75 pointer-events-none" />
                      )}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}

        {activeGame === 'sudoku' && (
          <div className="flex flex-col items-center space-y-5">
            <div className="flex items-center justify-between w-full max-w-md">
              <span className="text-sm font-medium">
                {sudokuSolved ? 'Puzzle solved cleanly!' : 'Tap a cell, then choose 1–9'}
              </span>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={giveSudokuHint}
                  className="text-xs flex items-center gap-1 text-[#8B82B8] cursor-pointer"
                >
                  <Lightbulb className="w-3.5 h-3.5" /> Hint
                </button>
                <button
                  type="button"
                  onClick={() => resetSudoku(difficulty)}
                  className="text-xs flex items-center gap-1 text-[#D4A359] cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> New Grid
                </button>
              </div>
            </div>

            <div className="grid grid-cols-9 border-2 border-black/25 dark:border-white/25 rounded-lg overflow-hidden w-full max-w-md aspect-square bg-[#F6F5F1] dark:bg-[#0B0C10]">
              {sudoku.puzzle.map((row, r) =>
                row.map((val, c) => {
                  const isFixed = sudoku.fixed[r][c];
                  const isSel = sudokuSelected?.[0] === r && sudokuSelected?.[1] === c;
                  const wrong = val !== 0 && val !== sudoku.solution[r][c];
                  return (
                    <button
                      key={`${r}-${c}`}
                      type="button"
                      onClick={() => setSudokuSelected([r, c])}
                      className={`flex items-center justify-center text-sm font-mono-tabular border border-black/10 dark:border-white/10 cursor-pointer ${
                        c % 3 === 2 && c !== 8 ? 'border-r-2 border-r-black/30 dark:border-r-white/30' : ''
                      } ${
                        r % 3 === 2 && r !== 8 ? 'border-b-2 border-b-black/30 dark:border-b-white/30' : ''
                      } ${isSel ? 'bg-[#D4A359]/25' : ''} ${
                        wrong
                          ? 'text-rose-500'
                          : isFixed
                            ? 'font-bold text-[#18191D] dark:text-[#EAE7E1]'
                            : 'text-[#B88435] dark:text-[#D4A359]'
                      }`}
                    >
                      {val !== 0 ? val : ''}
                    </button>
                  );
                })
              )}
            </div>

            <div className="flex flex-wrap justify-center gap-2">
              {[1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((num) => (
                <button
                  key={num}
                  type="button"
                  onClick={() => setSudokuCellValue(num)}
                  className="min-w-[38px] min-h-[38px] px-2.5 rounded-lg border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] text-xs font-mono-tabular cursor-pointer hover:border-[#D4A359]/50"
                >
                  {num === 0 ? 'Clear' : num}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeGame === 'wordguess' && (
          <div className="flex flex-col items-center space-y-5 max-w-sm mx-auto">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-medium">5-Letter Word Deduction</span>
              <button
                type="button"
                onClick={() => {
                  setWgTarget(
                    FIVE_LETTER_WORDS[Math.floor(Math.random() * FIVE_LETTER_WORDS.length)]
                  );
                  setWgGuesses([]);
                  setWgDone(null);
                  setWgInput('');
                  setReaction(getGameReaction(mode, 'start', 'Word Guess'));
                }}
                className="text-xs flex items-center gap-1 text-[#D4A359] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> New Word
              </button>
            </div>

            <div className="space-y-2 w-full">
              {Array.from({ length: 6 }).map((_, rIdx) => {
                const guess = wgGuesses[rIdx] ?? '';
                return (
                  <div key={rIdx} className="grid grid-cols-5 gap-2">
                    {Array.from({ length: 5 }).map((__, cIdx) => {
                      const ch = guess[cIdx] ?? '';
                      const exact = ch && wgTarget[cIdx] === ch;
                      const present = ch && !exact && wgTarget.includes(ch);
                      return (
                        <div
                          key={cIdx}
                          className={`aspect-square rounded-xl border flex items-center justify-center text-lg font-mono-tabular font-semibold ${
                            exact
                              ? 'bg-[#74A892] border-[#74A892] text-[#0B0C10]'
                              : present
                                ? 'bg-[#D4A359] border-[#D4A359] text-[#0B0C10]'
                                : guess
                                  ? 'bg-[#232734] border-[#232734] text-[#EAE7E1]'
                                  : 'border-black/10 dark:border-white/10'
                          }`}
                        >
                          {ch}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>

            {!wgDone ? (
              <form onSubmit={submitWordGuess} className="flex gap-2 w-full">
                <input
                  type="text"
                  maxLength={5}
                  value={wgInput}
                  onChange={(e) => setWgInput(e.target.value.replace(/[^a-zA-Z]/g, ''))}
                  placeholder="Type 5 letters…"
                  className="flex-1 min-h-[42px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-sm uppercase font-mono-tabular"
                />
                <button
                  type="submit"
                  disabled={wgInput.trim().length !== 5}
                  className="min-h-[42px] px-4 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold disabled:opacity-35 cursor-pointer"
                >
                  Guess
                </button>
              </form>
            ) : (
              <p className="text-sm font-medium text-[#D4A359]">
                {wgDone === 'won' ? 'Solved!' : `Word was ${wgTarget}`}
              </p>
            )}
          </div>
        )}

        {activeGame === 'hangman' && (
          <div className="flex flex-col items-center space-y-5 max-w-md mx-auto text-center">
            <div className="flex items-center justify-between w-full">
              <span className="text-xs text-[#646975] dark:text-[#9CA0AA]">
                Mistakes: <span className="font-mono-tabular">{hmWrongCount}/6</span>
              </span>
              <button
                type="button"
                onClick={() => {
                  setHmItem(HANGMAN_WORDS[Math.floor(Math.random() * HANGMAN_WORDS.length)]);
                  setHmLetters([]);
                  setReaction(getGameReaction(mode, 'start', 'Hangman'));
                }}
                className="text-xs flex items-center gap-1 text-[#D4A359] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> New Word
              </button>
            </div>

            <p className="text-xs text-[#8B82B8]">Clue: {hmItem.hint}</p>

            <div className="flex flex-wrap justify-center gap-2 text-2xl font-mono-tabular tracking-widest">
              {hmItem.word.split('').map((ch, i) => (
                <span key={i} className="w-8 border-b-2 border-[#D4A359]/60 pb-1">
                  {hmLetters.includes(ch) || hmLost ? ch : '_'}
                </span>
              ))}
            </div>

            {hmWon && <p className="text-sm text-[#74A892] font-medium">You saved it!</p>}
            {hmLost && <p className="text-sm text-rose-400">Word: {hmItem.word}</p>}

            <div className="flex flex-wrap justify-center gap-1.5">
              {'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('').map((letter) => {
                const used = hmLetters.includes(letter);
                return (
                  <button
                    key={letter}
                    type="button"
                    disabled={used || hmWon || hmLost}
                    onClick={() => {
                      const next = [...hmLetters, letter];
                      setHmLetters(next);
                      const nowWon = hmItem.word.split('').every((l) => next.includes(l));
                      const nowWrong = next.filter((l) => !hmItem.word.includes(l)).length;
                      if (nowWon) {
                        onRecordGamePlayed();
                        setReaction(getGameReaction(mode, 'player_win', 'Hangman'));
                      } else if (nowWrong >= 6) {
                        onRecordGamePlayed();
                        setReaction(getGameReaction(mode, 'ai_win', 'Hangman'));
                      }
                    }}
                    className="w-9 h-9 rounded-lg border border-black/10 dark:border-white/10 text-xs font-mono-tabular disabled:opacity-25 hover:border-[#D4A359] cursor-pointer"
                  >
                    {letter}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {activeGame === 'memory' && (
          <div className="flex flex-col items-center space-y-5 max-w-sm mx-auto">
            <div className="flex items-center justify-between w-full">
              <span className="text-sm font-medium">Symbol Pair Recall</span>
              <button
                type="button"
                onClick={resetMemory}
                className="text-xs flex items-center gap-1 text-[#D4A359] cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" /> Shuffle
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 w-full">
              {memCards.map((card, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    if (card.flipped || card.matched || memPicked.length >= 2) return;
                    setMemCards((prev) =>
                      prev.map((c, i) => (i === idx ? { ...c, flipped: true } : c))
                    );
                    setMemPicked((p) => [...p, idx]);
                  }}
                  className={`aspect-square rounded-2xl border text-2xl flex items-center justify-center transition-colors cursor-pointer ${
                    card.matched
                      ? 'border-[#74A892] bg-[#74A892]/15 text-[#74A892]'
                      : card.flipped
                        ? 'border-[#D4A359] bg-[#D4A359]/15 text-[#D4A359]'
                        : 'border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10]'
                  }`}
                >
                  {card.flipped || card.matched ? card.sym : ''}
                </button>
              ))}
            </div>
          </div>
        )}

        {activeGame === 'twentyq' && (
          <div className="max-w-md mx-auto text-center space-y-5 py-4">
            <div className="text-xs font-mono-tabular text-[#646975] dark:text-[#9CA0AA]">
              Question {qSteps + 1} · Think of an animal, plant, or everyday object
            </div>

            {qOutcome ? (
              <div className="space-y-4">
                <p className="font-display text-xl text-[#D4A359]">{qOutcome}</p>
                <button
                  type="button"
                  onClick={() => {
                    setQNode(TWENTY_QUESTIONS_TREE);
                    setQSteps(0);
                    setQOutcome(null);
                  }}
                  className="min-h-[40px] px-5 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold cursor-pointer"
                >
                  Play Again
                </button>
              </div>
            ) : qNode.guess ? (
              <div className="space-y-4">
                <p className="font-display text-xl">
                  Are you thinking of <span className="text-[#D4A359]">{qNode.guess}</span>?
                </p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      onRecordGamePlayed();
                      setQOutcome(`Got it in ${qSteps} questions!`);
                      setReaction(getGameReaction(mode, 'ai_win', '20 Questions'));
                    }}
                    className="min-h-[42px] px-5 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold cursor-pointer"
                  >
                    Yes, nailed it
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      onRecordGamePlayed();
                      setQOutcome('You stumped me this round!');
                      setReaction(getGameReaction(mode, 'player_win', '20 Questions'));
                    }}
                    className="min-h-[42px] px-5 rounded-xl border border-black/10 dark:border-white/10 text-xs cursor-pointer"
                  >
                    Nope, you missed
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-5">
                <p className="font-display text-xl">{qNode.question}</p>
                <div className="flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      if (qNode.yes) {
                        setQNode(qNode.yes);
                        setQSteps((s) => s + 1);
                      }
                    }}
                    className="min-h-[42px] px-6 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold cursor-pointer"
                  >
                    Yes
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (qNode.no) {
                        setQNode(qNode.no);
                        setQSteps((s) => s + 1);
                      }
                    }}
                    className="min-h-[42px] px-6 rounded-xl border border-black/10 dark:border-white/10 text-xs cursor-pointer"
                  >
                    No
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {activeGame === 'social' && (
          <div className="max-w-xl mx-auto space-y-6">
            <div className="flex justify-center gap-1 p-1 rounded-xl bg-[#F6F5F1] dark:bg-[#0B0C10] w-fit mx-auto">
              {[
                { id: 'wyr' as const, label: 'Would You Rather' },
                { id: 'riddle' as const, label: 'Riddles' },
                { id: 'story' as const, label: 'Story Builder' },
              ].map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSocialTab(t.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs cursor-pointer ${
                    socialTab === t.id
                      ? 'bg-white dark:bg-[#1A1D26] font-medium text-[#18191D] dark:text-[#EAE7E1]'
                      : 'text-[#646975] dark:text-[#9CA0AA]'
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {socialTab === 'wyr' && (
              <div className="space-y-4 text-center">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {WOULD_YOU_RATHER_PROMPTS[wyrIdx].map((opt, idx) => (
                    <button
                      key={idx}
                      type="button"
                      onClick={() => {
                        setReaction(
                          idx === 0
                            ? 'Interesting choice—calm over stimulation makes total sense.'
                            : 'Bold pick. Honestly, I respect the curiosity behind that.'
                        );
                        setWyrIdx((i) => (i + 1) % WOULD_YOU_RATHER_PROMPTS.length);
                      }}
                      className="p-5 rounded-2xl border border-black/10 dark:border-white/10 hover:border-[#D4A359] text-sm text-left leading-relaxed cursor-pointer"
                    >
                      {opt}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {socialTab === 'riddle' && (
              <div className="space-y-4 text-center">
                <p className="font-display text-lg">{RIDDLES[riddleIdx].riddle}</p>
                <p className="text-xs text-[#8B82B8]">Clue: {RIDDLES[riddleIdx].clue}</p>
                <div className="flex gap-2 max-w-sm mx-auto">
                  <input
                    type="text"
                    value={riddleGuess}
                    onChange={(e) => setRiddleGuess(e.target.value)}
                    placeholder="Your guess…"
                    className="flex-1 min-h-[40px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3 text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      if (riddleGuess.toLowerCase().includes(RIDDLES[riddleIdx].answer)) {
                        setRiddleState('solved');
                        onRecordGamePlayed();
                        setReaction(getGameReaction(mode, 'player_win', 'Riddles'));
                      } else {
                        setReaction('Close—think a little simpler.');
                      }
                    }}
                    className="min-h-[40px] px-4 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold cursor-pointer"
                  >
                    Check
                  </button>
                </div>
                <div className="flex justify-center gap-4 text-xs">
                  <button
                    type="button"
                    onClick={() => setRiddleState('revealed')}
                    className="underline text-[#646975] cursor-pointer"
                  >
                    Reveal ({riddleState === 'open' ? '?' : RIDDLES[riddleIdx].answer})
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setRiddleIdx((i) => (i + 1) % RIDDLES.length);
                      setRiddleGuess('');
                      setRiddleState('open');
                    }}
                    className="text-[#D4A359] cursor-pointer"
                  >
                    Next Riddle
                  </button>
                </div>
              </div>
            )}

            {socialTab === 'story' && (
              <div className="space-y-4">
                <div className="space-y-2.5 max-h-60 overflow-y-auto p-4 rounded-2xl bg-[#F6F5F1] dark:bg-[#0B0C10] border border-black/8 dark:border-white/8">
                  {storyLines.map((line, i) => (
                    <p key={i} className="text-sm leading-relaxed">
                      <span className="text-xs font-semibold text-[#D4A359] mr-2">{line.who}:</span>
                      <span>{line.text}</span>
                    </p>
                  ))}
                </div>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!storyDraft.trim()) return;
                    const aiReply =
                      STORY_AI_CONTINUATIONS[storyLines.length % STORY_AI_CONTINUATIONS.length];
                    setStoryLines((prev) => [
                      ...prev,
                      { who: vault.profile.userName || 'You', text: storyDraft.trim() },
                      { who: vault.profile.companionName, text: aiReply },
                    ]);
                    setStoryDraft('');
                  }}
                  className="flex gap-2"
                >
                  <input
                    type="text"
                    value={storyDraft}
                    onChange={(e) => setStoryDraft(e.target.value)}
                    placeholder="Add the next sentence to our story…"
                    className="flex-1 min-h-[42px] rounded-xl border border-black/10 dark:border-white/10 bg-[#F6F5F1] dark:bg-[#0B0C10] px-3.5 text-sm"
                  />
                  <button
                    type="submit"
                    className="min-h-[42px] px-4 rounded-xl bg-[#D4A359] text-[#0B0C10] text-xs font-semibold cursor-pointer"
                  >
                    Continue
                  </button>
                </form>
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}
