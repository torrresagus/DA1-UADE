VENV     := .venv
PYTHON   := $(VENV)/bin/python
PIP      := $(VENV)/bin/pip
FRONTEND := frontend

.DEFAULT_GOAL := help

.PHONY: help local venv install migrate seed run frontend clean

help: ## Muestra esta ayuda
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | \
		awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-12s\033[0m %s\n", $$1, $$2}'

local: venv install migrate seed ## Setup completo: env + dependencias + migraciones + seed
	@echo "✅ Entorno listo. Activá con 'source $(VENV)/bin/activate' y corré 'make run'."

venv: ## Crea el entorno virtual si no existe
	@test -d $(VENV) || python3 -m venv $(VENV)

install: venv ## Instala las dependencias
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt

migrate: ## Corre las migraciones de Alembic
	$(VENV)/bin/alembic upgrade head

seed: ## Puebla la base con datos de demo
	$(PYTHON) seed.py

run: ## Levanta el API con Uvicorn (hot-reload)
	$(VENV)/bin/uvicorn app.main:app --reload

frontend: ## Levanta el frontend web (Expo). Instala node_modules si falta
	@test -d $(FRONTEND)/node_modules || (cd $(FRONTEND) && npm install)
	cd $(FRONTEND) && npm run web

clean: ## Elimina el entorno virtual y la base SQLite
	rm -rf $(VENV) subastas.db
