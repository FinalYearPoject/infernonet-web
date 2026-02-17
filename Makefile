.PHONY: cache-clean run run-clean

cache-clean:
	find . | grep -E "(/__pycache__$$|\.pyc$$|\.pyo$$)" | xargs rm -rf || true

run:
	docker compose up -d --build

run-clean:
	docker compose down -v
	docker compose up -d --build
