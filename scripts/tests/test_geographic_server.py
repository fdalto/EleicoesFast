import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from geographic_server import GeographicRepository


class GeographicServerTest(unittest.TestCase):
    def repository(self):
        folder = tempfile.TemporaryDirectory()
        database = Path(folder.name) / "geographic.sqlite"
        db = sqlite3.connect(database)
        db.executescript("""
          CREATE TABLE election_sections(section_key TEXT PRIMARY KEY,election_id TEXT,poll_id TEXT,round INTEGER,office_code TEXT,uf TEXT,municipality_code TEXT,zone TEXT,section TEXT);
          CREATE TABLE section_historical_votes(section_key TEXT PRIMARY KEY,valid_votes INTEGER,pt_votes INTEGER,pl_votes INTEGER,other_votes INTEGER);
          CREATE TABLE municipality_historical_votes(source_manifest_id TEXT,uf TEXT,municipality_code TEXT);
        """)
        db.executemany("INSERT INTO election_sections VALUES(?,?,?,?,?,?,?,?,?)", [("s1","6257","-",1,"0001","AC","01392","0001","0002"),("s2","6257","-",1,"0001","AC","01392","0001","0003"),("s3","6257","-",1,"0001","SP","01392","0001","0002")])
        db.executemany("INSERT INTO section_historical_votes VALUES(?,?,?,?,?)", [("s1",520,240,260,20),("s2",100,40,40,20),("s3",200,50,130,20)])
        db.execute("INSERT INTO municipality_historical_votes VALUES('m1','AC','01392')")
        db.commit(); db.close()
        return folder, GeographicRepository(database)

    def test_summary_sums_before_calculating_percentages_and_deduplicates(self):
        folder, repository = self.repository()
        with folder:
            response = repository.history_sections_summary({"referencia":{"ano":2026,"turno":1,"cargo":"PRESIDENTE"},"secoes":[{"uf":"AC","municipio_tse":"01392","zona":1,"secao":2},{"uf":"AC","municipio_tse":"01392","zona":1,"secao":2}]})
            municipality = response["municipios"][0]
            self.assertEqual(response["resumo"], {"secoes_solicitadas":1,"secoes_encontradas":1,"secoes_nao_encontradas":0})
            self.assertEqual(municipality["historico"]["pt_votos"], 240)
            self.assertEqual(municipality["historico"]["pl_votos"], 260)
            self.assertEqual(municipality["historico"]["pt_pct_entre_pt_pl"], 48)
            self.assertEqual(municipality["historico"]["pl_pct_entre_pt_pl"], 52)
            self.assertAlmostEqual(municipality["historico"]["pt_pct_validos"], 240 / 520 * 100)

    def test_missing_sections_and_same_municipality_code_in_other_uf_do_not_mix(self):
        folder, repository = self.repository()
        with folder:
            response = repository.history_sections_summary({"referencia":{"ano":2026,"turno":1,"cargo":"PRESIDENTE"},"secoes":[{"uf":"AC","municipio_tse":"01392","zona":1,"secao":3},{"uf":"SP","municipio_tse":"01392","zona":1,"secao":2},{"uf":"AC","municipio_tse":"01392","zona":1,"secao":9}]})
            ac, sp = response["municipios"]
            self.assertEqual((ac["secoes_encontradas"], ac["secoes_nao_encontradas"], ac["status"]), (1,1,"partial"))
            self.assertEqual(ac["historico"]["pt_votos"],40)
            self.assertEqual(sp["historico"]["pt_votos"],50)

    def test_reference_must_be_historical_first_round_only(self):
        folder, repository = self.repository()
        with folder:
            with self.assertRaisesRegex(ValueError, "referencia"):
                repository.history_sections_summary({"referencia":{"ano":2026,"turno":2,"cargo":"PRESIDENTE"},"secoes":[]})


if __name__ == "__main__":
    unittest.main()
