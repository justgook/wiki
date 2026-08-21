WIKI_REPOSITORY ?= https://github.com/justgook/wiki
WIKI_VERSION ?= release
WIKI_ENGINE ?= .wiki-engine
WIKI_OUTPUT ?= .wiki-dist
WIKI_SOURCE ?= $(if $(wildcard _config.md),.,content)
PORT ?= 8080

.PHONY: build serve clean reinstall-engine

build: $(WIKI_ENGINE)/scripts/serve.mjs
	@$(WIKI_ENGINE)/scripts/build.sh "$(WIKI_SOURCE)" "$(WIKI_OUTPUT)"

serve: $(WIKI_ENGINE)/scripts/serve.mjs
	@command -v bun >/dev/null 2>&1 && exec bun "$(WIKI_ENGINE)/scripts/serve.mjs" "$(WIKI_SOURCE)" "$(PORT)"; \
	command -v node >/dev/null 2>&1 && exec node "$(WIKI_ENGINE)/scripts/serve.mjs" "$(WIKI_SOURCE)" "$(PORT)"; \
	command -v python3 >/dev/null 2>&1 && exec python3 "$(WIKI_ENGINE)/scripts/serve.py" "$(WIKI_SOURCE)" "$(PORT)"; \
	command -v python >/dev/null 2>&1 && exec python "$(WIKI_ENGINE)/scripts/serve.py" "$(WIKI_SOURCE)" "$(PORT)"; \
	echo "make serve requires Bun, Node.js, or Python" >&2; exit 1

$(WIKI_ENGINE)/scripts/serve.mjs:
	@set -eu; \
	tmp=$$(mktemp -d "$${TMPDIR:-/tmp}/wiki-engine.XXXXXX"); \
	trap 'rm -rf "$$tmp"' EXIT INT TERM; \
	archive="$(WIKI_REPOSITORY)/archive/$(WIKI_VERSION).tar.gz"; \
	echo "Downloading wiki engine $(WIKI_VERSION)..."; \
	if command -v curl >/dev/null 2>&1; then curl -fsSL "$$archive" -o "$$tmp/wiki.tar.gz"; \
	elif command -v wget >/dev/null 2>&1; then wget -qO "$$tmp/wiki.tar.gz" "$$archive"; \
	else echo "Installing the wiki engine requires curl or wget" >&2; exit 1; fi; \
	mkdir -p "$$tmp/engine"; \
	tar -xzf "$$tmp/wiki.tar.gz" --strip-components=1 -C "$$tmp/engine"; \
	rm -rf "$(WIKI_ENGINE)"; \
	mv "$$tmp/engine" "$(WIKI_ENGINE)"; \
	trap - EXIT INT TERM

reinstall-engine:
	@rm -rf "$(WIKI_ENGINE)"
	@$(MAKE) "$(WIKI_ENGINE)/scripts/serve.mjs"

clean:
	@rm -rf "$(WIKI_OUTPUT)"
