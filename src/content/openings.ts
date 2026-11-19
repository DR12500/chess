/**
 * Opening guide. Main lines are in SAN from the starting position and are replayed by
 * tests/content.test.ts. `notes` maps a ply index (0 = White's first move) to a comment.
 */
import type { Level } from './lessons';

export interface Opening {
  id: string;
  name: string;
  eco: string;
  level: Level;
  side: 'white' | 'black'; // whose repertoire it is usually learned for
  moves: string; // SAN, space separated, no move numbers
  ideas: string[];
  notes?: Record<number, string>;
}

export const OPENINGS: Opening[] = [
  {
    id: 'italian',
    name: 'Italian Game (Giuoco Piano)',
    eco: 'C50–C54',
    level: 'beginner',
    side: 'white',
    moves: 'e4 e5 Nf3 Nc6 Bc4 Bc5 c3 Nf6 d3 d6 O-O O-O',
    ideas: [
      'Classical development: centre pawn, knight, bishop on the a2–g8 diagonal aiming at f7.',
      'c3 prepares d4 to build a big centre; the slow d3 version is solid and popular at every level.',
      'Typical plan: Re1, Nbd2-f1-g3, h3 and a kingside attack, or a4/b4 on the queenside.',
    ],
    notes: { 4: 'The bishop eyes f7, the weakest square in Black\'s camp.', 6: 'Preparing d4.' },
  },
  {
    id: 'ruy',
    name: 'Ruy Lopez (Spanish)',
    eco: 'C60–C99',
    level: 'intermediate',
    side: 'white',
    moves: 'e4 e5 Nf3 Nc6 Bb5 a6 Ba4 Nf6 O-O Be7 Re1 b5 Bb3 d6 c3 O-O',
    ideas: [
      'Bb5 pressures the knight that defends e5. Long-term pressure rather than a quick attack.',
      'White aims for d4 (supported by c3) and often reroutes the b1-knight via d2-f1-g3.',
      'Black gains space with ...b5 and often plays ...Na5 and ...c5 on the queenside.',
    ],
    notes: { 4: 'Attacking the defender of e5.', 5: 'The Morphy Defence: asking the bishop a question.' },
  },
  {
    id: 'scotch',
    name: 'Scotch Game',
    eco: 'C44–C45',
    level: 'beginner',
    side: 'white',
    moves: 'e4 e5 Nf3 Nc6 d4 exd4 Nxd4 Bc5 Be3 Qf6 c3 Nge7',
    ideas: [
      'White opens the centre immediately with d4: clear, active piece play.',
      'After ...Bc5 and ...Qf6 Black pressures d4; White defends with Be3 and c3.',
    ],
  },
  {
    id: 'najdorf',
    name: 'Sicilian Defence: Najdorf',
    eco: 'B90–B99',
    level: 'advanced',
    side: 'black',
    moves: 'e4 c5 Nf3 d6 d4 cxd4 Nxd4 Nf6 Nc3 a6',
    ideas: [
      'Black trades a wing pawn for a centre pawn and gets a central majority and the half-open c-file.',
      '...a6 keeps knights and bishops off b5 and prepares ...e5 or ...e6 and ...b5.',
      'Sharp and theory-heavy: opposite-side castling and mutual attacks are common.',
    ],
  },
  {
    id: 'alapin',
    name: 'Sicilian Defence: Alapin (2.c3)',
    eco: 'B22',
    level: 'intermediate',
    side: 'white',
    moves: 'e4 c5 c3 Nf6 e5 Nd5 d4 cxd4 Nf3 Nc6 cxd4 d6',
    ideas: [
      'An anti-Sicilian: White prepares d4 with c3 and avoids the mainline theory.',
      'White gets a classical centre; Black challenges it with ...d6 and ...Nc6.',
    ],
  },
  {
    id: 'french',
    name: 'French Defence',
    eco: 'C00–C19',
    level: 'intermediate',
    side: 'black',
    moves: 'e4 e6 d4 d5 Nc3 Nf6 Bg5 Be7 e5 Nfd7 Bxe7 Qxe7',
    ideas: [
      'Black builds a solid pawn chain (e6–d5) and counter-attacks it with ...c5 and ...f6.',
      'The light-squared bishop on c8 is often the problem piece; plan to activate or trade it.',
      'If White plays e5, attack the base of the chain (d4) with ...c5.',
    ],
  },
  {
    id: 'caro',
    name: 'Caro-Kann Defence',
    eco: 'B10–B19',
    level: 'beginner',
    side: 'black',
    moves: 'e4 c6 d4 d5 Nc3 dxe4 Nxe4 Bf5 Ng3 Bg6 h4 h6 Nf3 Nd7',
    ideas: [
      'Like the French, Black contests e4 with ...d5, but keeps the c8-bishop free (it comes to f5).',
      'Very solid; good endgame structure for Black.',
      'After h4 by White, ...h6 keeps the bishop safe from being trapped by h5.',
    ],
  },
  {
    id: 'scandi',
    name: 'Scandinavian Defence',
    eco: 'B01',
    level: 'beginner',
    side: 'black',
    moves: 'e4 d5 exd5 Qxd5 Nc3 Qa5 d4 Nf6 Nf3 c6 Bc4 Bf5',
    ideas: [
      'Black challenges e4 at once. The queen comes out early but finds a safe spot on a5.',
      'Easy to learn: Black develops ...Nf6, ...c6, ...Bf5 and ...e6 in almost every line.',
    ],
  },
  {
    id: 'qgd',
    name: "Queen's Gambit Declined",
    eco: 'D30–D69',
    level: 'intermediate',
    side: 'white',
    moves: 'd4 d5 c4 e6 Nc3 Nf6 Bg5 Be7 e3 O-O Nf3 h6 Bh4 b6',
    ideas: [
      'White offers the c-pawn to deflect Black\'s d-pawn from the centre; Black declines with ...e6.',
      'Black is solid but the c8-bishop is shut in: ...b6 and ...Bb7 is one way to free it.',
      'Typical White plans: minority attack on the queenside, or a central e4 break.',
    ],
  },
  {
    id: 'qga',
    name: "Queen's Gambit Accepted",
    eco: 'D20–D29',
    level: 'intermediate',
    side: 'black',
    moves: 'd4 d5 c4 dxc4 Nf3 Nf6 e3 e6 Bxc4 c5 O-O a6',
    ideas: [
      'Black takes the pawn but doesn\'t try to keep it; the point is free development and ...c5.',
      'White often gets an isolated d-pawn (IQP) and active pieces; Black aims to blockade it.',
    ],
  },
  {
    id: 'slav',
    name: 'Slav Defence',
    eco: 'D10–D19',
    level: 'intermediate',
    side: 'black',
    moves: 'd4 d5 c4 c6 Nf3 Nf6 Nc3 dxc4 a4 Bf5 e3 e6 Bxc4 Bb4',
    ideas: [
      'Black supports d5 with ...c6, keeping the c8-bishop free to go to f5 or g4.',
      'Solid and flexible; a great choice against 1.d4 at any level.',
    ],
  },
  {
    id: 'london',
    name: 'London System',
    eco: 'D02 / A46',
    level: 'beginner',
    side: 'white',
    moves: 'd4 d5 Bf4 Nf6 e3 e6 Nf3 c5 c3 Nc6 Nbd2 Bd6 Bg3 O-O Bd3',
    ideas: [
      'A system: the same setup (d4, Bf4, e3, Nf3, c3, Nbd2, Bd3) against almost anything.',
      'Little theory, solid structure; plans include a kingside attack with Ne5 and Qf3/h4.',
      'Meet ...Bd6 with Bg3 so a trade on g3 opens the h-file for your rook.',
    ],
  },
  {
    id: 'kid',
    name: "King's Indian Defence",
    eco: 'E60–E99',
    level: 'advanced',
    side: 'black',
    moves: 'd4 Nf6 c4 g6 Nc3 Bg7 e4 d6 Nf3 O-O Be2 e5 O-O Nc6 d5 Ne7',
    ideas: [
      'Black lets White build a big centre, then strikes at it with ...e5 (or ...c5).',
      'After d5 the centre locks: White attacks on the queenside (c5), Black on the kingside (...f5, ...g5).',
      'Double-edged and dynamic: races between opposite-wing attacks.',
    ],
  },
  {
    id: 'nimzo',
    name: 'Nimzo-Indian Defence',
    eco: 'E20–E59',
    level: 'advanced',
    side: 'black',
    moves: 'd4 Nf6 c4 e6 Nc3 Bb4 e3 O-O Bd3 d5 Nf3 c5 O-O Nc6',
    ideas: [
      'Black pins the c3-knight to control e4 and is often happy to give the bishop for the knight and double White\'s pawns.',
      'Flexible: Black chooses between ...d5, ...b6/...Bb7, or ...c5 structures.',
    ],
  },
  {
    id: 'english',
    name: 'English Opening',
    eco: 'A10–A39',
    level: 'intermediate',
    side: 'white',
    moves: 'c4 e5 Nc3 Nf6 Nf3 Nc6 g3 d5 cxd5 Nxd5 Bg2 Nb6 O-O Be7',
    ideas: [
      'A flank opening: White controls d5 from the side and often fianchettoes the king\'s bishop.',
      'Like a reversed Sicilian with an extra tempo for White.',
    ],
  },
  {
    id: 'vienna',
    name: 'Vienna Game',
    eco: 'C25–C29',
    level: 'beginner',
    side: 'white',
    moves: 'e4 e5 Nc3 Nf6 Bc4 Nc6 d3 Bc5 f4 d6 Nf3',
    ideas: [
      'Nc3 before Nf3 keeps the f-pawn free: f4 is a key attacking idea.',
      'Aggressive but sound; good for players who like open kingside play.',
    ],
  },
];
