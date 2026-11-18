import type { GameDifficulty } from './gameEngine';

export type PieceColor = 'w' | 'b';
export type PieceType = 'p' | 'n' | 'b' | 'r' | 'q' | 'k';

export interface ChessPiece {
  color: PieceColor;
  type: PieceType;
}

export interface ChessMove {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  promotion?: PieceType;
  isCastle?: 'kingside' | 'queenside';
}

export interface ChessState {
  board: (ChessPiece | null)[][];
  turn: PieceColor;
  castling: { wK: boolean; wQ: boolean; bK: boolean; bQ: boolean };
  status: 'playing' | 'check' | 'checkmate' | 'stalemate';
  winner: PieceColor | 'draw' | null;
  lastMove: ChessMove | null;
}

export const PIECE_GLYPHS: Record<PieceColor, Record<PieceType, string>> = {
  w: { k: '♔', q: '♕', r: '♖', b: '♗', n: '♘', p: '♙' },
  b: { k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟' },
};

const PIECE_VALUES: Record<PieceType, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 20000,
};

export function createInitialChessState(): ChessState {
  const backRow: PieceType[] = ['r', 'n', 'b', 'q', 'k', 'b', 'n', 'r'];
  const board: (ChessPiece | null)[][] = Array.from({ length: 8 }, () =>
    Array<ChessPiece | null>(8).fill(null)
  );
  for (let c = 0; c < 8; c += 1) {
    board[0][c] = { color: 'b', type: backRow[c] };
    board[1][c] = { color: 'b', type: 'p' };
    board[6][c] = { color: 'w', type: 'p' };
    board[7][c] = { color: 'w', type: backRow[c] };
  }
  return {
    board,
    turn: 'w',
    castling: { wK: true, wQ: true, bK: true, bQ: true },
    status: 'playing',
    winner: null,
    lastMove: null,
  };
}

function inBounds(r: number, c: number): boolean {
  return r >= 0 && r < 8 && c >= 0 && c < 8;
}

function getPseudoMoves(
  board: (ChessPiece | null)[][],
  r: number,
  c: number,
  castling: ChessState['castling'],
  includeCastling = true
): ChessMove[] {
  const piece = board[r][c];
  if (!piece) return [];
  const moves: ChessMove[] = [];
  const opp: PieceColor = piece.color === 'w' ? 'b' : 'w';

  if (piece.type === 'p') {
    const dir = piece.color === 'w' ? -1 : 1;
    const startRow = piece.color === 'w' ? 6 : 1;
    const promoRow = piece.color === 'w' ? 0 : 7;
    if (inBounds(r + dir, c) && !board[r + dir][c]) {
      moves.push({
        fromRow: r,
        fromCol: c,
        toRow: r + dir,
        toCol: c,
        promotion: r + dir === promoRow ? 'q' : undefined,
      });
      if (r === startRow && !board[r + dir * 2][c]) {
        moves.push({ fromRow: r, fromCol: c, toRow: r + dir * 2, toCol: c });
      }
    }
    for (const dc of [-1, 1]) {
      const nr = r + dir;
      const nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc]?.color === opp) {
        moves.push({
          fromRow: r,
          fromCol: c,
          toRow: nr,
          toCol: nc,
          promotion: nr === promoRow ? 'q' : undefined,
        });
      }
    }
    return moves;
  }

  if (piece.type === 'n') {
    const jumps = [
      [-2, -1], [-2, 1], [-1, -2], [-1, 2],
      [1, -2], [1, 2], [2, -1], [2, 1],
    ];
    for (const [dr, dc] of jumps) {
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc]?.color !== piece.color) {
        moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
      }
    }
    return moves;
  }

  const dirs: Array<[number, number]> = [];
  if (piece.type === 'b' || piece.type === 'q') {
    dirs.push([-1, -1], [-1, 1], [1, -1], [1, 1]);
  }
  if (piece.type === 'r' || piece.type === 'q') {
    dirs.push([-1, 0], [1, 0], [0, -1], [0, 1]);
  }
  if (dirs.length > 0) {
    for (const [dr, dc] of dirs) {
      let nr = r + dr;
      let nc = c + dc;
      while (inBounds(nr, nc)) {
        if (!board[nr][nc]) {
          moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
        } else {
          if (board[nr][nc]?.color === opp) {
            moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
          }
          break;
        }
        nr += dr;
        nc += dc;
      }
    }
    return moves;
  }

  // King
  for (let dr = -1; dr <= 1; dr += 1) {
    for (let dc = -1; dc <= 1; dc += 1) {
      if (dr === 0 && dc === 0) continue;
      const nr = r + dr;
      const nc = c + dc;
      if (inBounds(nr, nc) && board[nr][nc]?.color !== piece.color) {
        moves.push({ fromRow: r, fromCol: c, toRow: nr, toCol: nc });
      }
    }
  }

  if (includeCastling) {
    const homeRow = piece.color === 'w' ? 7 : 0;
    if (r === homeRow && c === 4 && !isSquareAttacked(board, homeRow, 4, opp)) {
      const canK = piece.color === 'w' ? castling.wK : castling.bK;
      const canQ = piece.color === 'w' ? castling.wQ : castling.bQ;
      if (
        canK &&
        !board[homeRow][5] &&
        !board[homeRow][6] &&
        board[homeRow][7]?.type === 'r' &&
        board[homeRow][7]?.color === piece.color &&
        !isSquareAttacked(board, homeRow, 5, opp) &&
        !isSquareAttacked(board, homeRow, 6, opp)
      ) {
        moves.push({ fromRow: r, fromCol: c, toRow: homeRow, toCol: 6, isCastle: 'kingside' });
      }
      if (
        canQ &&
        !board[homeRow][3] &&
        !board[homeRow][2] &&
        !board[homeRow][1] &&
        board[homeRow][0]?.type === 'r' &&
        board[homeRow][0]?.color === piece.color &&
        !isSquareAttacked(board, homeRow, 3, opp) &&
        !isSquareAttacked(board, homeRow, 2, opp)
      ) {
        moves.push({ fromRow: r, fromCol: c, toRow: homeRow, toCol: 2, isCastle: 'queenside' });
      }
    }
  }
  return moves;
}

