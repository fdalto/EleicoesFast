import sqlite3
import sys
import tempfile
import unittest
from argparse import Namespace
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from tse_apuracao_simulator import Simulator


class TSEApuracaoSimulatorTest(unittest.TestCase):
    def test_exposes_consistent_partial_ea16_and_ea20(self):
        with tempfile.TemporaryDirectory() as folder:
            database = Path(folder) / "geographic.sqlite"
            db = sqlite3.connect(database)
            db.executescript("""
                CREATE TABLE election_sections(section_key TEXT PRIMARY KEY,round INTEGER,office_code TEXT,uf TEXT,municipality_code TEXT,zone TEXT,section TEXT,electorate INTEGER);
                CREATE TABLE section_historical_votes(section_key TEXT PRIMARY KEY,turnout INTEGER,valid_votes INTEGER,pt_votes INTEGER,pl_votes INTEGER,other_votes INTEGER);
            """)
            db.execute("INSERT INTO election_sections VALUES('a',1,'0001','AC','01392','0001','0001',100)")
            db.execute("INSERT INTO election_sections VALUES('b',1,'0001','AC','01392','0001','0002',120)")
            db.execute("INSERT INTO section_historical_votes VALUES('a',80,70,40,20,10)")
            db.execute("INSERT INTO section_historical_votes VALUES('b',90,80,30,40,10)")
            db.commit()
            db.close()
            simulator = Simulator(Namespace(database=str(database), uf='AC', municipality='01392', municipality_name=None, sections=2, counted=1, round=2, environment='simulado2026', cycle='eleicoesfast', poll_id='9999', federal_election='9001', state_election='9002'))
            self.assertEqual(simulator.ea11()['pl'][0]['e'][0]['t'], '2')
            self.assertEqual(simulator.ea12()['abr'][0]['mu'][0]['cd'], '01392')
            self.assertEqual(simulator.ea16()['abr'][0]['mu'][0]['zon'][0]['sec'][0]['da'] is not None, True)
            self.assertNotIn('da', simulator.ea16()['abr'][0]['mu'][0]['zon'][0]['sec'][1])
            partial = simulator.ea20('municipality')
            self.assertEqual(partial['s'], {'ts': '2', 'st': '1', 'snt': '1', 'pst': '50.0'})
            self.assertEqual(partial['v']['vv'], '70')
            self.assertEqual(simulator.advance(1), (2, 2))
            self.assertEqual(simulator.ea20('municipality')['v']['vv'], '150')


if __name__ == '__main__':
    unittest.main()
