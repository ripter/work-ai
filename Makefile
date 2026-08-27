# WorkAI — CavePerson (HTML5/PixiJS)
#
#   make build    # build the production static site -> dist/
#   make start    # start the local dev server (vite)
#   make preview  # serve the production build locally
#   make session  # export the current opencode session to stats/sessionN.json
#   make clean    # remove dist/

.PHONY: all build start preview session clean

# default: production build
all: build

build:
	npm run build

start:
	npm run dev

preview:
	npm run preview

# export the current opencode session log to stats/sessionN.json
session:
	sh export-session.sh

clean:
	rm -rf dist