function isSquareAttacked(
  board: (ChessPiece | null)[][],
  targetR: number,
  targetC: number,
  byColor: PieceColor
): boolean {
  const dummyCastle = { wK: false, wQ: false, bK: false, bQ: false };
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (p?.color === byColor) {
        if (p.type === 'p') {
          const dir = byColor === 'w' ? -1 : 1;
          if (r + dir === targetR && Math.abs(c - targetC) === 1) return true;
        } else {
          const moves = getPseudoMoves(board, r, c, dummyCastle, false);
          if (moves.some((m) => m.toRow === targetR && m.toCol === targetC)) return true;
        }
      }
    }
  }
  return false;
}

function isKingInCheck(board: (ChessPiece | null)[][], color: PieceColor): boolean {
  const opp: PieceColor = color === 'w' ? 'b' : 'w';
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (p?.color === color && p.type === 'k') {
        return isSquareAttacked(board, r, c, opp);
      }
    }
  }
  return false;
}

function applyRawMove(state: ChessState, move: ChessMove): ChessState {
  const board = state.board.map((row) => [...row]);
  const piece = board[move.fromRow][move.fromCol];
  if (!piece) return state;

  board[move.fromRow][move.fromCol] = null;
  board[move.toRow][move.toCol] = move.promotion
    ? { color: piece.color, type: move.promotion }
    : piece;

  if (move.isCastle === 'kingside') {
    board[move.toRow][5] = board[move.toRow][7];
    board[move.toRow][7] = null;
  } else if (move.isCastle === 'queenside') {
    board[move.toRow][3] = board[move.toRow][0];
    board[move.toRow][0] = null;
  }

  const castling = { ...state.castling };
  if (piece.type === 'k') {
    if (piece.color === 'w') {
      castling.wK = false;
      castling.wQ = false;
    } else {
      castling.bK = false;
      castling.bQ = false;
    }
  }
  if (piece.type === 'r') {
    if (move.fromRow === 7 && move.fromCol === 0) castling.wQ = false;
    if (move.fromRow === 7 && move.fromCol === 7) castling.wK = false;
    if (move.fromRow === 0 && move.fromCol === 0) castling.bQ = false;
    if (move.fromRow === 0 && move.fromCol === 7) castling.bK = false;
  }

  return {
    ...state,
    board,
    turn: state.turn === 'w' ? 'b' : 'w',
    castling,
    lastMove: move,
  };
}

