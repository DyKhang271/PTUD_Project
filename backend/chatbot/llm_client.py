from __future__ import annotations

import json
from urllib import error, request

from .settings import get_chatbot_settings


class OllamaUnavailableError(RuntimeError):
    pass


class OllamaClient:
    def __init__(self) -> None:
        self.settings = get_chatbot_settings()

    def _request_json(self, path: str, payload: dict | None = None) -> dict:
        url = f"{self.settings.ollama_base_url}{path}"
        data = None
        headers = {}
        if payload is not None:
            data = json.dumps(payload).encode("utf-8")
            headers["Content-Type"] = "application/json"

        req = request.Request(url, data=data, headers=headers)
        with request.urlopen(req, timeout=self.settings.ollama_timeout_seconds) as response:
            body = response.read().decode("utf-8")
            return json.loads(body) if body else {}

    def is_ready(self) -> tuple[bool, str | None]:
        try:
            payload = self._request_json("/api/tags")
        except (error.URLError, TimeoutError, OSError, json.JSONDecodeError):
            return False, "Ollama service is not reachable."

        model_names = {
            model.get("name")
            for model in payload.get("models", [])
            if isinstance(model, dict)
        }
        if self.settings.ollama_model not in model_names:
            return False, f"Model {self.settings.ollama_model} is not available in Ollama yet."
        return True, None

    def generate(self, *, system_prompt: str, prompt: str) -> str:
        ready, reason = self.is_ready()
        if not ready:
            raise OllamaUnavailableError(reason or "Ollama is not ready.")

        try:
            payload = self._request_json(
                "/api/generate",
                {
                    "model": self.settings.ollama_model,
                    "prompt": prompt,
                    "system": system_prompt,
                    "stream": False,
                },
            )
        except (error.URLError, TimeoutError, OSError, json.JSONDecodeError) as exc:
            raise OllamaUnavailableError("Không thể gọi Ollama lúc này.") from exc

        response_text = (payload.get("response") or "").strip()
        if not response_text:
            raise OllamaUnavailableError("Ollama không trả về nội dung hợp lệ.")
        return response_text
