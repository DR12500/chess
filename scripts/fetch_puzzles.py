"""Stream the Lichess puzzle database (CC0) and keep a rating-stratified sample.

Usage: python -I scripts/fetch_puzzles.py public/puzzles.json
Only reads as much of the remote file as needed to fill every rating band.
"""
import csv, io, json, sys, urllib.request
import zstandard

URL = "https://database.lichess.org/lichess_db_puzzle.csv.zst"
BAND = 100            # rating band width
LO, HI = 400, 3000    # rating range
PER_BAND = 120        # puzzles per band
MIN_POP, MIN_PLAYS = 85, 300

out_path = sys.argv[1]
bands = {b: [] for b in range(LO, HI, BAND)}
need = len(bands) * PER_BAND
got = 0
req = urllib.request.Request(URL, headers={"User-Agent": "personal-chess-app-builder"})
with urllib.request.urlopen(req) as resp:
    reader = io.TextIOWrapper(zstandard.ZstdDecompressor().stream_reader(resp), encoding="utf-8")
    rows = csv.reader(reader)
    header = next(rows)
    idx = {k: i for i, k in enumerate(header)}
    for n, r in enumerate(rows):
        try:
            rating = int(r[idx["Rating"]])
            pop = int(r[idx["Popularity"]]); plays = int(r[idx["NbPlays"]])
        except (ValueError, IndexError):
            continue
        if pop < MIN_POP or plays < MIN_PLAYS or rating < LO or rating >= HI:
            continue
        b = LO + (rating - LO) // BAND * BAND
        if len(bands[b]) >= PER_BAND:
            continue
        bands[b].append([r[idx["PuzzleId"]], r[idx["FEN"]], r[idx["Moves"]], rating,
                         r[idx["Themes"]], r[idx["OpeningTags"]]])
        got += 1
        if got >= need:
            break
        if n % 200000 == 0:
            print(n, got, flush=True)
        if n > 3_000_000:
            break

puzzles = [p for b in sorted(bands) for p in bands[b]]
with open(out_path, "w", encoding="utf-8") as f:
    json.dump({"source": "Lichess puzzle database (CC0), https://database.lichess.org/",
               "fields": ["id", "fen", "moves", "rating", "themes", "openings"],
               "puzzles": puzzles}, f, separators=(",", ":"))
print("wrote", len(puzzles), {b: len(v) for b, v in bands.items()})
