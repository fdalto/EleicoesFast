import argparse
import json
import sqlite3
import sys
import tempfile
import unittest
from pathlib import Path

sys.path.insert(0,str(Path(__file__).resolve().parents[1]))
from prepare_geographic_history import prepare


class GeographicHistoryTest(unittest.TestCase):
    def test_streaming_import_is_idempotent_and_preserves_codes(self):
        with tempfile.TemporaryDirectory() as folder:
            root=Path(folder); source=root/"official.csv"; output=root/"site"
            header="NR_TURNO;CD_CARGO_PERGUNTA;CD_ELEICAO;CD_PLEITO;SG_UF;CD_MUNICIPIO;NR_ZONA;NR_SECAO;NR_LOCAL_VOTACAO;QT_APTOS;QT_COMPARECIMENTO;QT_ABSTENCOES;CD_TIPO_VOTAVEL;DS_TIPO_VOTAVEL;NR_VOTAVEL;NM_VOTAVEL;SG_PARTIDO;QT_VOTOS\n"
            rows=[
                "1;1;6257;406;AC;1007;1;2;55;300;250;50;1;Nominal;13;CANDIDATO PT;PT;100",
                "1;1;6257;406;AC;1007;1;2;55;300;250;50;1;Nominal;22;CANDIDATO PL;PL;80",
                "1;1;6257;406;AC;1007;1;2;55;300;250;50;1;Nominal;30;OUTRO;NOVO;40",
                "1;1;6257;406;AC;1007;1;2;55;300;250;50;2;Branco;;;;10",
                "1;1;6257;406;AC;1007;1;2;55;300;250;50;3;Nulo;;;;20",
            ]
            source.write_text(header+"\n".join(rows)+"\n",encoding="latin-1")
            args=argparse.Namespace(uf="AC",input=str(source),output=str(output),cache=str(root/"cache"),election_id=None,poll_id=None,api_url="unused")
            first=prepare(args); second=prepare(args)
            self.assertEqual(first["totals"]["sections"],1); self.assertEqual(second["totals"]["sections"],1)
            self.assertEqual(first["stats"]["sections"],1); self.assertEqual(second["stats"]["sections"],1)
            manifest=json.loads((output/"manifest.json").read_text(encoding="utf-8")); partition=json.loads((output/manifest["partitions"][0]["path"]).read_text(encoding="utf-8"))
            self.assertEqual(partition["sections"][0]["municipalityCode"],"01007")
            self.assertEqual(partition["sections"][0]["zone"],"0001")
            self.assertEqual(partition["historicalVotes"][0]["ptVotes"],100)
            self.assertEqual(partition["historicalVotes"][0]["plVotes"],80)
            self.assertEqual(partition["historicalVotes"][0]["otherVotes"],40)
            self.assertEqual(partition["historicalVotes"][0]["validVotes"],220)
            db=sqlite3.connect(output/"canonical.sqlite")
            try:
                self.assertEqual(db.execute("SELECT COUNT(*) FROM election_sections").fetchone()[0],1)
            finally:
                db.close()


if __name__ == "__main__":
    unittest.main()
