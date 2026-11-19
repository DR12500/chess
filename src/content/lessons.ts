/**
 * Interactive lessons. Every FEN and move here is replayed by tests/content.test.ts,
 * so an illegal position or move fails the test suite.
 *
 * A step can be:
 *  - plain text + diagram (fen), optionally with arrows / highlighted squares
 *  - a task: `line` is a list of UCI moves; the user plays moves 0, 2, 4…, the app replies
 *    with 1, 3, 5…  `anyMate` accepts any checkmating move where the line's move mates.
 *  - a demo: `demo` is a list of UCI moves the user steps through with the arrow buttons.
 */

export type Level = 'beginner' | 'intermediate' | 'advanced';
export type Topic = 'basics' | 'tactics' | 'opening' | 'middlegame' | 'endgame';

export interface Step {
  text: string;
  fen?: string;
  arrows?: [string, string][];
  highlight?: string[];
  line?: string[];
  anyMate?: boolean;
  demo?: string[];
  orientation?: 'white' | 'black';
}

export interface Lesson {
  id: string;
  level: Level;
  topic: Topic;
  title: string;
  summary: string;
  steps: Step[];
}

const START = 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1';

export const LESSONS: Lesson[] = [
  // ------------------------------------------------------------------ BEGINNER
  {
    id: 'b-pieces',
    level: 'beginner',
    topic: 'basics',
    title: 'How the pieces move',
    summary: 'Rook, bishop, queen, knight, pawn and king, with a small task for each.',
    steps: [
      {
        text: 'Chess is played on an 8×8 board. White always moves first. Each side has 16 pieces: a king, a queen, two rooks, two bishops, two knights and eight pawns. The goal is to checkmate the enemy king.',
        fen: START,
      },
      {
        text: 'The ROOK moves any number of squares in a straight line: up, down, left or right. It cannot jump over pieces. Task: capture the black pawn with the rook.',
        fen: '7k/3p4/8/8/3R4/8/8/K7 w - - 0 1',
        line: ['d4d7'],
      },
      {
        text: 'The BISHOP moves any number of squares diagonally. A bishop stays on its starting colour for the whole game. Task: capture the pawn with the bishop.',
        fen: '7k/8/8/5p2/8/3B4/8/K7 w - - 0 1',
        line: ['d3f5'],
      },
      {
        text: 'The QUEEN combines rook and bishop: any number of squares in any straight line or diagonal. It is the strongest piece. Task: capture the black rook.',
        fen: '7k/8/8/7r/8/8/8/K2Q4 w - - 0 1',
        line: ['d1h5'],
      },
      {
        text: 'The KNIGHT moves in an "L": two squares in one direction, then one square sideways. It is the only piece that can jump over others. Task: capture the pawn with the knight.',
        fen: '7k/8/8/4p3/8/3N4/2PPP3/K7 w - - 0 1',
        line: ['d3e5'],
      },
      {
        text: 'PAWNS move straight forward one square (or two from their starting square), but capture diagonally forward. Task: capture the black pawn.',
        fen: '7k/8/8/8/3p4/4P3/8/K7 w - - 0 1',
        line: ['e3d4'],
      },
      {
        text: 'Promotion: a pawn that reaches the last rank becomes a queen, rook, bishop or knight (almost always a queen). Task: promote the pawn.',
        fen: '7k/P7/8/8/8/8/8/K7 w - - 0 1',
        line: ['a7a8q'],
      },
      {
        text: 'En passant: if an enemy pawn moves two squares and lands right beside your pawn, you may capture it as if it had moved only one square, but only on the very next move. Black just played d7-d5. Task: capture en passant.',
        fen: '7k/8/8/3pP3/8/8/8/K7 w - d6 0 1',
        line: ['e5d6'],
      },
      {
        text: 'The KING moves one square in any direction and may never move into check. Castling is a special king move: the king moves two squares towards a rook and the rook jumps over it. Allowed only if neither piece has moved, the squares between are empty, and the king is not in check and does not pass through an attacked square. Task: castle kingside (drag the king two squares right).',
        fen: 'r3k2r/pppppppp/8/8/8/8/PPPPPPPP/R3K2R w KQkq - 0 1',
        line: ['e1g1'],
      },
    ],
  },
  {
    id: 'b-check',
    level: 'beginner',
    topic: 'basics',
    title: 'Check, checkmate and stalemate',
    summary: 'How games are won and drawn.',
    steps: [
      {
        text: 'A king that is attacked is "in check". You must get out of check immediately: move the king, block the attack, or capture the attacker.',
        fen: '4k3/8/8/8/8/8/8/R3K3 w - - 0 1',
        arrows: [['a1', 'a8']],
      },
      {
        text: 'Checkmate: the king is in check and there is no way out. The game is over. Task: the black king is trapped behind its own pawns. Deliver a "back-rank mate".',
        fen: '6k1/5ppp/8/8/8/8/8/R5K1 w - - 0 1',
        line: ['a1a8'],
      },
      {
        text: 'Stalemate: the side to move is NOT in check but has no legal move. That is a draw! Here, if White plays Qc7?? Black has no moves and it is stalemate. Always leave the losing king a square when you are winning.',
        fen: 'k7/8/1K6/8/8/8/8/2Q5 w - - 0 1',
        arrows: [['c1', 'c7']],
      },
      {
        text: 'Other draws: threefold repetition of the same position, the 50-move rule (50 moves each without a capture or pawn move), insufficient material (e.g. king vs king, or king and bishop vs king), or agreement.',
      },
    ],
  },
  {
    id: 'b-values',
    level: 'beginner',
    topic: 'basics',
    title: 'Piece values and safe captures',
    summary: 'Pawn 1, knight 3, bishop 3, rook 5, queen 9. Count before you capture.',
    steps: [
      {
        text: 'A rough guide to piece value: pawn = 1, knight = 3, bishop = 3, rook = 5, queen = 9. The king is priceless. Trading a piece for a stronger one is good; giving away pieces for nothing loses games.',
      },
      {
        text: 'Look for free pieces every move. Black\'s queen is undefended. Task: win it.',
        fen: '4k3/8/8/3q4/8/8/8/3RK3 w - - 0 1',
        line: ['d1d5'],
      },
      {
        text: 'Before capturing, ask: "Can it be taken back?" Here the knight on e5 looks free, but it is defended by the d6 pawn. Nxe5?? dxe5 would lose your knight for a knight, which is just a trade. Counting attackers and defenders is a key skill.',
        fen: 'r1bqkb1r/ppp2ppp/3p1n2/4n3/4P3/2N2N2/PPPP1PPP/R1BQKB1R w KQkq - 0 5',
        arrows: [['f3', 'e5'], ['d6', 'e5']],
      },
    ],
  },
  {
    id: 'b-mates',
    level: 'beginner',
    topic: 'endgame',
    title: 'Basic checkmates: queen and rook',
    summary: 'Push the lone king to the edge, bring your king, deliver mate.',
    steps: [
      {
        text: 'With king + queen (or king + rook) against a lone king you can always force mate. Method: use your piece to shrink the enemy king\'s box, bring your own king close, then mate on the edge.',
      },
      {
        text: 'Queen mate. Your king guards a7 and b7. Task: deliver checkmate.',
        fen: 'k7/8/1K6/8/8/8/8/7Q w - - 0 1',
        line: ['h1h8'],
        anyMate: true,
      },
      {
        text: 'Rook mate. Same idea: the king covers the escape squares, the rook gives check along the edge. Task: mate in one.',
        fen: 'k7/8/1K6/8/8/8/8/7R w - - 0 1',
        line: ['h1h8'],
      },
      {
        text: 'Box technique with the rook: the rook cuts the king off, the kings stand in "opposition" (facing each other with one square between), then the rook checks. Task: mate in one.',
        fen: '3k4/8/3K4/8/8/8/8/R7 w - - 0 1',
        line: ['a1a8'],
      },
    ],
  },
  {
    id: 'b-opening',
    level: 'beginner',
    topic: 'opening',
    title: 'Opening principles',
    summary: 'Centre, development, king safety.',
    steps: [
      {
        text: '1) Fight for the centre (e4, d4, e5, d5) with pawns. 2) Develop knights and bishops quickly, knights before bishops is a good default. 3) Castle early. 4) Don\'t move the same piece twice or bring the queen out early without a reason. Task: start the game with a central pawn move.',
        fen: START,
        line: ['e2e4'],
      },
      {
        text: 'Develop a piece that also attacks something. Task: develop the kingside knight, attacking e5.',
        fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
        line: ['g1f3'],
      },
      {
        text: 'Get the bishop out and prepare to castle. Task: develop the light-squared bishop to c4, aiming at f7.',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R w KQkq - 2 3',
        line: ['f1c4'],
      },
      {
        text: 'Task: castle to bring your king to safety and connect the rooks.',
        fen: 'r1bqk2r/pppp1ppp/2n2n2/2b1p3/2B1P3/3P1N2/PPP2PPP/RNBQK2R w KQkq - 1 5',
        line: ['e1g1'],
      },
    ],
  },
  {
    id: 'b-tactics',
    level: 'beginner',
    topic: 'tactics',
    title: 'First tactics: fork, pin, skewer',
    summary: 'Win material by attacking two things at once.',
    steps: [
      {
        text: 'FORK: one piece attacks two enemy pieces at once. Knights are great at it. Task: fork the king and queen, then collect the queen.',
        fen: 'q3k3/8/8/1N6/8/8/8/4K3 w - - 0 1',
        line: ['b5c7', 'e8e7', 'c7a8'],
      },
      {
        text: 'PIN: a piece can\'t move because a more valuable piece stands behind it. Task: pin the knight to the king with your bishop.',
        fen: '4k3/8/2n5/8/3P4/8/4B3/4K3 w - - 0 1',
        line: ['e2b5'],
      },
      {
        text: 'SKEWER: the reverse of a pin: attack a valuable piece; when it moves, take the piece behind it. Task: check the king along the 5th rank and win the queen.',
        fen: '8/8/8/q2k4/8/8/8/6KR w - - 0 1',
        line: ['h1h5', 'd5c4', 'h5a5'],
      },
      {
        text: 'Pawn fork: even a humble pawn can fork. Task: attack both black pieces with one pawn move.',
        fen: '4k3/8/8/2n1b3/8/3P4/8/4K3 w - - 0 1',
        line: ['d3d4'],
      },
    ],
  },
  {
    id: 'b-traps',
    level: 'beginner',
    topic: 'opening',
    title: "Scholar's mate and how to stop it",
    summary: 'The 4-move checkmate, and the simple defence.',
    steps: [
      {
        text: "Scholar's mate: White attacks f7 (defended only by the king) with queen and bishop. Step through it with the arrows.",
        fen: START,
        demo: ['e2e4', 'e7e5', 'f1c4', 'b8c6', 'd1h5', 'g8f6', 'h5f7'],
      },
      {
        text: 'Defence: after 3.Qh5, play 3...g6 (or 3...Qe7) to block / defend. Then the queen is often chased away with tempo, e.g. ...Nf6. Task (as Black): stop the mate.',
        fen: 'r1bqkbnr/pppp1ppp/2n5/4p2Q/2B1P3/8/PPPP1PPP/RNB1K1NR b KQkq - 3 3',
        line: ['g7g6'],
        orientation: 'black',
      },
    ],
  },

  // ------------------------------------------------------------------ INTERMEDIATE
  {
    id: 'i-tactics',
    level: 'intermediate',
    topic: 'tactics',
    title: 'Discovered attacks and double check',
    summary: 'Move one piece to unleash another.',
    steps: [
      {
        text: 'DISCOVERED ATTACK: moving one piece opens a line for another. If the moving piece also attacks something, the opponent can\'t deal with both. Task: move the bishop with check, uncovering an attack by the rook on the black queen, then take it.',
        fen: '3q3k/8/8/8/8/8/3B4/3R2K1 w - - 0 1',
        line: ['d2c3', 'h8g8', 'd1d8'],
      },
      {
        text: 'DOUBLE CHECK: both pieces give check. The king MUST move. Blocking or capturing can\'t stop two checks. Task: move the knight so that knight AND rook give check. It\'s mate.',
        fen: '3qkb2/3p1p2/8/8/4N3/8/8/4R1K1 w - - 0 1',
        line: ['e4d6'],
        anyMate: true,
      },
    ],
  },
  {
    id: 'i-mates',
    level: 'intermediate',
    topic: 'tactics',
    title: 'Mating patterns',
    summary: 'Smothered mate, Anastasia, Arabian, back-rank.',
    steps: [
      {
        text: 'SMOTHERED MATE: the king is boxed in by its own pieces and a knight delivers mate. Task: mate in one.',
        fen: '6rk/6pp/8/6N1/8/8/8/6K1 w - - 0 1',
        line: ['g5f7'],
      },
      {
        text: 'ARABIAN MATE: rook and knight cooperate in the corner. The knight guards the rook and the escape square. Task: mate in one.',
        fen: '7k/R7/5N2/8/8/8/8/6K1 w - - 0 1',
        line: ['a7h7'],
      },
      {
        text: "ANASTASIA'S MATE: knight takes away squares, rook mates along the edge file. Task: mate in one.",
        fen: '8/4N1pk/8/8/8/1R6/8/6K1 w - - 0 1',
        line: ['b3h3'],
      },
      {
        text: 'BACK-RANK, two against two: your doubled rooks attack e8 twice; Black defends it twice but the last capture is yours. Task: capture, and mate after the recapture.',
        fen: '3qr1k1/5ppp/8/8/8/8/4RPPP/4R1K1 w - - 0 1',
        line: ['e2e8', 'd8e8', 'e1e8'],
      },
    ],
  },
  {
    id: 'i-middlegame',
    level: 'intermediate',
    topic: 'middlegame',
    title: 'Middlegame plans',
    summary: 'Open files, outposts, weak pawns and a plan for every position.',
    steps: [
      {
        text: 'ROOKS belong on open files (no pawns) or half-open files (no own pawns). Task: put the rook on the open d-file.',
        fen: '2r3k1/pp3ppp/4p3/8/8/4P3/PP3PPP/5RK1 w - - 0 1',
        line: ['f1d1'],
      },
      {
        text: 'OUTPOST: a square in enemy territory that no enemy pawn can attack, ideally protected by your pawn. A knight on an outpost (here d5) is a monster. Task: plant the knight on d5.',
        fen: 'r4rk1/pp2bppp/3p1n2/4p3/4P3/2N5/PPP1BPPP/R4RK1 w - - 0 1',
        line: ['c3d5'],
      },
      {
        text: 'PAWN STRUCTURE: isolated pawns (no neighbours) and doubled pawns are weaknesses you can target. Passed pawns (no enemy pawns in front or on adjacent files) are strengths, "passed pawns must be pushed". Here White\'s d4 pawn is isolated; Black should blockade it on d5 and pile up pressure.',
        fen: 'r2q1rk1/pp2bppp/2n1pn2/8/3P4/2NB1N2/PP3PPP/R2Q1RK1 w - - 0 11',
        highlight: ['d4', 'd5'],
      },
      {
        text: 'Making a plan: 1) Is anything hanging, any checks, captures, threats? 2) What is the worst-placed piece? Improve it. 3) Where are the weaknesses? Attack them. 4) Which side of the board should I play on? Usually where your pawn chain points.',
      },
    ],
  },
  {
    id: 'i-kp-endgame',
    level: 'intermediate',
    topic: 'endgame',
    title: 'King and pawn endings: the opposition',
    summary: 'When does a lone pawn win?',
    steps: [
      {
        text: 'In king-and-pawn endings the king is a fighting piece: walk it forward! OPPOSITION: kings face each other with one square between them; the side NOT to move "has the opposition" and usually gets its way.',
        fen: '8/8/4k3/8/4K3/8/4P3/8 w - - 0 1',
        highlight: ['e4', 'e6'],
      },
      {
        text: 'Rule: if your king is on the 6th rank in front of its pawn (not a rook pawn), you win no matter who is to move. Step through the win.',
        fen: '4k3/8/4K3/4P3/8/8/8/8 w - - 0 1',
        demo: ['e6d6', 'e8d8', 'e5e6', 'd8e8', 'e6e7', 'e8f7', 'd6d7', 'f7f6', 'e7e8q'],
      },
      {
        text: 'Defending: keep your king in front of the pawn and take the opposition whenever the attacking king steps forward. When the pawn reaches the 7th with check, go straight back. It ends in stalemate. Step through it.',
        fen: '8/4k3/8/4K3/4P3/8/8/8 w - - 0 1',
        demo: ['e5d5', 'e7d7', 'e4e5', 'd7e7', 'e5e6', 'e7e8', 'd5d6', 'e8d8', 'e6e7', 'd8e8', 'd6e6'],
      },
      {
        text: 'The square rule: can the king catch a passed pawn? Draw a square from the pawn to the promotion rank. If the king can step into that square, it catches the pawn. Here Black to move steps into the square and catches it.',
        fen: '8/8/8/8/7k/8/1P6/K7 b - - 0 1',
        demo: ['h4g5', 'b2b4', 'g5f6', 'b4b5', 'f6e7', 'b5b6', 'e7d7', 'b6b7', 'd7c7'],
      },
    ],
  },
  {
    id: 'i-opening-ideas',
    level: 'intermediate',
    topic: 'opening',
    title: 'Opening ideas you should know',
    summary: 'Pawn breaks, the f7 weakness, and not grabbing poisoned pawns.',
    steps: [
      {
        text: 'Know your PAWN BREAKS: the pawn moves that open the position in your favour. In the French Defence, Black hits White\'s chain with ...c5 and ...f6. Task (as Black): strike at the base of the chain.',
        fen: 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
        line: ['c7c5'],
        orientation: 'black',
      },
      {
        text: 'The Fried Liver Attack: if Black recaptures on d5 with the knight, White can sacrifice on f7 and drag the king into the open. Step through it. Black should play 5...Na5 instead.',
        fen: 'r1bqkb1r/pppp1ppp/2n2n2/4p1N1/2B1P3/8/PPPP1PPP/RNBQK2R b KQkq - 5 4',
        demo: ['d7d5', 'e4d5', 'f6d5', 'g5f7', 'e8f7', 'd1f3', 'f7e6', 'b1c3'],
      },
    ],
  },

  // ------------------------------------------------------------------ ADVANCED
  {
    id: 'a-rook-endings',
    level: 'advanced',
    topic: 'endgame',
    title: 'Rook endings: Lucena and Philidor',
    summary: 'The two positions every player must know.',
    steps: [
      {
        text: 'LUCENA (winning): the pawn is on the 7th, your king in front of it, the enemy king cut off. The winning plan is "building a bridge": bring the rook to the 4th rank, walk the king out, and block the checks with the rook. Step through it.',
        fen: '1K6/1P2k3/8/8/8/8/2r5/3R4 w - - 0 1',
        demo: ['d1d4', 'c2c1', 'b8a7', 'c1a1', 'a7b6', 'a1b1', 'b6c6', 'b1c1', 'c6b5', 'c1b1', 'd4b4'],
      },
      {
        text: 'PHILIDOR (drawing): keep your rook on your 3rd rank (here the 6th) so the enemy king can\'t advance. Once the pawn steps forward, swing the rook to the back and check from behind, since the king has no shelter. Step through it.',
        fen: '4k3/8/r7/3KP3/8/8/8/7R b - - 0 1',
        demo: ['a6b6', 'e5e6', 'b6b1', 'd5d6', 'b1d1'],
      },
      {
        text: 'Rules of thumb: rooks belong BEHIND passed pawns (yours and your opponent\'s); activity beats material in rook endings; cut the enemy king off by files.',
      },
    ],
  },
  {
    id: 'a-calculation',
    level: 'advanced',
    topic: 'tactics',
    title: 'Calculation: checks, captures, threats',
    summary: 'A systematic way to find combinations.',
    steps: [
      {
        text: 'Strong players look at FORCING moves first: checks, then captures, then threats. Forcing moves limit the opponent\'s replies, so you can calculate further. Task: Philidor\'s legacy, mate in 4 with only checks (knight check, knight double check, queen sacrifice, smothered mate).',
        fen: '4r2k/6pp/8/6N1/2Q5/8/8/6K1 w - - 0 1',
        line: ['g5f7', 'h8g8', 'f7h6', 'g8h8', 'c4g8', 'e8g8', 'h6f7'],
      },
      {
        text: 'Train calculation with puzzles at or slightly above your rating: solve the whole line in your head before touching a piece, then check. Over time, try to see 3–4 moves deep.',
      },
    ],
  },
  {
    id: 'a-strategy',
    level: 'advanced',
    topic: 'middlegame',
    title: 'Strategic concepts',
    summary: 'Good vs bad bishops, minority attack, prophylaxis.',
    steps: [
      {
        text: 'BAD BISHOP: a bishop blocked by its own pawns on its colour. Here Black\'s light-squared bishop is hemmed in by e6/d5: in the French Defence it is a constant problem. Trade it or reroute it (…b6 and …Ba6, or …Bd7-e8-h5).',
        fen: 'rnbqkbnr/ppp2ppp/4p3/3pP3/3P4/8/PPP2PPP/RNBQKBNR b KQkq - 0 3',
        highlight: ['c8'],
      },
      {
        text: 'MINORITY ATTACK (Queen\'s Gambit Exchange structure): White advances the b-pawn (b4-b5) against Black\'s majority to create a weak pawn on c6 or d5.',
        fen: 'r1bq1rk1/pp1nbppp/2p2n2/3p2B1/3P4/2NBP3/PPQ1NPPP/R3K2R w KQ - 0 9',
        arrows: [['b2', 'b4'], ['b4', 'b5']],
      },
      {
        text: 'PROPHYLAXIS: before your own move ask "What does my opponent want?" and prevent it. A quiet move like h3 (stopping ...Bg4 or ...Ng4) or a2-a4 (stopping ...b5) often matters more than an attack.',
      },
    ],
  },
];

export const LEVELS: { id: Level; label: string; blurb: string }[] = [
  { id: 'beginner', label: 'Beginner', blurb: 'Rules, basic mates, first tactics (≈ 0–1000)' },
  { id: 'intermediate', label: 'Intermediate', blurb: 'Patterns, plans, pawn endings (≈ 1000–1600)' },
  { id: 'advanced', label: 'Advanced', blurb: 'Rook endings, calculation, strategy (≈ 1600+)' },
];