export function getLegalMovesForSquare(state: ChessState, r: number, c: number): ChessMove[] {
  const piece = state.board[r][c];
  if (!piece || piece.color !== state.turn) return [];
  const pseudo = getPseudoMoves(state.board, r, c, state.castling, true);
  return pseudo.filter((m) => {
    const next = applyRawMove(state, m);
    return !isKingInCheck(next.board, piece.color);
  });
}

export function getAllLegalMoves(state: ChessState): ChessMove[] {
  const all: ChessMove[] = [];
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      if (state.board[r][c]?.color === state.turn) {
        all.push(...getLegalMovesForSquare(state, r, c));
      }
    }
  }
  return all;
}

export function applyChessMove(state: ChessState, move: ChessMove): ChessState {
  const next = applyRawMove(state, move);
  const legal = getAllLegalMoves(next);
  const inCheck = isKingInCheck(next.board, next.turn);

  if (legal.length === 0) {
    if (inCheck) {
      return {
        ...next,
        status: 'checkmate',
        winner: state.turn,
      };
    }
    return {
      ...next,
      status: 'stalemate',
      winner: 'draw',
    };
  }
  return {
    ...next,
    status: inCheck ? 'check' : 'playing',
    winner: null,
  };
}

function evaluateChessBoard(board: (ChessPiece | null)[][]): number {
  let score = 0;
  for (let r = 0; r < 8; r += 1) {
    for (let c = 0; c < 8; c += 1) {
      const p = board[r][c];
      if (!p) continue;
      const centerBonus = (3.5 - Math.abs(3.5 - c)) * 5 + (3.5 - Math.abs(3.5 - r)) * 4;
      const val = PIECE_VALUES[p.type] + (p.type === 'p' || p.type === 'n' ? centerBonus : 0);
      score += p.color === 'b' ? val : -val;
    }
  }
  return score;
}

function chessMinimax(
  state: ChessState,
  depth: number,
  alpha: number,
  beta: number,
  maximizing: boolean
): { score: number; move: ChessMove | null } {
  const moves = getAllLegalMoves(state);
  if (moves.length === 0) {
    if (isKingInCheck(state.board, state.turn)) {
      return { score: maximizing ? -50000 - depth : 50000 + depth, move: null };
    }
    return { score: 0, move: null };
  }
  if (depth === 0) {
    return { score: evaluateChessBoard(state.board), move: null };
  }

  // Order captures first for better alpha-beta pruning
  moves.sort((a, b) => {
    const capA = state.board[a.toRow][a.toCol] ? PIECE_VALUES[state.board[a.toRow][a.toCol]!.type] : 0;
    const capB = state.board[b.toRow][b.toCol] ? PIECE_VALUES[state.board[b.toRow][b.toCol]!.type] : 0;
    return capB - capA;
  });

  let bestMove = moves[0];
  if (maximizing) {
    let maxEval = -Infinity;
    for (const move of moves) {
      const next = applyRawMove(state, move);
      const res = chessMinimax(next, depth - 1, alpha, beta, false).score;
      if (res > maxEval) {
        maxEval = res;
        bestMove = move;
      }
      alpha = Math.max(alpha, maxEval);
      if (beta <= alpha) break;
    }
    return { score: maxEval, move: bestMove };
  }

  let minEval = Infinity;
  for (const move of moves) {
    const next = applyRawMove(state, move);
    const res = chessMinimax(next, depth - 1, alpha, beta, true).score;
    if (res < minEval) {
      minEval = res;
      bestMove = move;
    }
    beta = Math.min(beta, minEval);
    if (beta <= alpha) break;
  }
  return { score: minEval, move: bestMove };
}

export function getChessAiMove(state: ChessState, difficulty: GameDifficulty): ChessMove | null {
  const moves = getAllLegalMoves(state);
  if (moves.length === 0) return null;
  if (difficulty === 'relaxed' && Math.random() < 0.4) {
    return moves[Math.floor(Math.random() * moves.length)];
  }
  const depth = difficulty === 'relaxed' ? 1 : difficulty === 'balanced' ? 2 : 3;
  return chessMinimax(state, depth, -Infinity, Infinity, true).move ?? moves[0];
}
