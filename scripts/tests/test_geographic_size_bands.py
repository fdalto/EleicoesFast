import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from build_geographic_size_bands import band_for_population, create_size_bands


class GeographicSizeBandsTest(unittest.TestCase):
    def test_bands_follow_valid_votes_population_proxy(self):
        self.assertEqual(band_for_population(5_000), 1)
        self.assertEqual(band_for_population(5_001), 2)
        self.assertEqual(band_for_population(200_001), 5)
        with tempfile.TemporaryDirectory() as folder:
            database = Path(folder) / "geographic.sqlite"
            db = sqlite3.connect(database)
            db.executescript("""
              CREATE TABLE election_sections(section_key TEXT PRIMARY KEY, source_manifest_id TEXT, uf TEXT, municipality_code TEXT, round INTEGER, office_code TEXT);
              CREATE TABLE section_historical_votes(section_key TEXT PRIMARY KEY, electorate INTEGER, turnout INTEGER, abstention INTEGER, valid_votes INTEGER, blank_votes INTEGER, null_votes INTEGER, pt_votes INTEGER, pl_votes INTEGER, other_votes INTEGER);
            """)
            db.execute("INSERT INTO election_sections VALUES('s','m1','AC','00001',1,'0001')")
            db.execute("INSERT INTO section_historical_votes VALUES('s',25000,18000,7000,14000,1000,500,7000,6000,1000)")
            db.commit(); db.close()
            result = create_size_bands(database)
            self.assertEqual(result["municipalities"], 1)
            db = sqlite3.connect(database)
            row = db.execute("SELECT historical_valid_votes,estimated_population,population_band,valid_votes_per_inhabitant FROM municipality_size_bands").fetchone()
            self.assertEqual(row[:3], (14000, 25000, 3))
            self.assertEqual(row[3], 0.56)
            history = db.execute("SELECT sections,electorate,turnout,abstention,valid_votes,pt_votes,pl_votes,other_votes FROM municipality_historical_votes").fetchone()
            db.close()
            self.assertEqual(history, (1, 25000, 18000, 7000, 14000, 7000, 6000, 1000))


if __name__ == "__main__":
    unittest.main()
