import copy
import json
from pathlib import Path
import sys
import threading
import unittest
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from http.server import ThreadingHTTPServer

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "src"))
from pulse_agents.pipeline import insights, verify_template
from pulse_agents.server import Handler

EXAMPLES = Path(__file__).resolve().parents[2] / "contracts" / "examples"


def load(name: str) -> dict:
    return json.loads((EXAMPLES / name).read_text(encoding="utf-8"))


class PipelineTests(unittest.TestCase):
    def test_shared_positive_and_negative_cases(self) -> None:
        request = load("insight-request.json")
        expected = load("insight-response.json")
        self.assertEqual(insights(request), expected)
        self.assertEqual(insights(request), insights(request))
        for case in load("invalid-insight-cases.json")["cases"]:
            with self.subTest(case=case["name"]):
                target = copy.deepcopy(request if case["target"] == "request" else expected)
                node = target
                for key in case["path"][:-1]:
                    node = node[key]
                node[case["path"][-1]] = case["value"]
                if case["target"] == "request":
                    with self.assertRaises(ValueError):
                        insights(target)
                elif case["path"][0] == "draft":
                    with self.assertRaises(ValueError):
                        verify_template(target["draft"], request["factPack"])
                else:
                    from pulse_agents.contracts import validate_verification
                    with self.assertRaises(ValueError):
                        validate_verification(target["verification"], target["draft"])

    def test_http_endpoint(self) -> None:
        server = ThreadingHTTPServer(("127.0.0.1", 0), Handler)
        worker = threading.Thread(target=server.serve_forever, daemon=True)
        worker.start()
        try:
            url = f"http://127.0.0.1:{server.server_port}/insights"
            request = Request(url, data=json.dumps(load("insight-request.json")).encode(), headers={"Content-Type": "application/json"})
            with urlopen(request, timeout=2) as response:
                self.assertEqual(json.load(response), load("insight-response.json"))
            with self.assertRaises(HTTPError) as error:
                urlopen(Request(url, data=b"{}", headers={"Content-Type": "application/json"}), timeout=2)
            self.assertEqual(error.exception.code, 422)
            error.exception.close()
        finally:
            server.shutdown()
            server.server_close()
            worker.join()
